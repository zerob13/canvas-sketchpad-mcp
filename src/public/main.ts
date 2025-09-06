// 主应用入口文件 - 初始化和协调各个模块

import { DOMManager } from "./modules/dom.js";
import { StateManager } from "./modules/state.js";
import { DSLParser } from "./modules/parser.js";
import { CanvasRenderer } from "./modules/renderer.js";
import { EventsManager } from "./modules/events.js";
import type { CanvasEvent } from "./modules/types.js";

class CanvasMCPApp {
	private domManager: DOMManager;
	private stateManager: StateManager;
	private dslParser: DSLParser;
	private canvasRenderer: CanvasRenderer;
	private eventsManager: EventsManager;
	private pollingInterval?: number;
	private commandQueue: string[] = [];

	constructor() {
		console.log("🎨 Initializing Canvas MCP Application");

		try {
			// 初始化各个管理器
			this.domManager = new DOMManager();
			this.stateManager = new StateManager();
			this.dslParser = new DSLParser();
			this.canvasRenderer = new CanvasRenderer(
				this.domManager.ctx,
				this.stateManager,
			);
			this.eventsManager = new EventsManager(
				this.domManager,
				this.stateManager,
			);

			// 设置事件监听
			this.setupEventListeners();

			// 开始轮询MCP命令
			this.startMCPPolling();

			console.log("✅ Canvas MCP Application initialized successfully");
			this.domManager.setConnectionStatus("connected");
		} catch (error) {
			console.error("❌ Failed to initialize Canvas MCP Application:", error);
			if (this.domManager) {
				this.domManager.setConnectionStatus("error");
				this.domManager.showMessage(
					"Application initialization failed: " + (error as Error).message,
					"error",
				);
			}
		}
	}

	private setupEventListeners(): void {
		// 清空画布按钮
		this.domManager.clearCanvasBtn.addEventListener("click", () => {
			this.clearCanvas();
		});

		// 清空历史按钮
		this.domManager.clearHistoryBtn.addEventListener("click", () => {
			this.clearHistory();
		});

		// Canvas点击事件处理
		this.domManager.canvas.addEventListener("click", (event) => {
			this.handleCanvasClick(event);
		});

		// 键盘快捷键
		document.addEventListener("keydown", (event) => {
			if (event.ctrlKey || event.metaKey) {
				switch (event.key) {
					case "k":
						event.preventDefault();
						this.clearCanvas();
						break;
					case "h":
						event.preventDefault();
						this.clearHistory();
						break;
				}
			}
		});
	}

	private async startMCPPolling(): void {
		this.domManager.setConnectionStatus("connecting");

		// 检查是否有待执行的命令（从localStorage或其他持久化存储）
		this.checkForPendingCommands();

		// 启动SSE连接以接收实时MCP命令
		this.startSSEConnection();

		// 保留定期检查作为后备机制
		this.pollingInterval = window.setInterval(() => {
			this.processPendingCommands();
		}, 5000); // 降低轮询频率，因为主要使用SSE
	}

