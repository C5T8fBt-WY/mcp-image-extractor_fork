import axios from 'axios';
import * as fs from 'fs';
import {
  processImageBuffer,
  validateDomain,
  McpToolResponse,
  MAX_IMAGE_SIZE
} from './image-utils';

// pdf-to-img is ESM-first. We load it dynamically so this project can keep compiling to CJS.
type PdfToImgModule = {
  pdf: (
    input: string,
    options?: {
      password?: string;
      scale?: number;
    }
  ) => Promise<{
    length: number;
    metadata?: unknown;
    getPage: (pageNumber: number) => Promise<Buffer | Uint8Array | ArrayBuffer>;
    [Symbol.asyncIterator]?: () => AsyncIterator<Buffer | Uint8Array | ArrayBuffer>;
  }>;
};

let pdfToImgMod: PdfToImgModule | null = null;
async function getPdfToImg(): Promise<PdfToImgModule> {
  if (!pdfToImgMod) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    pdfToImgMod = (await import('pdf-to-img')) as unknown as PdfToImgModule;
  }
  return pdfToImgMod;
}

// PDF rendering DPI (can be overridden via env var, default 150)
const PDF_DPI = parseInt(process.env.PDF_DPI || '150', 10);
const PDF_SCALE = Number.isFinite(PDF_DPI) && PDF_DPI > 0 ? PDF_DPI / 72 : 150 / 72;

function asBuffer(data: Buffer | Uint8Array | ArrayBuffer): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  return Buffer.from(data);
}

function cleanBase64(base64: string): string {
  return base64.replace(/\s+/g, '');
}

function isValidBase64(base64: string): boolean {
  const b64 = cleanBase64(base64);
  if (b64.length === 0) return false;
  if (b64.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(b64);
}

async function renderPdfPageFromInput(
  input: string,
  pageNum: number
): Promise<{ pngBuffer: Buffer; pageCount: number }> {
  const { pdf } = await getPdfToImg();
  const doc = await pdf(input, { scale: PDF_SCALE });

  const pageCount = typeof doc.length === 'number' ? doc.length : 0;
  if (!pageCount) {
    throw new Error('Failed to determine PDF page count');
  }

  if (pageNum < 1 || pageNum > pageCount) {
    throw new Error(`Page ${pageNum} is out of range. Document has ${pageCount} page(s).`);
  }

  const pageData = await doc.getPage(pageNum);
  return { pngBuffer: asBuffer(pageData), pageCount };
}

// Type definitions
export type ExtractPdfFromFileParams = {
  file_path: string;
  page: number;
  resize: boolean;
  max_width: number;
  max_height: number;
  focus_xyxy?: number[];
  focal_point?: number[];
};

export type ExtractPdfFromUrlParams = {
  url: string;
  page: number;
  resize: boolean;
  max_width: number;
  max_height: number;
  focus_xyxy?: number[];
  focal_point?: number[];
};

export type ExtractPdfFromBase64Params = {
  base64: string;
  page: number;
  resize: boolean;
  max_width: number;
  max_height: number;
  focus_xyxy?: number[];
  focal_point?: number[];
};

// Extract a page from a local PDF file
export async function extractPdfFromFile(params: ExtractPdfFromFileParams): Promise<McpToolResponse> {
  try {
    const { file_path, page } = params;

    if (!fs.existsSync(file_path)) {
      return {
        content: [{ type: "text", text: `Error: File ${file_path} does not exist` }],
        isError: true
      };
    }

    const pdfBuffer = fs.readFileSync(file_path);

    if (pdfBuffer.length > MAX_IMAGE_SIZE) {
      return {
        content: [{ type: "text", text: `Error: PDF size exceeds maximum allowed size of ${MAX_IMAGE_SIZE} bytes` }],
        isError: true
      };
    }

    // pdf-to-img reads from path, so we pass the path directly.
    // We still keep the MAX_IMAGE_SIZE check above.
    const { pngBuffer, pageCount } = await renderPdfPageFromInput(file_path, page);

    return await processImageBuffer({
      imageBuffer: pngBuffer,
      format: 'png',
      mimeType: 'image/png',
      focus_xyxy: params.focus_xyxy,
      focal_point: params.focal_point,
      extraMetadata: {
        source: 'pdf',
        page,
        totalPages: pageCount,
        dpi: PDF_DPI
      }
    });
  } catch (error: unknown) {
    console.error('Error processing PDF file:', error);
    return {
      content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true
    };
  }
}

// Extract a page from a PDF at a URL
export async function extractPdfFromUrl(params: ExtractPdfFromUrlParams): Promise<McpToolResponse> {
  try {
    const { url, page } = params;

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

    const pdfBuffer = Buffer.from(response.data);
    if (pdfBuffer.length > MAX_IMAGE_SIZE) {
      return {
        content: [{ type: "text", text: `Error: PDF size exceeds maximum allowed size of ${MAX_IMAGE_SIZE} bytes` }],
        isError: true
      };
    }

    const dataUrl = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;
    const { pngBuffer, pageCount } = await renderPdfPageFromInput(dataUrl, page);

    return await processImageBuffer({
      imageBuffer: pngBuffer,
      format: 'png',
      mimeType: 'image/png',
      focus_xyxy: params.focus_xyxy,
      focal_point: params.focal_point,
      extraMetadata: {
        source: 'pdf',
        page,
        totalPages: pageCount,
        dpi: PDF_DPI
      }
    });
  } catch (error: unknown) {
    console.error('Error processing PDF from URL:', error);
    return {
      content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true
    };
  }
}

// Extract a page from a base64-encoded PDF
export async function extractPdfFromBase64(params: ExtractPdfFromBase64Params): Promise<McpToolResponse> {
  try {
    const { base64, page } = params;

    if (!isValidBase64(base64)) {
      return {
        content: [{ type: "text", text: 'Error: Invalid base64 string' }],
        isError: true
      };
    }

    const base64Clean = cleanBase64(base64);
    const pdfBuffer = Buffer.from(base64Clean, 'base64');
    if (pdfBuffer.length === 0) {
      return {
        content: [{ type: "text", text: 'Error: Invalid base64 string - decoded to empty buffer' }],
        isError: true
      };
    }

    if (pdfBuffer.length > MAX_IMAGE_SIZE) {
      return {
        content: [{ type: "text", text: `Error: PDF size exceeds maximum allowed size of ${MAX_IMAGE_SIZE} bytes` }],
        isError: true
      };
    }

    const dataUrl = `data:application/pdf;base64,${base64Clean}`;
    const { pngBuffer, pageCount } = await renderPdfPageFromInput(dataUrl, page);

    return await processImageBuffer({
      imageBuffer: pngBuffer,
      format: 'png',
      mimeType: 'image/png',
      focus_xyxy: params.focus_xyxy,
      focal_point: params.focal_point,
      extraMetadata: {
        source: 'pdf',
        page,
        totalPages: pageCount,
        dpi: PDF_DPI
      }
    });
  } catch (error: unknown) {
    console.error('Error processing base64 PDF:', error);
    return {
      content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true
    };
  }
}
