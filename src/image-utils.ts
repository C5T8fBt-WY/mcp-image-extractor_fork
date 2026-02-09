import axios from 'axios';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
export const MAX_IMAGE_SIZE = parseInt(process.env.MAX_IMAGE_SIZE || '52428800', 10); // 50MB default (increased from 10MB)
export const ALLOWED_DOMAINS = process.env.ALLOWED_DOMAINS ? process.env.ALLOWED_DOMAINS.split(',') : [];

// Default max dimensions for optimal LLM context usage (can be overridden via env vars)
const DEFAULT_MAX_WIDTH = parseInt(process.env.DEFAULT_MAX_WIDTH || '512', 10);
const DEFAULT_MAX_HEIGHT = parseInt(process.env.DEFAULT_MAX_HEIGHT || '512', 10);

// Compression quality (can be overridden via env var, 1-100, higher = better quality but larger file)
const COMPRESSION_QUALITY = parseInt(process.env.COMPRESSION_QUALITY || '80', 10);

// PNG compression level (can be overridden via env var, 0-9, higher = smaller file but slower)
const PNG_COMPRESSION_LEVEL = parseInt(process.env.PNG_COMPRESSION_LEVEL || '9', 10);

// Compression configuration based on format
type SupportedFormat = 'jpeg' | 'jpg' | 'png' | 'webp' | 'gif' | 'svg' | 'avif' | 'tiff';

const COMPRESSION_OPTIONS: Record<SupportedFormat, object> = {
  jpeg: { quality: COMPRESSION_QUALITY },
  jpg: { quality: COMPRESSION_QUALITY },
  png: { quality: COMPRESSION_QUALITY, compressionLevel: PNG_COMPRESSION_LEVEL },
  webp: { quality: COMPRESSION_QUALITY },
  gif: {},
  svg: {},
  avif: { quality: COMPRESSION_QUALITY },
  tiff: { quality: COMPRESSION_QUALITY }
};

// Type definitions
export type ExtractImageFromFileParams = {
  file_path: string;
  resize: boolean;
  max_width: number;
  max_height: number;
  focus_xyxy?: number[];
  focal_point?: number[];
};

export type ExtractImageFromUrlParams = {
  url: string;
  resize: boolean;
  max_width: number;
  max_height: number;
  focus_xyxy?: number[];
  focal_point?: number[];
};

export type ExtractImageFromBase64Params = {
  base64: string;
  mime_type: string;
  resize: boolean;
  max_width: number;
  max_height: number;
  focus_xyxy?: number[];
  focal_point?: number[];
};

export type ProcessImageBufferParams = {
  imageBuffer: Buffer;
  format: string;
  mimeType: string;
  focus_xyxy?: number[];
  focal_point?: number[];
  extraMetadata?: Record<string, unknown>;
};

// MCP SDK expects this specific format for tool responses
export type McpToolResponse = {
  [x: string]: unknown;
  content: (
    | { [x: string]: unknown; type: "text"; text: string; }
    | { [x: string]: unknown; type: "image"; data: string; mimeType: string; }
    | {
      [x: string]: unknown;
      type: "resource";
      resource: {
        [x: string]: unknown;
        text: string;
        uri: string;
        mimeType?: string;
      } | {
        [x: string]: unknown;
        uri: string;
        blob: string;
        mimeType?: string;
      };
    }
  )[];
  _meta?: Record<string, unknown>;
  isError?: boolean;
};

// Helper function to compress image based on format
async function compressImage(imageBuffer: Buffer, formatStr: string): Promise<Buffer> {
  const sharpInstance = sharp(imageBuffer);
  const format = formatStr.toLowerCase() as SupportedFormat;

  // Check if format is supported
  if (format in COMPRESSION_OPTIONS) {
    const options = COMPRESSION_OPTIONS[format];

    // Use specific methods based on format
    switch (format) {
      case 'jpeg':
      case 'jpg':
        return await sharpInstance.jpeg(options as any).toBuffer();
      case 'png':
        return await sharpInstance.png(options as any).toBuffer();
      case 'webp':
        return await sharpInstance.webp(options as any).toBuffer();
      case 'avif':
        return await sharpInstance.avif(options as any).toBuffer();
      case 'tiff':
        return await sharpInstance.tiff(options as any).toBuffer();
      // For formats without specific compression options
      case 'gif':
      case 'svg':
        return await sharpInstance.toBuffer();
    }
  }

  // Default to jpeg if format not supported
  return await sharpInstance.jpeg(COMPRESSION_OPTIONS.jpeg as any).toBuffer();
}

// Helper function to check if values are ratios (all between 0 and 1)
function isRatio(values: number[]): boolean {
  // If all values are between 0 and 1 (inclusive), treat as ratio
  // Exception: if any value matches the image dimension, it might be ambiguous,
  // but standardizing on 0-1.0 range for ratios is best.
  // We assume that if a user wants 1 pixel, they probably won't use 0-1 for other coords.
  return values.every(v => v >= 0 && v <= 1.0);
}