	private startSSEConnection(): void {
		try {
			const eventSource = new EventSource("/sse");

			eventSource.onopen = () => {
				console.log("✅ SSE connection established");
				this.domManager.setConnectionStatus("connected");
			};

			eventSource.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);

					if (data.type === "canvas-command") {
						console.log("📡 Received command via SSE:", data.data);
						this.executeCommand(data.data.commands);

						// 发送状态更新回服务器
						this.sendCommandStatus(data.data.id, "executed");
					}

					if (data.type === "connection") {
						console.log("🔗 SSE connection confirmed:", data.data);
					}
				} catch (error) {
					console.error("Failed to parse SSE message:", error, event.data);
				}
			};

			eventSource.onerror = (error) => {
				console.error("SSE connection error:", error);
				this.domManager.setConnectionStatus("error");

				// 尝试重新连接
				setTimeout(() => {
					console.log("🔄 Attempting to reconnect SSE...");
					this.startSSEConnection();
				}, 3000);
			};

			// 存储eventSource以便后续清理
			(this as any)._eventSource = eventSource;
		} catch (error) {
			console.error("Failed to create SSE connection:", error);
			this.domManager.setConnectionStatus("error");
			this.domManager.showMessage(
				"Failed to connect to MCP server. Using fallback polling.",
				"warning",
			);
		}
	}

	private async sendCommandStatus(
		commandId: string,
		status: "executed" | "error",
		error?: string,
	): Promise<void> {
		try {
			const response = await fetch("/command-status", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ commandId, status, error }),
			});

			if (!response.ok) {
				console.warn("Failed to send command status:", await response.text());
			}
		} catch (error) {
			console.error("Error sending command status:", error);
		}
	}

	private checkForPendingCommands(): void {
		try {
			const savedCommands = localStorage.getItem("mcp-pending-commands");
			if (savedCommands) {
				const commands = JSON.parse(savedCommands) as string[];
				this.commandQueue.push(...commands);
				localStorage.removeItem("mcp-pending-commands");
			}
		} catch (error) {
			console.warn("Failed to load pending commands:", error);
		}
	}

	private processPendingCommands(): void {
		if (this.commandQueue.length > 0) {
			const command = this.commandQueue.shift();
			if (command) {
				this.executeCommand(command);
			}
		}
	}

	// 公共API方法 - 供外部MCP工具调用
	public executeCommand(commandString: string): void {
		console.log("📝 Executing DSL command:", commandString);

		this.domManager.addCommandToHistory(commandString, "executing");
		this.stateManager.addToHistory(commandString);

		try {
			// 解析命令
			const commands = this.dslParser.parse(commandString);
			let successCount = 0;

			// 执行每个命令
			for (const cmd of commands) {
				try {
					this.canvasRenderer.execute(cmd);
					successCount++;
				} catch (error) {
					console.error("Command execution error:", error);
					this.domManager.showMessage(
						`Command execution failed: ${(error as Error).message}`,
						"error",
					);
				}
			}

			// 更新状态显示
			this.updateStatusDisplay();

			// 更新历史状态为成功
			this.domManager.addCommandToHistory(commandString, "success");
			this.domManager.updateLastExecution(commandString);
			this.domManager.showMessage(
				`Executed ${successCount} commands successfully`,
				"success",
			);

			this.stateManager.setLastExecutionTime(Date.now());
		} catch (error) {
			console.error("DSL parsing error:", error);
			this.domManager.addCommandToHistory(commandString, "error");
			this.domManager.updateParseStatus("Parse Error", true);
			this.domManager.showMessage(
				`Parse error: ${(error as Error).message}`,
				"error",
			);
		}
	}

	private handleCanvasClick(event: MouseEvent): void {
		const coords = this.domManager.getCanvasCoordinates(event);
		const action = this.stateManager.getClickedAction(coords.x, coords.y);

		if (action) {
			console.log("🖱️ Canvas action triggered:", action.eventName);

			// 发送事件到父窗口（供MCP客户端接收）
			const canvasEvent: CanvasEvent = {
				type: "ai-canvas-event",
				payload: {
					eventName: action.eventName,
					timestamp: Date.now(),
					source: "canvas-mcp",
				},
			};

			try {
				window.parent.postMessage(canvasEvent, "*");
				this.domManager.showMessage(
					`Action triggered: ${action.eventName}`,
					"info",
				);
			} catch (error) {
				console.error("Failed to send event to parent:", error);
			}
		}
	}

	private clearCanvas(): void {
		this.domManager.clearCanvas();
		this.stateManager.clearActions();
		this.stateManager.resetStyle();
		this.updateStatusDisplay();
		this.domManager.showMessage("Canvas cleared", "info");

		// 重新初始化Canvas样式
		this.canvasRenderer.initializeCanvas();
	}

	private clearHistory(): void {
		this.stateManager.clearHistory();
		this.domManager.clearCommandHistory();
		this.updateStatusDisplay();
		this.domManager.showMessage("History cleared", "info");
	}

	private updateStatusDisplay(): void {
		const summary = this.stateManager.getStateSummary();

		this.domManager.updateCommandCount(summary.historyCount);
		this.domManager.updateActionCount(summary.actionCount);
		this.domManager.updateParseStatus("Ready", false);
	}

	// 销毁应用
	public destroy(): void {
		if (this.pollingInterval) {
			clearInterval(this.pollingInterval);
		}
		console.log("🔥 Canvas MCP Application destroyed");
	}

	// Debug方法
	public debug(): void {
		console.log("=== Canvas MCP App Debug Info ===");
		console.log("Command Queue:", this.commandQueue);
		this.stateManager.debugInfo();
	}
}

// 全局暴露应用实例，供MCP工具使用
declare global {
	interface Window {
		canvasMCP?: CanvasMCPApp;
		executeCanvasCommand?: (command: string) => void;
	}
}

// 当DOM加载完成后初始化应用
document.addEventListener("DOMContentLoaded", () => {
	try {
		const app = new CanvasMCPApp();

		// 全局暴露
		window.canvasMCP = app;
		window.executeCanvasCommand = (command: string) =>
			app.executeCommand(command);

		// 监听来自MCP服务器的消息
		window.addEventListener("message", (event) => {
			if (event.data && event.data.type === "mcp-canvas-command") {
				app.executeCommand(event.data.command);
			}
		});
	} catch (error) {
		console.error("❌ Failed to start Canvas MCP Application:", error);
	}
});
