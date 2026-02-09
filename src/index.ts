#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import {
  extractImageFromFile,
  extractImageFromUrl,
  extractImageFromBase64
} from './image-utils';
import {
  extractPdfFromFile,
  extractPdfFromUrl,
  extractPdfFromBase64
} from './pdf-utils';
import { readVisual } from './read-visual';

dotenv.config();

// Read version from package.json
const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
let packageVersion = '1.0.0';
try {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  packageVersion = packageJson.version || '1.0.0';
} catch {
  // Fallback to default version if package.json can't be read
}

// Create an MCP server
const server = new McpServer({
  name: "mcp-image-extractor",
  description: "MCP server for analyzing images and PDF documents from files, URLs, and base64 data for visual content understanding, text extraction (OCR), and object recognition in screenshots, photos, and PDF pages",
  version: packageVersion
});

// Add extract_image_from_file tool
server.tool(
  "extract_image_from_file",
  "Extract and analyze images from local file paths. Supports visual content understanding, OCR text extraction, and object recognition for screenshots, photos, diagrams, and documents. Use focus_xyxy or focal_point to crop specific regions when the area of interest is small or when you want to reduce token usage by excluding irrelevant parts.",
  {
    file_path: z.string().describe("Path to the image file to analyze (supports screenshots, photos, diagrams, and documents in PNG, JPG, GIF, WebP formats)"),
    resize: z.boolean().default(true).describe("For backward compatibility only. Images are always automatically resized to optimal dimensions (max 512x512) for LLM analysis"),
    max_width: z.number().default(512).describe("For backward compatibility only. Default maximum width is now 512px"),
    max_height: z.number().default(512).describe("For backward compatibility only. Default maximum height is now 512px"),
    focus_xyxy: z.array(z.number()).optional().describe("Optional focus rectangle [x1, y1, x2, y2]. Can be pixel coordinates (integers) or ratios (0.0-1.0)."),
    focal_point: z.array(z.number()).optional().describe("Optional focal point [centerX, centerY, halfWidth, halfHeight]. Can be pixel coordinates (integers) or ratios (0.0-1.0).")
  },
  async (args, extra) => {
    const result = await extractImageFromFile(args);
    return result;
  }
);

// Add extract_image_from_url tool
server.tool(
  "extract_image_from_url",
  "Extract and analyze images from web URLs. Perfect for analyzing web screenshots, online photos, diagrams, or any image accessible via HTTP/HTTPS for visual content analysis and text extraction. Use focus_xyxy or focal_point to crop specific regions when the area of interest is small or when you want to reduce token usage by excluding irrelevant parts.",
  {
    url: z.string().describe("URL of the image to analyze for visual content, text extraction, or object recognition (supports web screenshots, photos, diagrams)"),
    resize: z.boolean().default(true).describe("For backward compatibility only. Images are always automatically resized to optimal dimensions (max 512x512) for LLM analysis"),
    max_width: z.number().default(512).describe("For backward compatibility only. Default maximum width is now 512px"),
    max_height: z.number().default(512).describe("For backward compatibility only. Default maximum height is now 512px"),
    focus_xyxy: z.array(z.number()).optional().describe("Optional focus rectangle [x1, y1, x2, y2]. Can be pixel coordinates (integers) or ratios (0.0-1.0)."),
    focal_point: z.array(z.number()).optional().describe("Optional focal point [centerX, centerY, halfWidth, halfHeight]. Can be pixel coordinates (integers) or ratios (0.0-1.0).")
  },
  async (args, extra) => {
    const result = await extractImageFromUrl(args);
    return result;
  }
);

// Add extract_image_from_base64 tool
server.tool(
  "extract_image_from_base64",
  "Extract and analyze images from base64-encoded data. Ideal for processing screenshots from clipboard, dynamically generated images, or images embedded in applications without requiring file system access. Use focus_xyxy or focal_point to crop specific regions when the area of interest is small or when you want to reduce token usage by excluding irrelevant parts.",
  {
    base64: z.string().describe("Base64-encoded image data to analyze (useful for screenshots, images from clipboard, or dynamically generated visuals)"),
    mime_type: z.string().default("image/png").describe("MIME type of the image (e.g., image/png, image/jpeg)"),
    resize: z.boolean().default(true).describe("For backward compatibility only. Images are always automatically resized to optimal dimensions (max 512x512) for LLM analysis"),
    max_width: z.number().default(512).describe("For backward compatibility only. Default maximum width is now 512px"),
    max_height: z.number().default(512).describe("For backward compatibility only. Default maximum height is now 512px"),
    focus_xyxy: z.array(z.number()).optional().describe("Optional focus rectangle [x1, y1, x2, y2]. Can be pixel coordinates (integers) or ratios (0.0-1.0)."),
    focal_point: z.array(z.number()).optional().describe("Optional focal point [centerX, centerY, halfWidth, halfHeight]. Can be pixel coordinates (integers) or ratios (0.0-1.0).")
  },
  async (args, extra) => {
    const result = await extractImageFromBase64(args);
    return result;
  }
);

