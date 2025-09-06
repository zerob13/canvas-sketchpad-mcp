import { randomUUID } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import * as net from "node:net";
import * as path from "node:path";
import * as url from "node:url";
import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// === Schema Definitions ===

// DrawCanvasArgsSchema: Parameters for drawing on canvas using DSL
const DrawCanvasArgsSchema = z.object({
  commands: z.array(z.string()).describe('Array of DSL commands to execute on the canvas. ' +
                                        'Each command follows the pattern: command(param1;param2;...). ' +
                                        'Supported commands: s (set styles), l (line), r (rectangle), fr (filled rectangle), ' +
                                        'c (circle), fc (filled circle), t (text), p (path), clear, action (clickable area). ' +
                                        'Example: ["s(sc:#FF0000;lw:3)", "l(10,10;100,100)", "fr(50,50;100,80;fc:#0066CC)"]')
});

// Node.js port detection
async function findAvailablePort(startPort: number = 3100): Promise<number> {
	for (let port = startPort; port < startPort + 100; port++) {
		try {
			await new Promise<void>((resolve, reject) => {
				const server = net.createServer();
				server.listen(port, "localhost", () => {
					server.close(() => resolve());
				});
				server.on("error", reject);
			});
			return port;
		} catch (_error) {
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
	status: "pending" | "sent" | "executed" | "error";
	sessionId?: string;
	error?: string;
	clientIds?: string[]; // Track which clients received the command
}

interface WebSocketClient {
	id: string;
	ws: WebSocket;
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
			status: "pending",
			sessionId,
			clientIds: [],
		};

		this.commands.set(id, command);

		// Commands remain pending until consumed by frontend
		// Don't change status here - let frontend consume and confirm
		console.log(`📝 Command queued: ${id} (${commands.split('\n').length} commands)`);

		return id;
	}

	private broadcastCommand(command: CanvasCommand): number {
		const message = {
			type: "canvas-command",
			data: {
				id: command.id,
				commands: command.commands,
				timestamp: command.timestamp,
			},
		};

		let sentCount = 0;

		// Send to WebSocket clients
		for (const [clientId, client] of this.wsClients) {
			try {
				if (client.ws.readyState === WebSocket.OPEN) {
					client.ws.send(JSON.stringify(message));
					sentCount++;
					command.clientIds?.push(clientId);
				} else {
					// Remove disconnected client
					this.wsClients.delete(clientId);
				}
			} catch (error) {
				console.error(
					`Failed to send command to WebSocket client ${clientId}:`,
					error,
				);
				// Remove disconnected client
				this.wsClients.delete(clientId);
			}
		}

		return sentCount;
	}

	addWebSocketClient(
		clientId: string,
		ws: WebSocket,
		sessionId?: string,
	): void {
		this.wsClients.set(clientId, {
			id: clientId,
			ws,
			sessionId,
			connectedAt: Date.now(),
		});
		console.log(`WebSocket client connected: ${clientId}`);

		// Associate client with session if sessionId is provided
		if (sessionId) {
			sessionManager.addClientToSession(sessionId, clientId);
		}

		// Send any pending commands to the new client
		for (const command of this.commands.values()) {
			if (command.status === "pending") {
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
			total: this.wsClients.size,
		};
	}

	updateCommandStatus(
		commandId: string,
		status: CanvasCommand["status"],
		error?: string,
	): boolean {
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

	// Get all pending commands for frontend consumption
	getPendingCommands(): CanvasCommand[] {
		return Array.from(this.commands.values())
			.filter(cmd => cmd.status === "pending")
			.sort((a, b) => a.timestamp - b.timestamp); // Oldest first
	}

	// Mark command as consumed and executed
	markCommandConsumed(commandId: string): boolean {
		const command = this.commands.get(commandId);
		if (command && command.status === "pending") {
			command.status = "executed";
			this.commands.set(commandId, command);
			console.log(`✅ Command consumed: ${commandId}`);
			return true;
		}
		return false;
	}

	// Clear all consumed commands
	clearConsumedCommands(): number {
		let cleared = 0;
		for (const [id, command] of this.commands.entries()) {
			if (command.status === "executed") {
				this.commands.delete(id);
				cleared++;
			}
		}
		if (cleared > 0) {
			console.log(`🧹 Cleared ${cleared} consumed commands`);
		}
		return cleared;
	}

	getCommandStats(): {
		total: number;
		pending: number;
		sent: number;
		executed: number;
		error: number;
	} {
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
			if (command.timestamp < oneHourAgo && command.status !== "pending") {
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

	createSession(
		sessionId: string,
		transport: StreamableHTTPServerTransport,
	): void {
		this.sessions.set(sessionId, {
			id: sessionId,
			transport,
			createdAt: Date.now(),
			lastActivity: Date.now(),
			clientIds: [],
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
			if (now - session.lastActivity < 5 * 60 * 1000) {
				// 5 minutes
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
function validateDSLCommands(commands: string[]): {
	isValid: boolean;
	errors: string[];
} {
	const errors: string[] = [];

	for (let i = 0; i < commands.length; i++) {
		const command = commands[i].trim();
		if (!command) {
			errors.push(`Command ${i + 1}: Empty command`);
			continue;
		}

		// Skip comments
		if (command.startsWith("//")) {
			continue;
		}

		// Basic command structure validation
		const commandPattern = /^(\w+)\([^)]*\)$/;
		if (!commandPattern.test(command)) {
			errors.push(`Command ${i + 1}: Invalid command syntax "${command}"`);
			continue;
		}

		// Extract command name
		const match = command.match(/^(\w+)\(/);
		if (match) {
			const commandName = match[1];
			const validCommands = [
				"s",
				"l",
				"r",
				"fr",
				"c",
				"fc",
				"t",
				"p",
				"clear",
				"action",
			];

			if (!validCommands.includes(commandName)) {
				errors.push(`Command ${i + 1}: Unknown command "${commandName}"`);
			}
		}
	}

	return {
		isValid: errors.length === 0,
		errors,
	};
}

// Express app setup for non-MCP endpoints
const expressApp = express();
expressApp.use(cors());
expressApp.use(express.json());

// Static file serving middleware
expressApp.use(express.static(path.join(process.cwd(), "src/public")));

// Command status updates from frontend
expressApp.post("/command-status", async (req, res) => {
	try {
		const { commandId, status, error } = req.body;
		const updated = commandManager.updateCommandStatus(
			commandId,
			status,
			error,
		);

		res.json({ success: updated });
	} catch (error) {
		res.status(400).json({ error: "Invalid request" });
	}
});

// Command stats endpoint
expressApp.get("/stats", (req, res) => {
	const stats = commandManager.getCommandStats();
	const recentCommands = commandManager.getRecentCommands(5);

	res.json({ stats, recentCommands });
});

// Get pending commands for frontend consumption
expressApp.get("/commands/pending", (req, res) => {
	try {
		const pendingCommands = commandManager.getPendingCommands();
		res.json({ 
			success: true, 
			commands: pendingCommands.map(cmd => ({
				id: cmd.id,
				commands: cmd.commands,
				timestamp: cmd.timestamp
			}))
		});
	} catch (error) {
		console.error("Error getting pending commands:", error);
		res.status(500).json({ success: false, error: "Failed to get pending commands" });
	}
});

// Mark command as consumed
expressApp.post("/commands/consume", async (req, res) => {
	try {
		const { commandId } = req.body;
		if (!commandId) {
			res.status(400).json({ success: false, error: "Command ID is required" });
			return;
		}

		const consumed = commandManager.markCommandConsumed(commandId);
		if (consumed) {
			res.json({ success: true, message: "Command marked as consumed" });
		} else {
			res.status(404).json({ success: false, error: "Command not found or already consumed" });
		}
	} catch (error) {
		console.error("Error consuming command:", error);
		res.status(500).json({ success: false, error: "Failed to consume command" });
	}
});

// Serve the main page for root requests
expressApp.get("/", (req, res) => {
	res.sendFile(path.join(process.cwd(), "src/public/index.html"));
});

// Create MCP server and transport
let mcpTransport: StreamableHTTPServerTransport;
let mcpServer: Server;

async function initializeMCPServer() {
	mcpTransport = new StreamableHTTPServerTransport({
		sessionIdGenerator: () => randomUUID(),
		onsessioninitialized: (sessionId) => {
			transports[sessionId] = mcpTransport;
			sessionManager.createSession(sessionId, mcpTransport);
		},
		enableDnsRebindingProtection: true,
		allowedHosts: [
			"127.0.0.1",
			"localhost",
			"127.0.0.1:3100",
			"localhost:3100",
		],
	});

	mcpTransport.onclose = () => {
		if (mcpTransport.sessionId) {
			delete transports[mcpTransport.sessionId];
			sessionManager.removeSession(mcpTransport.sessionId);
		}
	};

	mcpServer = new Server(
		{
			name: "canvas-mcp-server",
			version: "1.0.0",
		},
		{
			capabilities: {
				tools: {},
			},
		},
	);

	// Define available tools list
	mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
		return {
			tools: [
				{
					name: 'draw_canvas',
					description: 'Create interactive canvas drawings using a Domain Specific Language (DSL). This tool allows you to programmatically generate visual elements, diagrams, UI mockups, and illustrations on an HTML canvas. ' +
								'The drawing commands are executed in real-time and support interactive elements with click events. ' +
								'Perfect for creating visual explanations, diagrams, charts, user interface prototypes, and educational content. ' +
								'The canvas automatically scales to fit available space and provides immediate visual feedback. ' +
								'Use this when you need to visually demonstrate concepts, create diagrams, or build interactive visual content.',
					inputSchema: {
						type: "object",
						properties: {
							commands: {
								type: "array",
								items: {
									type: "string"
								},
								description: "Array of DSL commands to execute on the canvas. " +
											"Each command follows the pattern: command(param1;param2;...). " +
											"Supported commands: s (set styles), l (line), r (rectangle), fr (filled rectangle), " +
											"c (circle), fc (filled circle), t (text), p (path), clear, action (clickable area). " +
											"Example: [\"s(sc:#FF0000;lw:3)\", \"l(10,10;100,100)\", \"fr(50,50;100,80;fc:#0066CC)\"]"
							}
						},
						required: ["commands"],
						additionalProperties: false
					}
				}
			]
		};
	});

	// Handle tool calls
	mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
		try {
			const { name, arguments: args } = request.params;

			switch (name) {
				case 'draw_canvas':
					return await handleDrawCanvas(args);
				default:
					throw new Error(`Unknown tool: ${name}`);
			}
		} catch (error) {
			console.error('Error calling tool:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

			return {
				content: [{ type: 'text', text: `Error: ${errorMessage}` }],
				isError: true
			};
		}
	});

	// Helper function to handle draw_canvas tool
	async function handleDrawCanvas(args: unknown) {
		const parsed = DrawCanvasArgsSchema.safeParse(args);
		if (!parsed.success) {
			throw new Error(`draw_canvas arguments invalid: ${parsed.error}`);
		}

		const { commands } = parsed.data;

		// Validate DSL commands
		const validation = validateDSLCommands(commands);
		if (!validation.isValid) {
			return {
				content: [
					{
						type: "text",
						text: `❌ DSL Validation Errors:\n\n${validation.errors.join('\n')}\n\n📋 **DSL Syntax Reference:**\n` +
							  `- Commands: s (styles), l (line), r (rectangle), fr (filled rectangle), c (circle), fc (filled circle), t (text), p (path), clear, action\n` +
							  `- Format: command(param1;param2;...)\n` +
							  `- Coordinates: x,y\n` +
							  `- Colors: #RRGGBB or color names\n` +
							  `- Example: ["s(sc:red;lw:2)", "l(0,0;100,100)", "fr(20,20;60,60;fc:blue)"]\n\nPlease fix the syntax errors and try again.`
					}
				],
				isError: true
			};
		}

		// Convert commands array to string for storage (maintaining backward compatibility with frontend)
		const commandsString = commands.join('\n');
		const commandId = commandManager.addCommand(commandsString, mcpTransport.sessionId);
		const stats = commandManager.getCommandStats();
		const clientStats = commandManager.getConnectedClientsCount();
		
		// Commands are now cached in memory until consumed by frontend
		const statusMessage = `📦 Commands cached in memory for frontend consumption`;
		
		const port = await findAvailablePort(3100);
		
		// Count the number of commands (excluding empty and comment commands)
		const validCommands = commands.filter(cmd => cmd.trim() && !cmd.trim().startsWith('//'));
		const commandCount = validCommands.length;
		
		return {
			content: [
				{
					type: "text",
					text: `🎨 **Canvas Drawing Queued**\n\n${statusMessage}\n\n` +
						  `📋 **Command Details:**\n` +
						  `- Command ID: ${commandId}\n` +
						  `- Total Commands: ${commandCount}\n` +
						  `- Status: Cached and waiting for frontend consumption\n` +
						  `- Commands will persist until executed by the canvas\n\n` +
						  `📝 **Commands Queued:**\n\`\`\`json\n${JSON.stringify(commands, null, 2)}\n\`\`\`\n\n` +
						  `📊 **System Stats:** ${stats.total} total commands, ${stats.pending} pending, ${stats.executed} executed\n\n` +
						  `🌐 **View Your Drawing:** http://localhost:${port}\n\n` +
						  `The canvas commands have been cached in server memory. When you open the canvas page, ` +
						  `it will automatically fetch and execute all pending commands. Commands remain cached until successfully executed.`
				}
			]
		};
	}

	// Connect the server to the transport
	await mcpServer.connect(mcpTransport);
}

// Start the server
async function startServer() {
	const port = await findAvailablePort(3100);

	// Initialize MCP server
	await initializeMCPServer();

	// Create HTTP server that handles both MCP and Express requests
	const server = createServer(
		async (req: IncomingMessage, res: ServerResponse) => {
			const urlPath = req.url ? url.parse(req.url).pathname : "";

			// Handle MCP endpoints directly with native HTTP
			if (urlPath === "/mcp") {
				try {
					// Let the transport handle the request directly
					await mcpTransport.handleRequest(req, res);
				} catch (error) {
					console.error("Error handling MCP request:", error);
					res.statusCode = 500;
					res.setHeader("Content-Type", "application/json");
					res.end(
						JSON.stringify({
							jsonrpc: "2.0",
							error: {
								code: -32000,
								message: "Internal server error",
							},
							id: null,
						}),
					);
				}
				return;
			}

			// For all other requests, pass to Express
			expressApp(req as any, res as any);
		},
	);

	// Setup WebSocket server
	const wss = new WebSocketServer({
		server,
		path: "/ws",
	});

	wss.on("connection", (ws: WebSocket, _req) => {
		const clientId = randomUUID();
		commandManager.addWebSocketClient(clientId, ws);

		// Store client ID for cleanup
		(ws as any).clientId = clientId;

		ws.on("message", (data) => {
			// Handle incoming WebSocket messages (e.g., status updates)
			try {
				const message = JSON.parse(data.toString());
				if (message.type === "command-status") {
					const { commandId, status, error } = message;
					commandManager.updateCommandStatus(commandId, status, error);
				}
			} catch (error) {
				console.error("Failed to parse WebSocket message:", error);
			}
		});

		ws.on("close", () => {
			const clientId = (ws as any).clientId;
			if (clientId) {
				commandManager.removeWebSocketClient(clientId);
			}
		});

		ws.on("error", (error) => {
			console.error("WebSocket error:", error);
			const clientId = (ws as any).clientId;
			if (clientId) {
				commandManager.removeWebSocketClient(clientId);
			}
		});
	});

	server.listen(port, "localhost", () => {
		console.log(`🎨 Canvas MCP Service is running at http://localhost:${port}`);
		console.log(`📡 MCP endpoint available at http://localhost:${port}/mcp`);
		console.log(`🔌 WebSocket endpoint available at ws://localhost:${port}/ws`);
		console.log(`📡 SSE endpoint available at http://localhost:${port}/sse`);
	});

	// Periodic cleanup of old commands, disconnected clients, and inactive sessions
	setInterval(() => {
		const cleanedCommands = commandManager.cleanupOldCommands();
		if (cleanedCommands > 0) {
			console.log(`🧹 Cleaned up ${cleanedCommands} old commands`);
		}

		// Clean up consumed commands
		const cleanedConsumed = commandManager.clearConsumedCommands();

		const cleanedSessions = sessionManager.cleanupInactiveSessions();
		if (cleanedSessions > 0) {
			console.log(`🧹 Cleaned up ${cleanedSessions} inactive sessions`);
		}

		// Log connection stats periodically
		const clientStats = commandManager.getConnectedClientsCount();
		const sessionStats = sessionManager.getSessionStats();
		const stats = commandManager.getCommandStats();

		if (clientStats.total > 0 || sessionStats.total > 0 || stats.pending > 0) {
			console.log(
				`📊 Connected clients: ${clientStats.total} (${clientStats.websocket} WebSocket)`,
			);
			console.log(
				`📋 Active sessions: ${sessionStats.active}/${sessionStats.total}`,
			);
			console.log(
				`📝 Commands: ${stats.pending} pending, ${stats.executed} executed, ${stats.total} total`,
			);
		}
	}, 30000); // Every 30 seconds

	return server;
}

// Start the server
startServer().catch(console.error);
