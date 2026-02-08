# MCP Image Extractor (Enhanced Fork)

Enhanced MCP server for extracting and converting images to base64 for LLM analysis with **configurable quality settings**.

## What's New in This Fork

- **Focus Feature** - Crop specific regions of images for better detail and reduced token usage
- **Configurable Processing** - Control image dimensions and quality via environment variables  
- **Increased Limits** - 50MB default download limit (vs 10MB in original)  
- **Better Documentation** - Comprehensive guides for optimization  
- **Active Maintenance** - Regular updates and improvements

## Features

This MCP server provides tools for AI assistants to:
- Extract images from local files
- Extract images from URLs  
- Process base64-encoded images
- **NEW**: Focus on specific image regions (`focus_xyxy`, `focal_point`)
- **NEW**: Configurable dimensions (512×512 to 1568×1568)
- **NEW**: Adjustable compression quality
- **NEW**: Environment variable configuration

## Installation

### Recommended: Using npx (Easiest)

```json
{
  "mcpServers": {
    "image-extractor": {
      "command": "npx",
      "args": ["-y", "@c5t8fbt-wy/mcp-image-extractor"],
      "env": {
        "DEFAULT_MAX_WIDTH": "1024",
        "DEFAULT_MAX_HEIGHT": "1024",
        "COMPRESSION_QUALITY": "90"
      }
    }
  }
}
```

### Alternative: Local Installation

```bash
# Clone your fork
git clone https://github.com/C5T8fBt-WY/mcp-image-extractor_fork.git
cd mcp-image-extractor_fork
npm install
npm run build
```

Then configure:

```json
{
  "mcpServers": {
    "image-extractor": {
      "command": "node",
      "args": ["c:/path/to/mcp-image-extractor_fork/dist/index.js"],
      "env": {
        "DEFAULT_MAX_WIDTH": "1024",
        "COMPRESSION_QUALITY": "90"
      }
    }
  }
}
```

## Configuration Options

### Environment Variables

| Variable                | Default    | Description                       |
| ----------------------- | ---------- | --------------------------------- |
| `DEFAULT_MAX_WIDTH`     | `512`      | Maximum image width (pixels)      |
| `DEFAULT_MAX_HEIGHT`    | `512`      | Maximum image height (pixels)     |
| `COMPRESSION_QUALITY`   | `80`       | JPEG/WebP quality (1-100)         |
| `PNG_COMPRESSION_LEVEL` | `9`        | PNG compression (0-9, lossless)   |
| `MAX_IMAGE_SIZE`        | `52428800` | Max download size (50MB in bytes) |
| `ALLOWED_DOMAINS`       | Empty      | Comma-separated allowed domains   |

### Quality Presets

#### Minimal Context Usage (Default)
```json
"env": {
  "DEFAULT_MAX_WIDTH": "512",
  "DEFAULT_MAX_HEIGHT": "512",
  "COMPRESSION_QUALITY": "80"
}
```
**Best for:** Processing many images, limited context

#### Balanced Quality
```json
"env": {
  "DEFAULT_MAX_WIDTH": "768",
  "DEFAULT_MAX_HEIGHT": "768",
  "COMPRESSION_QUALITY": "85"
}
```
**Best for:** Reading small text, charts, diagrams

#### Maximum Quality (Claude-compatible)
```json
"env": {
  "DEFAULT_MAX_WIDTH": "1568",
  "DEFAULT_MAX_HEIGHT": "1568",
  "COMPRESSION_QUALITY": "90",
  "MAX_IMAGE_SIZE": "104857600"
}
```
**Best for:** Detailed screenshots, technical documentation

## Available Tools

### extract_image_from_file

Extract and analyze images from local file paths.

**Parameters:**
- `file_path` (required): Path to the image file
- `focus_xyxy` (optional): Rectangle `[x1, y1, x2, y2]` - pixels (int) or ratio (0.0-1.0)
- `focal_point` (optional): Center region `[centerX, centerY, halfWidth, halfHeight]` - pixels (int) or ratio (0.0-1.0)

**Examples:**
```
Analyze the test failure: test-results/checkout-failed.png

Focus on the error message in the top-right quarter:
focus_xyxy: [0.5, 0, 1, 0.25]

Focus on a specific button centered at coordinates (100, 200):
focal_point: [100, 200, 50, 30]
```

