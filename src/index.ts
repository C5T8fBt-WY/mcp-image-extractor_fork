#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
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

// Unified read_visual tool - auto-detects source type (file/URL/base64) and content format (image/PDF)
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