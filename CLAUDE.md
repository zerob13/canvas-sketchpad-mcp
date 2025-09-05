# Canvas MCP Service - Claude Code Configuration

## Project Overview

Canvas MCP Service is an AI drawing draft service based on MCP (Model Context Protocol), providing HTML Canvas drawing capabilities, supporting drawing operations driven by DSL (Domain Specific Language) commands.

## Technology Stack

- **Runtime**: Node.js
- **Language**: TypeScript  
- **Protocol**: MCP (Model Context Protocol)
- **Transport**: StreamableHTTP
- **Server**: Express.js
- **WebSocket**: ws library
- **Frontend**: Native HTML/CSS/TypeScript + Tailwind CSS

## Project Structure

```
canvas-mcp/
├── src/
│   ├── index.ts           # Main server file (HTTP + MCP)
│   ├── public/            # Frontend static files
│   │   ├── index.html     # Main page
│   │   ├── main.ts        # Frontend main logic
│   │   ├── modules/       # Modular frontend code
│   │   │   ├── dom.ts     # DOM manager
│   │   │   ├── state.ts   # State manager  
│   │   │   ├── parser.ts  # DSL parser
│   │   │   ├── renderer.ts # Renderer
│   │   │   └── events.ts  # Event handler
│   │   └── dist/          # Build output directory
├── subagents/             # Subagent configurations
├── package.json
├── tsconfig.json
└── CLAUDE.md
```

## Development Commands

```bash
# Development mode (hot reload)
npm run dev

# Production build
npm run build

# Build frontend only
npm run build:frontend

# Build all (backend + frontend)
npm run build:all

# Production run
npm start
```

## Port Configuration

The service automatically detects available ports starting from port 3100, ensuring no conflicts.

## DSL Language Specification

### Basic Syntax
- Command format: `command(param1;param2;...)`
- Coordinate format: `x,y`
- Parameter separator: `;`
- Comments: `// comment content`

### Supported Commands

| Command | Parameters | Description | Example |
|---------|------------|-------------|---------|
| `s` | `prop:value;prop:value;...` | Set styles | `s(sc:#FF0000;lw:3)` |
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
- `f`: Font

## MCP Tool Integration

The service provides a `draw_canvas` tool that supports:
- Receiving DSL command strings
- Real-time rendering in browser
- Interactive event handling

## Event System

Canvas supports click events, sent to parent window via `window.parent.postMessage`:

```javascript
{
  type: 'ai-canvas-event',
  payload: {
    eventName: 'button_click',
    timestamp: 1234567890
  }
}
```

## Development Best Practices

### Code Standards
- Use TypeScript strict mode
- Follow modular design principles
- Keep code clean and readable

### Testing
- Ensure all DSL commands parse and render correctly
- Test event handling and message passing
- Verify port auto-detection functionality

### Debugging
- Use browser developer tools for frontend debugging
- Check MCP protocol message interactions
- Monitor server log output

## Subagent System

The project uses multiple specialized subagents to handle different development tasks:

- `canvas-frontend-agent`: Frontend Canvas development expert
- `mcp-protocol-agent`: MCP protocol implementation expert  
- `dsl-parser-agent`: DSL syntax parsing expert
- `ui-interaction-agent`: UI interaction and event handling expert

See configuration files in the `subagents/` directory for details.