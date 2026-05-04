#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import * as http from 'http';
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

const TOOL_DESCRIPTION =
  "MCP server for analyzing images and PDF documents from files and URLs for visual content understanding, text extraction (OCR), and object recognition in screenshots, photos, and PDF pages";

const READ_VISUAL_DESCRIPTION =
  "Analyze visual content from local files or URLs. Automatically detects content format (images or PDFs). For PDFs, renders the specified page as a high-quality image. Returns image data suitable for LLM visual analysis, OCR, and object recognition. Use focus_xyxy or focal_point to crop specific regions for detail or to reduce token usage.";

const READ_VISUAL_SCHEMA = {
  source: z.string().describe("The visual content source. Can be: 1) A local file path (e.g., 'C:\\images\\photo.png' or '/home/user/doc.pdf'), or 2) A URL (e.g., 'https://example.com/image.jpg'). Automatically detects PDFs by extension, content-type, or magic bytes."),
  page: z.number().int().min(1).default(1).optional().describe("For PDFs only: page number to render (1-indexed, default: 1). Ignored for images."),
  dpi: z.number().int().min(72).max(600).default(150).optional().describe("For PDFs only: rendering resolution in DPI (default: 150). Higher values produce sharper text but larger images. Ignored for images."),
  focus_xyxy: z.array(z.number()).optional().describe("Optional focus rectangle [x1, y1, x2, y2]. Can be pixel coordinates (integers) or ratios (0.0-1.0). Useful for cropping to a specific region of interest."),
  focal_point: z.array(z.number()).optional().describe("Optional focal point [centerX, centerY, halfWidth, halfHeight]. Can be pixel coordinates (integers) or ratios (0.0-1.0). Useful for focusing on a specific area."),
};

/**
 * Factory: creates a fully configured MCP server instance.
 * Called once per stdio session, or once per SSE connection in HTTP mode.
 */
function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "mcp-image-extractor",
    description: TOOL_DESCRIPTION,
    version: packageVersion,
  });

  server.tool(
    "read_visual",
    READ_VISUAL_DESCRIPTION,
    READ_VISUAL_SCHEMA,
    async (args) => {
      return await readVisual(args);
    }
  );

  return server;
}

// ── Transport selection ───────────────────────────────────────────────────────

const httpPort = process.env.MCP_HTTP_PORT
  ? parseInt(process.env.MCP_HTTP_PORT, 10)
  : null;

if (httpPort) {
  // ── HTTP / SSE mode ─────────────────────────────────────────────────────────
  // Use this when running on a remote machine (SSH server, Docker container, etc.)
  // VS Code connects via: { "type": "sse", "url": "http://<host>:<port>/sse" }
  //
  // SSH tunnel example:
  //   On remote: MCP_HTTP_PORT=3100 node dist/index.js
  //   Tunnel:    ssh -L 3100:localhost:3100 user@remote
  //   VS Code:   { "url": "http://localhost:3100/sse" }

  const activeSessions = new Map<string, { transport: SSEServerTransport; server: McpServer }>();

  function readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk: Buffer | string) => { data += chunk; });
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });
  }

  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${httpPort}`);

    // CORS headers so browser-based tools can connect
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET' && url.pathname === '/sse') {
      // Open a new SSE connection and bind an MCP server instance to it
      const transport = new SSEServerTransport('/messages', res);
      const server = createMcpServer();
      const sessionId = transport.sessionId;

      activeSessions.set(sessionId, { transport, server });

      res.on('close', () => {
        activeSessions.delete(sessionId);
        server.close().catch(() => { /* ignore */ });
        transport.close().catch(() => { /* ignore */ });
      });

      await server.connect(transport);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/messages') {
      const sessionId = url.searchParams.get('sessionId') ?? '';
      const session = activeSessions.get(sessionId);

      if (!session) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Session not found' }));
        return;
      }

      let parsedBody: unknown;
      try {
        const raw = await readBody(req);
        parsedBody = raw ? JSON.parse(raw) : undefined;
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        return;
      }

      await session.transport.handlePostMessage(req, res, parsedBody);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', version: packageVersion }));
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  httpServer.listen(httpPort, () => {
    console.error(`MCP Image Extractor v${packageVersion} — HTTP/SSE mode`);
    console.error(`  SSE endpoint : http://localhost:${httpPort}/sse`);
    console.error(`  Health check : http://localhost:${httpPort}/health`);
    console.error(`  Sessions     : ${activeSessions.size} active`);
  });

} else {
  // ── Stdio mode (default) ────────────────────────────────────────────────────
  // Used when VS Code spawns the process locally via { "command": "node", ... }
  const transport = new StdioServerTransport();
  createMcpServer().connect(transport).catch((error: unknown) => {
    console.error('Error starting MCP server:', error);
    process.exit(1);
  });

  // Log to stderr so it doesn't corrupt the MCP stdio stream
  console.error(`MCP Image Extractor v${packageVersion} started (stdio)`);
} 