// Helper function to apply focus (crop) to image
async function applyImageFocus(
  imageBuffer: Buffer,
  metadata: any,
  focus_xyxy?: number[],
  focal_point?: number[]
): Promise<Buffer | null> {
  if ((!focus_xyxy || focus_xyxy.length !== 4) && (!focal_point || focal_point.length !== 4)) return null;
  if (!metadata.width || !metadata.height) return null;

  let left = 0;
  let top = 0;
  let width = metadata.width;
  let height = metadata.height;
  let shouldCrop = false;

  if (focus_xyxy && focus_xyxy.length === 4) {
    const [x1, y1, x2, y2] = focus_xyxy;
    if (isRatio(focus_xyxy)) {
      left = Math.round(x1 * metadata.width);
      top = Math.round(y1 * metadata.height);
      width = Math.round((x2 - x1) * metadata.width);
      height = Math.round((y2 - y1) * metadata.height);
    } else {
      left = Math.round(x1);
      top = Math.round(y1);
      width = Math.round(x2 - x1);
      height = Math.round(y2 - y1);
    }
    shouldCrop = true;
  } else if (focal_point && focal_point.length === 4) {
    const [cx, cy, hw, hh] = focal_point;
    if (isRatio(focal_point)) {
      const pixelCx = cx * metadata.width;
      const pixelCy = cy * metadata.height;
      const pixelHw = hw * metadata.width;
      const pixelHh = hh * metadata.height;

      left = Math.round(pixelCx - pixelHw);
      top = Math.round(pixelCy - pixelHh);
      width = Math.round(pixelHw * 2);
      height = Math.round(pixelHh * 2);
    } else {
      left = Math.round(cx - hw);
      top = Math.round(cy - hh);
      width = Math.round(hw * 2);
      height = Math.round(hh * 2);
    }
    shouldCrop = true;
  }

  if (shouldCrop) {
    // Clamp coordinates
    const imgWidth = metadata.width;
    const imgHeight = metadata.height;

    left = Math.max(0, left);
    top = Math.max(0, top);

    // Ensure extract region is within bounds
    if (left + width > imgWidth) {
      width = imgWidth - left;
    }
    if (top + height > imgHeight) {
      height = imgHeight - top;
    }

    // Ensure positive dimensions
    if (width > 0 && height > 0) {
      return await sharp(imageBuffer)
        .extract({ left, top, width, height })
        .toBuffer();
    }
  }

  return null;
}

// Map file extension to MIME type and compression format
export function getMimeAndFormat(fileExt: string): { mimeType: string; format: string } {
  switch (fileExt) {
    case '.png':
      return { mimeType: 'image/png', format: 'png' };
    case '.jpg':
    case '.jpeg':
      return { mimeType: 'image/jpeg', format: 'jpeg' };
    case '.gif':
      return { mimeType: 'image/gif', format: 'gif' };
    case '.webp':
      return { mimeType: 'image/webp', format: 'webp' };
    case '.svg':
      // SVG files are rasterized by Sharp to PNG format
      return { mimeType: 'image/png', format: 'png' };
    case '.avif':
      return { mimeType: 'image/avif', format: 'avif' };
    default:
      return { mimeType: 'image/jpeg', format: 'jpeg' };
  }
}

// Validate URL domain against ALLOWED_DOMAINS
export function validateDomain(url: string): string | null {
  if (ALLOWED_DOMAINS.length === 0) return null;

  const urlObj = new URL(url);
  const domain = urlObj.hostname;
  const isAllowed = ALLOWED_DOMAINS.some((allowedDomain: string) =>
    domain === allowedDomain || domain.endsWith(`.${allowedDomain}`)
  );

  if (!isAllowed) {
    return `Error: Domain ${domain} is not in the allowed domains list`;
  }
  return null;
}

