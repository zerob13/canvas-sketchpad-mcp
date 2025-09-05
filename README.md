# Canvas MCP Service

A **Model Context Protocol (MCP) service** that provides AI-driven canvas drawing capabilities through a Domain Specific Language (DSL). This service enables AI chatbots and programming tools to create interactive drawings and visualizations on HTML Canvas.

## 🎯 Features

- **MCP Integration**: Full Model Context Protocol support with StreamableHTTP transport
- **DSL Drawing Engine**: Custom domain-specific language for canvas operations
- **Interactive Canvas**: Real-time drawing with clickable areas and event handling
- **Auto Port Detection**: Automatic port selection starting from 3100
- **Modular Architecture**: Clean separation of concerns with TypeScript modules
- **Hot Reload**: Development mode with automatic reloading

## 🚀 Quick Start

### Prerequisites

- [Bun.js](https://bun.sh/) (latest version)
- Modern web browser with Canvas support

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd canvas-mcp

# Install dependencies
bun install
```

### Development

```bash
# Start development server with hot reload
bun run dev
```

### Production

```bash
# Build frontend assets
bun run build:frontend

# Start production server
bun run start
```

The service will automatically find an available port starting from 3100 and display the URL in the console.

## 📖 DSL Language Reference

### Basic Syntax
- Command format: `command(param1;param2;...)`
- Coordinate format: `x,y`
- Parameter separator: `;`
- Comments: `// comment text`

### Drawing Commands

| Command | Parameters | Description | Example |
|---------|------------|-------------|---------|
| `s` | `prop:value;...` | Set drawing styles | `s(sc:#FF0000;lw:3)` |
| `l` | `x1,y1;x2,y2` | Draw line | `l(10,10;100,100)` |
| `r` | `x,y;w,h` | Draw rectangle (stroke) | `r(50,50;100,80)` |
| `fr` | `x,y;w,h` | Draw filled rectangle | `fr(50,50;100,80)` |
| `c` | `x,y;radius` | Draw circle (stroke) | `c(200,200;50)` |
| `fc` | `x,y;radius` | Draw filled circle | `fc(200,200;50)` |
| `t` | `x,y;text` | Draw text | `t(50,60;Hello World)` |
| `p` | `x1,y1;x2,y2;...` | Draw path/polyline | `p(10,10;50,80;100,20)` |
| `clear` | none | Clear canvas | `clear()` |
| `action` | `x,y;w,h;eventName` | Register clickable area | `action(50,50;100,80;button_click)` |

### Style Properties
- `sc`: Stroke color
- `fc`: Fill color
- `lw`: Line width
- `f`: Font specification

### Example DSL Code

```javascript
// Set red stroke with line width 3
s(sc:#FF0000;lw:3)

// Draw a red line
l(50,50;200,100)

// Set blue fill color
s(fc:#0066CC)

// Draw filled rectangle
fr(80,120;120,60)

// Add clickable area
action(80,120;120,60;rect_clicked)
```

## 🔧 Architecture

### Project Structure

```
canvas-mcp/
├── src/
│   ├── index.ts           # Main server (HTTP + MCP)
│   └── public/            # Frontend assets
│       ├── index.html     # Main page
│       ├── main.ts        # Frontend entry point
│       └── modules/       # Modular TypeScript code
│           ├── types.ts   # Type definitions
│           ├── dom.ts     # DOM management
│           ├── state.ts   # State management
│           ├── parser.ts  # DSL parser
│           ├── renderer.ts # Canvas renderer
│           └── events.ts  # Event handling
├── subagents/             # Specialized agent configs
├── package.json
├── tsconfig.json
└── CLAUDE.md             # Development guide
```

### Technology Stack

- **Runtime**: Bun.js
- **Language**: TypeScript (strict mode)
- **Protocol**: MCP (Model Context Protocol)
- **Transport**: StreamableHTTP
- **Frontend**: Vanilla HTML/CSS/TypeScript
- **Styling**: Tailwind CSS

## 🔌 MCP Integration

The service provides a `draw_canvas` tool that can be used by MCP clients:

```json
{
  "name": "draw_canvas",
  "description": "Draw on HTML canvas using DSL commands",
  "inputSchema": {
    "type": "object",
    "properties": {
      "commands": {
        "type": "string",
        "description": "DSL commands to execute on canvas"
      }
    },
    "required": ["commands"]
  }
}
```

### Event System

The canvas supports interactive events sent via `postMessage`:

```javascript
{
  type: 'ai-canvas-event',
  payload: {
    eventName: 'button_click',
    timestamp: 1234567890,
    source: 'canvas-mcp'
  }
}
```

## 🛠️ Development

### Commands

```bash
# Development with hot reload
bun run dev

# Production build
bun run build:frontend

# Production server
bun run start
```

### Code Style

- TypeScript strict mode enabled
- Modular architecture with clean separation
- Comprehensive type definitions
- Error handling and validation

### Testing

- Test all DSL commands render correctly
- Verify event handling and message passing
- Validate port auto-detection functionality
- Check MCP protocol compliance

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the existing code style
4. Test your changes thoroughly
5. Submit a pull request

## 📝 License

[Your License Here]

## 🔗 Related Links

- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [Bun.js Documentation](https://bun.sh/docs)
- [HTML5 Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)

## 📞 Support

For questions and support, please [open an issue](../../issues) in this repository.