### extract_image_from_url

Extract and analyze images from web URLs.

**Parameters:**
- `url` (required): URL of the image
- `focus_xyxy` (optional): Rectangle `[x1, y1, x2, y2]` - pixels (int) or ratio (0.0-1.0)
- `focal_point` (optional): Center region `[centerX, centerY, halfWidth, halfHeight]` - pixels (int) or ratio (0.0-1.0)

**Examples:**
```
What's in this image? https://example.com/chart.png

Focus on the legend in bottom-left:
focus_xyxy: [0, 0.75, 0.3, 1]
```

### extract_image_from_base64

Process base64-encoded images.

**Parameters:**
- `base64` (required): Base64-encoded image data
- `mime_type` (optional, default: "image/png"): MIME type
- `focus_xyxy` (optional): Rectangle `[x1, y1, x2, y2]` - pixels (int) or ratio (0.0-1.0)
- `focal_point` (optional): Center region `[centerX, centerY, halfWidth, halfHeight]` - pixels (int) or ratio (0.0-1.0)

## Use Cases

✅ **Analyzing Playwright Test Results**
```
"Analyze this test failure screenshot: ./test-results/login-error.png"
```

✅ **Processing External Images**
```
"Extract the chart from https://reports.company.com/Q4-summary.png"
```

✅ **High-Resolution Screenshots**
- Supports large images (up to 50MB by default)
- Configurable output dimensions for quality control
- Automatic format detection and optimization

✅ **Focused Image Analysis**
```
"Read the small text in the upper-right corner of screenshot.png"
With focus_xyxy: [0.7, 0, 1, 0.2] for better OCR accuracy

"What's the score on the dashboard centered at 50% width, 30% height?"
With focal_point: [0.5, 0.3, 0.1, 0.1] to zoom into that specific widget
```

## Context Usage Examples

| Configuration | Dimensions | Approx Tokens | Use Case             |
| ------------- | ---------- | ------------- | -------------------- |
| Default       | 512×288    | ~900          | Quick analysis       |
| Balanced      | 768×432    | ~2,100        | Charts & diagrams    |
| Maximum       | 1568×882   | ~8,000        | Detailed screenshots |

## Troubleshooting

### "maxContentLength exceeded" Error

Increase the download limit:
```json
"env": {
  "MAX_IMAGE_SIZE": "104857600"
}
```

### Images Too Blurry

Increase dimensions:
```json
"env": {
  "DEFAULT_MAX_WIDTH": "1024",
  "DEFAULT_MAX_HEIGHT": "1024"
}
```

### "Unsupported image format" (BMP files)

BMP files with .png extension need conversion:
```powershell
# PowerShell
Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Image]::FromFile("path/to/file.png")
$bmp.Save("path/to/file_actual.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
```

## Publishing to npm

This fork is published as `@c5t8fbt-wy/mcp-image-extractor` on npm.

To publish updates:

```bash
# Update version in package.json
npm version patch  # or minor/major

# Build
npm run build

# Publish (requires npm login)
npm publish
```

## Differences from Original

| Feature                 | Original | This Fork     |
| ----------------------- | -------- | ------------- |
| Max download size       | 10MB     | 50MB          |
| Focus/crop regions      | ❌        | ✅             |
| Configurable dimensions | ❌        | ✅             |
| Configurable quality    | ❌        | ✅             |
| Environment vars        | Limited  | Full          |
| Documentation           | Basic    | Comprehensive |

## Development

```bash
# Install dependencies
npm install

# Run in dev mode
npm run dev

# Build
npm run build

# Run tests
npm test
```

## License

MIT

## Links

- **GitHub**: https://github.com/C5T8fBt-WY/mcp-image-extractor_fork
- **npm**: https://www.npmjs.com/package/@c5t8fbt-wy/mcp-image-extractor
- **Original**: https://github.com/ifmelate/mcp-image-extractor

## Credits

Based on [mcp-image-extractor](https://github.com/ifmelate/mcp-image-extractor) by [@ifmelate](https://github.com/ifmelate)

Enhanced with configurable settings and improved documentation by [@C5T8fBt-WY](https://github.com/C5T8fBt-WY)