// Add extract_pdf_from_file tool
server.tool(
  "extract_pdf_from_file",
  "Extract and analyze a specific page from a local PDF file. Renders the PDF page as a high-quality image for visual content understanding, OCR text extraction, and document analysis. Returns total page count in metadata. Use focus_xyxy or focal_point to crop specific regions.",
  {
    file_path: z.string().describe("Path to the PDF file to analyze"),
    page: z.number().int().min(1).default(1).describe("Page number to extract (1-indexed, default: 1)"),
    resize: z.boolean().default(true).describe("For backward compatibility only. Images are always automatically resized to optimal dimensions (max 512x512) for LLM analysis"),
    max_width: z.number().default(512).describe("For backward compatibility only. Default maximum width is now 512px"),
    max_height: z.number().default(512).describe("For backward compatibility only. Default maximum height is now 512px"),
    focus_xyxy: z.array(z.number()).optional().describe("Optional focus rectangle [x1, y1, x2, y2]. Can be pixel coordinates (integers) or ratios (0.0-1.0)."),
    focal_point: z.array(z.number()).optional().describe("Optional focal point [centerX, centerY, halfWidth, halfHeight]. Can be pixel coordinates (integers) or ratios (0.0-1.0).")
  },
  async (args, extra) => {
    return await extractPdfFromFile(args);
  }
);

// Add extract_pdf_from_url tool
server.tool(
  "extract_pdf_from_url",
  "Extract and analyze a specific page from a PDF accessible via HTTP/HTTPS URL. Renders the PDF page as a high-quality image for visual content understanding, document analysis, and text extraction. Returns total page count in metadata. Use focus_xyxy or focal_point to crop specific regions.",
  {
    url: z.string().describe("URL of the PDF file to analyze"),
    page: z.number().int().min(1).default(1).describe("Page number to extract (1-indexed, default: 1)"),
    resize: z.boolean().default(true).describe("For backward compatibility only. Images are always automatically resized to optimal dimensions (max 512x512) for LLM analysis"),
    max_width: z.number().default(512).describe("For backward compatibility only. Default maximum width is now 512px"),
    max_height: z.number().default(512).describe("For backward compatibility only. Default maximum height is now 512px"),
    focus_xyxy: z.array(z.number()).optional().describe("Optional focus rectangle [x1, y1, x2, y2]. Can be pixel coordinates (integers) or ratios (0.0-1.0)."),
    focal_point: z.array(z.number()).optional().describe("Optional focal point [centerX, centerY, halfWidth, halfHeight]. Can be pixel coordinates (integers) or ratios (0.0-1.0).")
  },
  async (args, extra) => {
    return await extractPdfFromUrl(args);
  }
);

// Add extract_pdf_from_base64 tool
server.tool(
  "extract_pdf_from_base64",
  "Extract and analyze a specific page from a base64-encoded PDF. Ideal for processing PDFs from APIs, dynamically generated documents, or PDFs embedded in applications. Returns total page count in metadata. Use focus_xyxy or focal_point to crop specific regions.",
  {
    base64: z.string().describe("Base64-encoded PDF data"),
    page: z.number().int().min(1).default(1).describe("Page number to extract (1-indexed, default: 1)"),
    resize: z.boolean().default(true).describe("For backward compatibility only. Images are always automatically resized to optimal dimensions (max 512x512) for LLM analysis"),
    max_width: z.number().default(512).describe("For backward compatibility only. Default maximum width is now 512px"),
    max_height: z.number().default(512).describe("For backward compatibility only. Default maximum height is now 512px"),
    focus_xyxy: z.array(z.number()).optional().describe("Optional focus rectangle [x1, y1, x2, y2]. Can be pixel coordinates (integers) or ratios (0.0-1.0)."),
    focal_point: z.array(z.number()).optional().describe("Optional focal point [centerX, centerY, halfWidth, halfHeight]. Can be pixel coordinates (integers) or ratios (0.0-1.0).")
  },
  async (args, extra) => {
    return await extractPdfFromBase64(args);
  }
);

// Add unified read_visual tool (recommended - auto-detects file/URL/base64 and image/PDF)
server.tool(
  "read_visual",
  "Analyze visual content from any source: local files, URLs, or base64 data. Automatically detects source type and content format (images or PDFs). For PDFs, renders the specified page as a high-quality image. Returns image data suitable for LLM visual analysis, OCR, and object recognition. Use focus_xyxy or focal_point to crop specific regions for detail or to reduce token usage.",
  {
    source: z.string().describe("The visual content source. Can be: 1) A local file path (e.g., 'C:\\images\\photo.png' or '/home/user/doc.pdf'), 2) A URL (e.g., 'https://example.com/image.jpg'), or 3) Base64-encoded data (raw base64 string or data URL like 'data:image/png;base64,...'). Automatically detects PDFs by extension, content-type, or magic bytes."),
    page: z.number().int().min(1).default(1).optional().describe("For PDFs only: page number to render (1-indexed, default: 1). Ignored for images."),
    dpi: z.number().int().min(72).max(600).default(150).optional().describe("For PDFs only: rendering resolution in DPI (default: 150). Higher values produce sharper text but larger images. Ignored for images."),
    focus_xyxy: z.array(z.number()).optional().describe("Optional focus rectangle [x1, y1, x2, y2]. Can be pixel coordinates (integers) or ratios (0.0-1.0). Useful for cropping to a specific region of interest."),
    focal_point: z.array(z.number()).optional().describe("Optional focal point [centerX, centerY, halfWidth, halfHeight]. Can be pixel coordinates (integers) or ratios (0.0-1.0). Useful for focusing on a specific area."),
    mime_type: z.string().default("image/png").optional().describe("Hint for raw base64 data when auto-detection fails. Examples: 'image/png', 'image/jpeg', 'application/pdf'. Usually not needed as format is auto-detected.")
  },
  async (args, extra) => {
    return await readVisual(args);
  }
);

// Start the server using stdio transport
const transport = new StdioServerTransport();
server.connect(transport).catch((error: unknown) => {
  console.error('Error starting MCP server:', error);
  process.exit(1);
});

// Log version to stderr so it doesn't interfere with MCP protocol on stdout
console.error(`MCP Image Extractor v${packageVersion} started`); 