// Shared image processing pipeline: focus → resize → compress → base64 → response
export async function processImageBuffer(params: ProcessImageBufferParams): Promise<McpToolResponse> {
  let { imageBuffer } = params;
  const { format, mimeType } = params;

  let metadata = await sharp(imageBuffer).metadata();

  // Track original dimensions for info message
  const originalWidth = metadata.width || 0;
  const originalHeight = metadata.height || 0;
  const originalPixels = originalWidth * originalHeight;
  const hasFocus = !!(params.focus_xyxy || params.focal_point);

  // Apply focus if requested
  const focusedBuffer = await applyImageFocus(imageBuffer, metadata, params.focus_xyxy, params.focal_point);
  if (focusedBuffer) {
    imageBuffer = focusedBuffer;
    metadata = await sharp(imageBuffer).metadata();
  }

  // Resize to optimal dimensions for LLM context
  if (metadata.width && metadata.height) {
    const targetWidth = Math.min(metadata.width, DEFAULT_MAX_WIDTH);
    const targetHeight = Math.min(metadata.height, DEFAULT_MAX_HEIGHT);

    if (metadata.width > targetWidth || metadata.height > targetHeight) {
      imageBuffer = await sharp(imageBuffer)
        .resize({
          width: targetWidth,
          height: targetHeight,
          fit: 'inside',
          withoutEnlargement: true
        })
        .toBuffer();

      metadata = await sharp(imageBuffer).metadata();
    }
  }

  // Compress the image based on its format
  try {
    imageBuffer = await compressImage(imageBuffer, format);
  } catch (compressionError) {
    console.warn('Compression warning, using original image:', compressionError);
  }

  // Convert to base64
  const base64 = imageBuffer.toString('base64');

  // Build metadata
  const resultMetadata: any = {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    size: imageBuffer.length,
    ...params.extraMetadata
  };

  // Add info message for large images without focus
  if (originalPixels > 300000 && !hasFocus) {
    resultMetadata.info = `Large image detected (${originalWidth}x${originalHeight} = ${originalPixels.toLocaleString()} pixels). Consider using focus_xyxy or focal_point to zoom into specific regions for better detail recognition and reduced token usage.`;
  }

  return {
    content: [
      { type: "text", text: JSON.stringify(resultMetadata) },
      { type: "image", data: base64, mimeType: mimeType }
    ]
  };
}

// Extract image from file
export async function extractImageFromFile(params: ExtractImageFromFileParams): Promise<McpToolResponse> {
  try {
    const { file_path } = params;

    if (!fs.existsSync(file_path)) {
      return {
        content: [{ type: "text", text: `Error: File ${file_path} does not exist` }],
        isError: true
      };
    }

    const imageBuffer = fs.readFileSync(file_path);

    if (imageBuffer.length > MAX_IMAGE_SIZE) {
      return {
        content: [{ type: "text", text: `Error: Image size exceeds maximum allowed size of ${MAX_IMAGE_SIZE} bytes` }],
        isError: true
      };
    }

    const fileExt = path.extname(file_path).toLowerCase();
    const { mimeType, format } = getMimeAndFormat(fileExt);

    return await processImageBuffer({
      imageBuffer,
      format,
      mimeType,
      focus_xyxy: params.focus_xyxy,
      focal_point: params.focal_point
    });
  } catch (error: unknown) {
    console.error('Error processing image file:', error);
    return {
      content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true
    };
  }
}

// Extract image from URL
export async function extractImageFromUrl(params: ExtractImageFromUrlParams): Promise<McpToolResponse> {
  try {
    const { url } = params;

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return {
        content: [{ type: "text", text: "Error: URL must start with http:// or https://" }],
        isError: true
      };
    }

    const domainError = validateDomain(url);
    if (domainError) {
      return {
        content: [{ type: "text", text: domainError }],
        isError: true
      };
    }

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      maxContentLength: MAX_IMAGE_SIZE,
    });

    const imageBuffer = Buffer.from(response.data);
    const mimeType = response.headers['content-type'] || 'image/jpeg';
    const format = (await sharp(imageBuffer).metadata()).format || 'jpeg';

    return await processImageBuffer({
      imageBuffer,
      format,
      mimeType,
      focus_xyxy: params.focus_xyxy,
      focal_point: params.focal_point
    });
  } catch (error: unknown) {
    console.error('Error processing image from URL:', error);
    return {
      content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true
    };
  }
}

// Extract image from base64
export async function extractImageFromBase64(params: ExtractImageFromBase64Params): Promise<McpToolResponse> {
  try {
    const { base64, mime_type } = params;

    let imageBuffer;
    try {
      imageBuffer = Buffer.from(base64, 'base64');

      if (imageBuffer.length === 0) {
        throw new Error("Invalid base64 string - decoded to empty buffer");
      }
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: Invalid base64 string - ${e instanceof Error ? e.message : String(e)}` }],
        isError: true
      };
    }

    if (imageBuffer.length > MAX_IMAGE_SIZE) {
      return {
        content: [{ type: "text", text: `Error: Image size exceeds maximum allowed size of ${MAX_IMAGE_SIZE} bytes` }],
        isError: true
      };
    }

    let metadata;
    try {
      metadata = await sharp(imageBuffer).metadata();
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: Could not process image data - ${e instanceof Error ? e.message : String(e)}` }],
        isError: true
      };
    }

    const format = metadata.format || mime_type.split('/')[1] || 'jpeg';

    return await processImageBuffer({
      imageBuffer,
      format,
      mimeType: mime_type,
      focus_xyxy: params.focus_xyxy,
      focal_point: params.focal_point
    });
  } catch (error: unknown) {
    console.error('Error processing base64 image:', error);
    return {
      content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true
    };
  }
}
