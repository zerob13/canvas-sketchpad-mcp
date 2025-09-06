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

- [Node.js](https://nodejs.org/) (v18 or higher)
- Modern web browser with Canvas support

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd canvas-mcp

# Install dependencies
npm install
```

### Development

```bash
# Start development server with hot reload
npm run dev
```

### Production

```bash
# Build frontend assets
npm run build:frontend

# Start production server
npm start
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

- **Runtime**: Node.js with Express
- **Language**: TypeScript (strict mode)
- **Protocol**: MCP (Model Context Protocol)
- **Transport**: StreamableHTTP
- **Frontend**: Vanilla HTML/CSS/TypeScript
- **Styling**: Tailwind CSS

## 🔌 MCP Integration

The service provides a comprehensive `draw_canvas` tool that can be used by MCP clients:

```json
{
  "name": "draw_canvas",
  "description": "Create interactive canvas drawings using a Domain Specific Language (DSL). This tool allows you to programmatically generate visual elements, diagrams, UI mockups, and illustrations on an HTML canvas. The drawing commands are executed in real-time and support interactive elements with click events. Perfect for creating visual explanations, diagrams, charts, user interface prototypes, and educational content.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "commands": {
        "type": "string", 
        "description": "DSL commands to execute on the canvas. Multiple commands can be combined using newlines. Each command follows the pattern: command(param1;param2;...). Supported commands: s (set styles), l (line), r (rectangle), fr (filled rectangle), c (circle), fc (filled circle), t (text), p (path), clear, action (clickable area). Example: 's(sc:#FF0000;lw:3)\nl(10,10;100,100)\nfr(50,50;100,80;fc:#0066CC)'"
      }
    },
    "required": ["commands"]
  }
}
```

### Usage Examples

**Basic Drawing:**
```javascript
// Create a simple diagram
s(sc:#333333;lw:2;f:16px Arial)
l(50,50;200,150)
r(70,70;60,40)
fc(150,100;25;fc:#FF6B6B)
t(80,120;Simple Diagram)
```

**Interactive UI Mockup:**
```javascript
// Create interactive buttons
s(fc:#4ECDC4;sc:#45B7B0;lw:2)
fr(50,50;120,40;fc:#4ECDC4)
s(fc:white)
t(60,75;Submit Button)
action(50,50;120,40;submit_clicked)

s(fc:#FF6B6B;sc:#EE5A52;lw:2)  
fr(200,50;120,40;fc:#FF6B6B)
s(fc:white)
t(210,75;Cancel Button)
action(200,50;120,40;cancel_clicked)
```

**Complex Diagram:**
```javascript
// Flowchart elements
s(sc:#2C3E50;lw:3;f:14px Arial)

// Process boxes
fr(100,50;120,60;fc:#3498DB)
t(110,80;Start Process)

fr(100,150;120,60;fc:#2ECC71)  
t(110,180;Processing)

fr(100,250;120,60;fc:#E74C3C)
t(110,280;End Process)

// Connector lines
s(sc:#7F8C8D;lw:2)
l(160,110;160,150)
l(160,210;160,250)

// Decision diamond
s(sc:#F39C12;lw:2;fc:#FDE3A7)
p(250,150;280,180;250,210;220,180;250,150)
t(240,190;Decision)
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
npm run dev

# Production build
npm run build:frontend

# Production server
npm start
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

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

MIT License allows you to:
- ✅ Use the software for commercial purposes
- ✅ Modify and distribute the software
- ✅ Use the software privately
- ✅ Include the software in larger projects

The only requirement is to include the copyright notice and license text in any copy of the software.

## 🔗 Related Links

- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [Node.js Documentation](https://nodejs.org/docs/)
- [Express.js Documentation](https://expressjs.com/)
- [HTML5 Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)

## 📞 Support

For questions and support, please [open an issue](../../issues) in this repository.