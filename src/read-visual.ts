import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import {
    processImageBuffer,
    validateDomain,
    McpToolResponse,
    MAX_IMAGE_SIZE,
    getMimeAndFormat
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
        pdfToImgMod = (await import('pdf-to-img')) as unknown as PdfToImgModule;
    }
    return pdfToImgMod;
}

// Default PDF DPI (can be overridden via env var or parameter)
const DEFAULT_PDF_DPI = parseInt(process.env.PDF_DPI || '150', 10);

function asBuffer(data: Buffer | Uint8Array | ArrayBuffer): Buffer {
    if (Buffer.isBuffer(data)) return data;
    if (data instanceof ArrayBuffer) return Buffer.from(data);
    return Buffer.from(data);
}

// Source type detection
export type SourceType = 'url' | 'file' | 'base64';

/**
 * Detect the type of source input
 */
export function detectSourceType(source: string): SourceType {
    // URL detection
    if (source.startsWith('http://') || source.startsWith('https://')) {
        return 'url';
    }

    // Data URL detection (base64 encoded)
    if (source.startsWith('data:')) {
        return 'base64';
    }

    // Check if it's a valid file path that exists
    // Handle both Windows (C:\, D:\, \\) and Unix (/) paths
    if (isFilePath(source)) {
        if (fs.existsSync(source)) {
            return 'file';
        }
        // If it looks like a file path but doesn't exist, still treat as file
        // to provide a better error message
        return 'file';
    }

    // Check if it's valid base64
    if (isValidBase64(source)) {
        return 'base64';
    }

    // Default to file (will error if not found)
    return 'file';
}

/**
 * Check if a string looks like a file path
 */
function isFilePath(str: string): boolean {
    // Windows absolute path (C:\, D:\, etc.)
    if (/^[A-Za-z]:[\\\/]/.test(str)) return true;

    // Windows UNC path (\\server\share)
    if (str.startsWith('\\\\')) return true;

    // Unix absolute path
    if (str.startsWith('/')) return true;

    // Relative path with extension (likely a file)
    if (/^\.{0,2}[\\\/]/.test(str)) return true;

    // Has file extension
    if (/\.[a-zA-Z0-9]+$/.test(str) && !str.includes(' ') && str.length < 500) return true;

    return false;
}

/**
 * Check if a string is valid base64
 */
function isValidBase64(str: string): boolean {
    // Must be reasonably long for image data
    if (str.length < 100) return false;

    // Clean and validate
    const b64 = str.replace(/\s+/g, '');
    if (b64.length % 4 !== 0) return false;

    return /^[A-Za-z0-9+/]+={0,2}$/.test(b64);
}

/**
 * Check if content is a PDF (by magic bytes or extension)
 */
function isPdf(buffer: Buffer): boolean {
    // PDF magic bytes: %PDF-
    return buffer.length >= 5 && buffer.slice(0, 5).toString() === '%PDF-';
}

function isPdfByExtension(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === '.pdf';
}

function isPdfByMimeType(mimeType: string): boolean {
    return mimeType === 'application/pdf' || mimeType.includes('pdf');
}

/**
 * Parse data URL into components
 */
function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    return { mimeType: match[1], base64: match[2] };
}

// Unified parameters type
export type ReadVisualParams = {
    source: string;
    page?: number;          // For PDFs only (1-indexed, default: 1)
    dpi?: number;           // For PDFs only (default: 150)
    focus_xyxy?: number[];
    focal_point?: number[];
    mime_type?: string;     // Hint for raw base64 when auto-detection fails
};

/**
 * Render a PDF page to PNG buffer
 */
async function renderPdfPage(
    input: string,
    pageNum: number,
    dpi: number
): Promise<{ pngBuffer: Buffer; pageCount: number }> {
    const { pdf } = await getPdfToImg();
    const scale = dpi / 72;
    const doc = await pdf(input, { scale });

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

/**
 * Process content as PDF
 */
async function processPdf(
    input: string,
    params: ReadVisualParams
): Promise<McpToolResponse> {
    const page = params.page ?? 1;
    const dpi = params.dpi ?? DEFAULT_PDF_DPI;

    const { pngBuffer, pageCount } = await renderPdfPage(input, page, dpi);

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
            dpi
        }
    });
}

/**
 * Process content as image
 */
async function processImage(
    imageBuffer: Buffer,
    format: string,
    mimeType: string,
    params: ReadVisualParams
): Promise<McpToolResponse> {
    return await processImageBuffer({
        imageBuffer,
        format,
        mimeType,
        focus_xyxy: params.focus_xyxy,
        focal_point: params.focal_point
    });
}

/**
 * Unified read_visual function - handles files, URLs, and base64 data
 * Automatically detects PDFs vs images
 */
