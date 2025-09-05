import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

// Improved port detection using Bun's built-in port availability check
async function findAvailablePort(startPort: number = 3100): Promise<number> {
  for (let port = startPort; port < startPort + 100; port++) {
    try {
      // Use Bun's built-in port availability check
      const server = Bun.listen({
        port,
        hostname: "localhost",
        socket: {
          open: () => {},
          data: () => {},
          close: () => {}
        }
      });
      server.stop();
      return port;
    } catch (error) {
      // Port is in use, continue to next port
      continue;
    }
  }
  
  throw new Error(`No available port found starting from ${startPort}`);
}

// Command storage and management
interface CanvasCommand {
  id: string;
  commands: string;
  timestamp: number;
  status: 'pending' | 'sent' | 'executed' | 'error';
  sessionId?: string;
  error?: string;
  clientIds?: string[]; // Track which clients received the command
}

interface WebSocketClient {
  id: string;
  ws: any; // Bun's ServerWebSocket type
  sessionId?: string;
  connectedAt: number;
}

class CommandManager {
  private commands: Map<string, CanvasCommand> = new Map();
  private wsClients: Map<string, WebSocketClient> = new Map();

  addCommand(commands: string, sessionId?: string): string {
    const id = randomUUID();
    const command: CanvasCommand = {
      id,
      commands,
      timestamp: Date.now(),
      status: 'pending',
      sessionId,
      clientIds: []
    };
    
    this.commands.set(id, command);
    
    // Try to send immediately to any connected clients
    const sentToClients = this.broadcastCommand(command);
    
    if (sentToClients > 0) {
      command.status = 'sent';
      this.commands.set(id, command);
    }
    
    return id;
  }

  private broadcastCommand(command: CanvasCommand): number {
    const message = {
      type: 'canvas-command',
      data: {
        id: command.id,
        commands: command.commands,
        timestamp: command.timestamp
      }
    };

    let sentCount = 0;

    // Send to WebSocket clients
    for (const [clientId, client] of this.wsClients) {
      try {
        client.ws.send(JSON.stringify(message));
        sentCount++;
        command.clientIds?.push(clientId);
      } catch (error) {
        console.error(`Failed to send command to WebSocket client ${clientId}:`, error);
        // Remove disconnected client
        this.wsClients.delete(clientId);
      }
    }

    return sentCount;
  }

  addWebSocketClient(clientId: string, ws: any, sessionId?: string): void {
    this.wsClients.set(clientId, {
      id: clientId,
      ws,
      sessionId,
      connectedAt: Date.now()
    });
    console.log(`WebSocket client connected: ${clientId}`);
    
    // Associate client with session if sessionId is provided
    if (sessionId) {
      sessionManager.addClientToSession(sessionId, clientId);
    }
    
    // Send any pending commands to the new client
    for (const command of this.commands.values()) {
      if (command.status === 'pending') {
        this.broadcastCommand(command);
      }
    }
  }

  removeWebSocketClient(clientId: string): void {
    this.wsClients.delete(clientId);
    console.log(`WebSocket client disconnected: ${clientId}`);
  }

  getConnectedClientsCount(): { websocket: number; total: number } {
    return {
      websocket: this.wsClients.size,
      total: this.wsClients.size
    };
  }

  updateCommandStatus(commandId: string, status: CanvasCommand['status'], error?: string): boolean {
    const command = this.commands.get(commandId);
    if (command) {
      command.status = status;
      if (error) command.error = error;
      this.commands.set(commandId, command);
      return true;
    }
    return false;
  }

  getCommand(commandId: string): CanvasCommand | undefined {
    return this.commands.get(commandId);
  }

  getRecentCommands(limit: number = 10): CanvasCommand[] {
    return Array.from(this.commands.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  getCommandStats(): { total: number; pending: number; sent: number; executed: number; error: number } {
    const stats = { total: 0, pending: 0, sent: 0, executed: 0, error: 0 };
    
    for (const command of this.commands.values()) {
      stats.total++;
      stats[command.status]++;
    }
    
    return stats;
  }

  // Clean up old commands (older than 1 hour)
  cleanupOldCommands(): number {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    let cleaned = 0;
    
    for (const [id, command] of this.commands.entries()) {
      if (command.timestamp < oneHourAgo && command.status !== 'pending') {
        this.commands.delete(id);
        cleaned++;
      }
    }
    
    return cleaned;
  }
}

// Session management
interface Session {
  id: string;
  transport: StreamableHTTPServerTransport;
  createdAt: number;
  lastActivity: number;
  clientIds: string[];
}

class SessionManager {
  private sessions: Map<string, Session> = new Map();

  createSession(sessionId: string, transport: StreamableHTTPServerTransport): void {
    this.sessions.set(sessionId, {
      id: sessionId,
      transport,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      clientIds: []
    });
    console.log(`📋 Session created: ${sessionId}`);
  }

  updateSessionActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
    }
  }

