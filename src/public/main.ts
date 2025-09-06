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

		// 设置手动测试功能
		this.setupManualTesting();

		// 开始轮询MCP命令
		this.startMCPPolling();

		console.log("✅ Canvas MCP Application initialized successfully");
		} catch (error) {
			console.error("❌ Failed to initialize Canvas MCP Application:", error);
			if (this.domManager) {
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

	private setupManualTesting(): void {
		// 执行手动命令按钮
		const executeButton = document.getElementById("execute-manual-btn");
		if (executeButton) {
			executeButton.addEventListener("click", () => {
				this.executeManualCommands();
			});
		}

		// 预设示例按钮
		const loadBasicButton = document.getElementById("load-basic-example");
		if (loadBasicButton) {
			loadBasicButton.addEventListener("click", () => {
				this.loadBasicExample();
			});
		}

		const loadUIButton = document.getElementById("load-ui-mockup");
		if (loadUIButton) {
			loadUIButton.addEventListener("click", () => {
				this.loadUIMockupExample();
			});
		}

		const loadDiagramButton = document.getElementById("load-diagram");
		if (loadDiagramButton) {
			loadDiagramButton.addEventListener("click", () => {
				this.loadDiagramExample();
			});
		}

		// 支持键盘快捷键 Ctrl+Enter 执行命令
		const inputArea = document.getElementById("manual-dsl-input") as HTMLTextAreaElement;
		if (inputArea) {
			inputArea.addEventListener("keydown", (event) => {
				if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
					event.preventDefault();
					this.executeManualCommands();
				}
			});
		}
	}

	private startMCPPolling(): void {

		// 检查是否有待执行的命令（从localStorage或其他持久化存储）
		this.checkForPendingCommands();

		// 启动WebSocket连接以接收实时MCP命令
		this.startWebSocketConnection();

		// 保留定期检查作为后备机制
		this.pollingInterval = window.setInterval(() => {
			this.processPendingCommands();
		}, 5000); // 降低轮询频率，因为主要使用WebSocket
	}

	private startWebSocketConnection(): void {
		try {
			const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
			const host = window.location.host;
			const wsUrl = `${protocol}//${host}/ws`;
			
			const websocket = new WebSocket(wsUrl);

			websocket.onopen = () => {
				console.log("✅ WebSocket connection established");
			};

			websocket.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);

					// 只处理我们期望的消息类型，忽略其他消息
					if (!data.type) {
						console.debug("Ignoring message without type field:", data);
						return;
					}

					switch (data.type) {
						case "canvas-command":
							console.log("📡 Received command via WebSocket:", data.data);
							try {
								// 执行命令
								this.executeCommand(data.data.commands);
								
								// 发送消费确认 (通过 WebSocket)
								this.sendConsumeConfirmation(data.data.id);
								
								console.log(`✅ Command executed and consumed: ${data.data.id}`);
							} catch (error) {
								console.error(`❌ Failed to execute command ${data.data.id}:`, error);
								// 即使失败也发送消费确认，避免重复执行
								this.sendConsumeConfirmation(data.data.id);
							}
							break;
						
						case "consume-ack":
							console.log("✅ Server acknowledged command consumption:", data);
							break;
						
						case "connection":
							console.log("🔗 WebSocket connection confirmed:", data.data);
							break;
						
						default:
							console.debug("Ignoring unknown WebSocket message type:", data.type);
							break;
					}
				} catch (error) {
					console.error("Failed to parse WebSocket message:", error, event.data);
				}
			};

			websocket.onclose = () => {
				console.log("WebSocket connection closed");
				
				// 尝试重新连接
				setTimeout(() => {
					console.log("🔄 Attempting to reconnect WebSocket...");
					this.startWebSocketConnection();
				}, 3000);
			};

			websocket.onerror = (error) => {
				console.error("WebSocket connection error:", error);
			};

			// 存储websocket以便后续清理
			(this as any)._websocket = websocket;
		} catch (error) {
			console.error("Failed to create WebSocket connection:", error);
			this.domManager.showMessage(
				"Failed to connect to MCP server. Using fallback polling.",
				"error",
			);
		}
	}

	private async sendCommandStatus(
		commandId: string,
		status: "executed" | "error",
		error?: string,
	): Promise<void> {
		try {
			const websocket = (this as any)._websocket;
			if (websocket && websocket.readyState === WebSocket.OPEN) {
				// Send via WebSocket if available
				const message = {
					type: "command-status",
					commandId,
					status,
					error
				};
				websocket.send(JSON.stringify(message));
			} else {
				// Fallback to HTTP if WebSocket is not available
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
			}
		} catch (error) {
			console.error("Error sending command status:", error);
		}
	}

	// 发送命令消费确认 (通过 WebSocket)
	private sendConsumeConfirmation(commandId: string): void {
		const websocket = (this as any)._websocket;
		if (websocket && websocket.readyState === WebSocket.OPEN) {
			const message = {
				type: "command-consumed",
				commandId
			};
			websocket.send(JSON.stringify(message));
			console.log(`📤 Sent consume confirmation for command: ${commandId}`);
		} else {
			console.warn("❌ Cannot send consume confirmation - WebSocket not available");
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
			this.domManager.showMessage(
				`Executed ${successCount} commands successfully`,
				"success",
			);

			this.stateManager.setLastExecutionTime(Date.now());
		} catch (error) {
			console.error("DSL parsing error:", error);
			this.domManager.addCommandToHistory(commandString, "error");
			this.domManager.showMessage(
				`Parse error: ${(error as Error).message}`,
				"error",
			);
		}
	}

	// 消费服务器缓存的命令 - 现在通过 WebSocket 实时接收
	public async consumeCachedCommands(): Promise<void> {
		console.log("🔄 WebSocket-based command consumption ready - waiting for real-time commands...");
		// 不再需要主动获取，所有命令都通过 WebSocket 实时推送
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

		// 重置渲染器状态
		this.canvasRenderer.reset();
	}

	private clearHistory(): void {
		this.stateManager.clearHistory();
		this.domManager.clearCommandHistory();
		this.updateStatusDisplay();
		this.domManager.showMessage("History cleared", "info");
	}

	/**
	 * 执行手动输入的DSL命令
	 */
	private executeManualCommands(): void {
		const inputArea = document.getElementById("manual-dsl-input") as HTMLTextAreaElement;
		if (!inputArea) {
			console.warn("Manual DSL input area not found");
			return;
		}

		const commands = inputArea.value.trim();
		if (!commands) {
			this.domManager.showMessage("Please enter some DSL commands to execute", "info");
			return;
		}

		console.log("🧪 Executing manual DSL commands:", commands);
		this.executeCommand(commands);
		this.domManager.showMessage("Manual commands executed successfully", "success");
	}

	/**
	 * 加载基础示例
	 */
	private loadBasicExample(): void {
		const basicExample = `clear()
s(#FF6B6B,#4ECDC4,2,20,bold)
t(Hello Canvas!,100,100)
fr(50,150,200,80)
c(400,200,50)
l(200,300,600,300)`;
		this.setManualInput(basicExample);
	}

	/**
	 * 加载UI界面模型示例
	 */
	private loadUIMockupExample(): void {
		const uiExample = `clear()
s(#F8F9FA,#F8F9FA,1)
fr(0,0,800,500)
s(#343A40,#6C757D,2,16,bold)
fr(50,50,700,80)
s(white,white,1,24,bold)
t(Dashboard Header,60,90)
s(#007BFF,#007BFF,1)
fr(60,150,200,120)
fr(280,150,200,120)
fr(500,150,200,120)
s(white,white,1,16,bold)
t(Analytics,110,210)
t(Reports,360,210)
t(Settings,580,210)
s(#6C757D,#6C757D,1)
l(50,300,750,300)
s(#495057,#495057,1,14)
t(Footer Content,60,450)`;
		this.setManualInput(uiExample);
	}

	/**
	 * 加载流程图示例
	 */
	private loadDiagramExample(): void {
		const diagramExample = `clear()
s(#E3F2FD,#E3F2FD,1)
fr(0,0,800,500)
s(#1976D2,#2196F3,2,14,normal)
fr(100,100,120,60)
fr(350,100,120,60)
fr(600,100,120,60)
s(white,white,1,12,bold)
t(Start,140,135)
t(Process,395,135)
t(End,640,135)
s(#1976D2,#1976D2,2)
l(220,130,350,130)
l(470,130,600,130)
s(#1976D2,#1976D2,1,12)
t(→,275,125)
t(→,525,125)
s(#FF9800,#FFC107,2)
c(160,250,30)
c(410,250,30)
s(#000000,#000000,1,10)
t(Decision,135,255)
t(Condition,385,255)
s(#FF9800,#FF9800,2)
l(160,190,160,220)
l(410,190,410,220)`;
		this.setManualInput(diagramExample);
	}

	/**
	 * 设置手动输入区域的内容
	 */
	private setManualInput(content: string): void {
		const inputArea = document.getElementById("manual-dsl-input") as HTMLTextAreaElement;
		if (inputArea) {
			inputArea.value = content;
			inputArea.focus();
		}
	}

	private updateStatusDisplay(): void {
		const summary = this.stateManager.getStateSummary();

		this.domManager.updateCommandCount(summary.historyCount);
	}

	// 销毁应用
	public destroy(): void {
		if (this.pollingInterval) {
			clearInterval(this.pollingInterval);
		}
		
		// 清理WebSocket连接
		const websocket = (this as any)._websocket;
		if (websocket) {
			websocket.close();
			delete (this as any)._websocket;
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
document.addEventListener("DOMContentLoaded", async () => {
	try {
		const app = new CanvasMCPApp();

		// 全局暴露
		window.canvasMCP = app;
		window.executeCanvasCommand = (command: string) =>
			app.executeCommand(command);

		// 监听来自MCP服务器的消息
		window.addEventListener("message", (event) => {
			// 只处理 MCP 相关的消息，忽略其他消息（如 MetaMask 等浏览器扩展）
			if (event.data && event.data.type && event.data.type.startsWith("mcp-")) {
				if (event.data.type === "mcp-canvas-command") {
					app.executeCommand(event.data.command);
				}
			}
		});

		// 页面启动时获取并消费缓存的命令
		await app.consumeCachedCommands();
	} catch (error) {
		console.error("❌ Failed to start Canvas MCP Application:", error);
	}
});