export async function readVisual(params: ReadVisualParams): Promise<McpToolResponse> {
    try {
        const { source } = params;
        const sourceType = detectSourceType(source);

        switch (sourceType) {
            case 'file':
                return await handleFile(params);

            case 'url':
                return await handleUrl(params);

            case 'base64':
                return await handleBase64(params);

            default:
                return {
                    content: [{ type: "text", text: `Error: Unable to determine source type for input` }],
                    isError: true
                };
        }
    } catch (error: unknown) {
        console.error('Error in readVisual:', error);
        return {
            content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
            isError: true
        };
    }
}

/**
 * Handle file source
 */
async function handleFile(params: ReadVisualParams): Promise<McpToolResponse> {
    const { source } = params;

    if (!fs.existsSync(source)) {
        return {
            content: [{ type: "text", text: `Error: File ${source} does not exist` }],
            isError: true
        };
    }

    const fileBuffer = fs.readFileSync(source);

    if (fileBuffer.length > MAX_IMAGE_SIZE) {
        return {
            content: [{ type: "text", text: `Error: File size exceeds maximum allowed size of ${MAX_IMAGE_SIZE} bytes` }],
            isError: true
        };
    }

    // Check if PDF by extension or magic bytes
    if (isPdfByExtension(source) || isPdf(fileBuffer)) {
        // For PDF files, pass the file path directly to pdf-to-img
        return await processPdf(source, params);
    }

    // Process as image
    const fileExt = path.extname(source).toLowerCase();
    const { mimeType, format } = getMimeAndFormat(fileExt);

    return await processImage(fileBuffer, format, mimeType, params);
}

/**
 * Handle URL source
 */
async function handleUrl(params: ReadVisualParams): Promise<McpToolResponse> {
    const { source } = params;

    const domainError = validateDomain(source);
    if (domainError) {
        return {
            content: [{ type: "text", text: domainError }],
            isError: true
        };
    }

    const response = await axios.get(source, {
        responseType: 'arraybuffer',
        maxContentLength: MAX_IMAGE_SIZE,
    });

    const contentBuffer = Buffer.from(response.data);
    const contentType = response.headers['content-type'] || '';

    if (contentBuffer.length > MAX_IMAGE_SIZE) {
        return {
            content: [{ type: "text", text: `Error: Content size exceeds maximum allowed size of ${MAX_IMAGE_SIZE} bytes` }],
            isError: true
        };
    }

    // Check if PDF by content-type, URL extension, or magic bytes
    const urlLower = source.toLowerCase();
    if (isPdfByMimeType(contentType) || urlLower.endsWith('.pdf') || isPdf(contentBuffer)) {
        // Convert to data URL for pdf-to-img
        const dataUrl = `data:application/pdf;base64,${contentBuffer.toString('base64')}`;
        return await processPdf(dataUrl, params);
    }

    // Process as image
    const format = (await sharp(contentBuffer).metadata()).format || 'jpeg';
    const mimeType = contentType || 'image/jpeg';

    return await processImage(contentBuffer, format, mimeType, params);
}

/**
 * Handle base64 source (raw or data URL)
 */
async function handleBase64(params: ReadVisualParams): Promise<McpToolResponse> {
    const { source } = params;
    let base64Data: string;
    let mimeType = params.mime_type || 'image/png';

    // Check if it's a data URL
    if (source.startsWith('data:')) {
        const parsed = parseDataUrl(source);
        if (!parsed) {
            return {
                content: [{ type: "text", text: 'Error: Invalid data URL format' }],
                isError: true
            };
        }
        base64Data = parsed.base64;
        mimeType = parsed.mimeType;
    } else {
        // Raw base64
        base64Data = source.replace(/\s+/g, '');
    }

    // Validate base64
    if (!isValidBase64(base64Data)) {
        return {
            content: [{ type: "text", text: 'Error: Invalid base64 string' }],
            isError: true
        };
    }

    const contentBuffer = Buffer.from(base64Data, 'base64');

    if (contentBuffer.length === 0) {
        return {
            content: [{ type: "text", text: 'Error: Invalid base64 string - decoded to empty buffer' }],
            isError: true
        };
    }

    if (contentBuffer.length > MAX_IMAGE_SIZE) {
        return {
            content: [{ type: "text", text: `Error: Content size exceeds maximum allowed size of ${MAX_IMAGE_SIZE} bytes` }],
            isError: true
        };
    }

    // Check if PDF
    if (isPdfByMimeType(mimeType) || isPdf(contentBuffer)) {
        // Convert to data URL for pdf-to-img
        const dataUrl = `data:application/pdf;base64,${base64Data}`;
        return await processPdf(dataUrl, params);
    }

    // Process as image
    let format: string;
    try {
        const metadata = await sharp(contentBuffer).metadata();
        format = metadata.format || mimeType.split('/')[1] || 'jpeg';
    } catch {
        format = mimeType.split('/')[1] || 'jpeg';
    }

    return await processImage(contentBuffer, format, mimeType, params);
}