  addClientToSession(sessionId: string, clientId: string): void {
    const session = this.sessions.get(sessionId);
    if (session && !session.clientIds.includes(clientId)) {
      session.clientIds.push(clientId);
      session.lastActivity = Date.now();
    }
  }

  removeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    console.log(`📋 Session terminated: ${sessionId}`);
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  cleanupInactiveSessions(timeoutMs: number = 30 * 60 * 1000): number {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > timeoutMs) {
        this.sessions.delete(sessionId);
        cleaned++;
        console.log(`🧹 Cleaned up inactive session: ${sessionId}`);
      }
    }
    
    return cleaned;
  }

  getSessionStats(): { total: number; active: number } {
    const now = Date.now();
    let active = 0;
    
    for (const session of this.sessions.values()) {
      if (now - session.lastActivity < 5 * 60 * 1000) { // 5 minutes
        active++;
      }
    }
    
    return { total: this.sessions.size, active };
  }
}

// Global instances
const commandManager = new CommandManager();
const sessionManager = new SessionManager();

// Map to store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

// DSL Command validation
function validateDSLCommands(commands: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const lines = commands.split('\n').filter(line => line.trim() && !line.trim().startsWith('//'));
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Basic command structure validation
    const commandPattern = /^(\w+)\([^)]*\)$/;
    if (!commandPattern.test(line)) {
      errors.push(`Line ${i + 1}: Invalid command syntax "${line}"`);
      continue;
    }
    
    // Extract command name
    const match = line.match(/^(\w+)\(/);
    if (match) {
      const commandName = match[1];
      const validCommands = ['s', 'l', 'r', 'fr', 'c', 'fc', 't', 'p', 'clear', 'action'];
      
      if (!validCommands.includes(commandName)) {
        errors.push(`Line ${i + 1}: Unknown command "${commandName}"`);
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

const port = await findAvailablePort(3100);

console.log(`🎨 Starting Canvas MCP Service on port ${port}`);

// Create the server
const server = Bun.serve({
  port: port,
  websocket: {
    open(ws) {
      const clientId = randomUUID();
      commandManager.addWebSocketClient(clientId, ws);
      ws.data = { clientId };
    },
    message(ws, message) {
      // Handle incoming WebSocket messages (e.g., status updates)
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'command-status') {
          const { commandId, status, error } = data;
          commandManager.updateCommandStatus(commandId, status, error);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    },
    close(ws) {
      const clientId = (ws.data as any)?.clientId;
      if (clientId) {
        commandManager.removeWebSocketClient(clientId);
      }
    }
  },
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    // Handle WebSocket upgrade requests
    if (url.pathname === '/ws') {
      if (req.headers.get("upgrade") === "websocket") {
        const success = server.upgrade(req);
        if (success) {
          return new Response(null, { status: 101 });
        }
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return new Response("Expected websocket", { status: 400 });
    }


    // Handle command status updates from frontend
    if (url.pathname === '/command-status' && req.method === 'POST') {
      try {
        const { commandId, status, error } = await req.json();
        const updated = commandManager.updateCommandStatus(commandId, status, error);
        
        return new Response(JSON.stringify({ success: updated }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Handle command stats endpoint
    if (url.pathname === '/stats' && req.method === 'GET') {
      const stats = commandManager.getCommandStats();
      const recentCommands = commandManager.getRecentCommands(5);
      
      return new Response(JSON.stringify({ stats, recentCommands }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Handle MCP endpoints
    if (url.pathname === '/mcp') {
      if (req.method === 'POST') {
        // Handle POST requests for client-to-server communication
        const sessionId = req.headers.get('mcp-session-id') || undefined;
        let transport: StreamableHTTPServerTransport;

        const body = await req.json();

        if (sessionId && transports[sessionId]) {
          // Reuse existing transport
          transport = transports[sessionId];
        } else if (!sessionId && isInitializeRequest(body)) {
          // New initialization request
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sessionId) => {
              // Store the transport by session ID
              transports[sessionId] = transport;
              // Create session in session manager
              sessionManager.createSession(sessionId, transport);
            },
            enableDnsRebindingProtection: true,
            allowedHosts: ['127.0.0.1', 'localhost'],
          });

          // Clean up transport when closed
          transport.onclose = () => {
            if (transport.sessionId) {
              delete transports[transport.sessionId];
              sessionManager.removeSession(transport.sessionId);
            }
          };

          const mcpServer = new McpServer({
            name: "canvas-mcp-server",
            version: "1.0.0"
          }, {
            capabilities: {
              tools: {}
            }
          });

          // Register canvas drawing tool using the correct MCP SDK method
          mcpServer.tool("draw_canvas", "Draw on HTML canvas using DSL commands. Commands are sent to frontend in real-time via WebSocket/SSE.", { commands: { type: "string", description: "DSL commands to execute on the canvas" } }, async ({ commands }) => {
              if (!commands || typeof commands !== 'string') {
                return {
                  content: [
                    {
                      type: "text",
                      text: "Error: No commands provided or invalid command format."
                    }
                  ],
                  isError: true
                };
              }

              // Validate DSL commands
              const validation = validateDSLCommands(commands);
              if (!validation.isValid) {
                return {
                  content: [
                    {
                      type: "text",
                      text: `DSL Validation Errors:\n${validation.errors.join('\n')}\n\nPlease check your command syntax and try again.`
                    }
                  ],
                  isError: true
                };
              }

              // Add command to queue and broadcast to frontend
              const commandId = commandManager.addCommand(commands, transport.sessionId);
              const stats = commandManager.getCommandStats();
              const clientStats = commandManager.getConnectedClientsCount();
              
              let statusMessage: string;
              if (clientStats.total > 0) {
                statusMessage = `✅ Commands sent to ${clientStats.total} connected client(s) (${clientStats.websocket} WebSocket)`;
              } else {
                statusMessage = `⚠️  No clients connected. Commands queued and will execute when frontend connects.`;
              }
              
              return {
                content: [
                  {
                    type: "text",
                    text: `${statusMessage}\n\n**Command ID:** ${commandId}\n\n**Commands:**\n\`\`\`\n${commands}\n\`\`\`\n\n**Command Stats:** ${stats.total} total, ${stats.pending} pending, ${stats.executed} executed\n\n🌐 **View the results:** http://localhost:${port}\n\nThe commands have been sent to the frontend Canvas application in real-time. If the frontend is not currently open, the commands will be queued and executed when it connects.`
                  }
                ]
              };
          });

          // Connect to the MCP server BEFORE handling the request
          await mcpServer.connect(transport);
        } else {
          // Invalid request
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: No valid session ID provided',
            },
            id: null,
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Handle the request using transport
        try {
          // For POST requests, we need to handle the response manually
          const response = new Response();
          await transport.handleRequest(req, response, body);
          return response;
        } catch (error) {
          console.error('Error handling MCP request:', error);
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Internal server error',
            },
            id: null,
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      } else if (req.method === 'GET') {
        // Handle GET requests for server-to-client notifications via SSE
        const sessionId = req.headers.get('mcp-session-id');
        if (!sessionId || !transports[sessionId]) {
          return new Response('Invalid or missing session ID', { status: 400 });
        }

        const transport = transports[sessionId];
        try {
          const response = new Response();
          await transport.handleRequest(req, response);
          return response;
        } catch (error) {
          console.error('Error handling GET request:', error);
          return new Response('Internal server error', { status: 500 });
        }
      } else if (req.method === 'DELETE') {
        // Handle DELETE requests for session termination
        const sessionId = req.headers.get('mcp-session-id');
        if (!sessionId || !transports[sessionId]) {
          return new Response('Invalid or missing session ID', { status: 400 });
        }

        const transport = transports[sessionId];
        try {
          const response = new Response();
          await transport.handleRequest(req, response);
          return response;
        } catch (error) {
          console.error('Error handling DELETE request:', error);
          return new Response('Internal server error', { status: 500 });
        }
      }
    }

    // Serve static files
    const filePath = url.pathname === '/' ? '/index.html' : url.pathname;
    const file = Bun.file(`./src/public${filePath}`);

    if (await file.exists()) {
      return new Response(file);
    }

    return new Response("Not Found", { status: 404 });
  }
});

console.log(`🦊 Canvas MCP Service is running at http://localhost:${server.port}`);
console.log(`📡 MCP endpoint available at http://localhost:${server.port}/mcp`);
console.log(`🔌 WebSocket endpoint available at ws://localhost:${server.port}/ws`);
console.log(`📡 SSE endpoint available at http://localhost:${server.port}/sse`);

// Periodic cleanup of old commands, disconnected clients, and inactive sessions
setInterval(() => {
  const cleanedCommands = commandManager.cleanupOldCommands();
  if (cleanedCommands > 0) {
    console.log(`🧹 Cleaned up ${cleanedCommands} old commands`);
  }
  
  const cleanedSessions = sessionManager.cleanupInactiveSessions();
  if (cleanedSessions > 0) {
    console.log(`🧹 Cleaned up ${cleanedSessions} inactive sessions`);
  }
  
  // Log connection stats periodically
  const clientStats = commandManager.getConnectedClientsCount();
  const sessionStats = sessionManager.getSessionStats();
  
  if (clientStats.total > 0 || sessionStats.total > 0) {
    console.log(`📊 Connected clients: ${clientStats.total} (${clientStats.websocket} WebSocket)`);
    console.log(`📋 Active sessions: ${sessionStats.active}/${sessionStats.total}`);
  }
}, 30000); // Every 30 seconds