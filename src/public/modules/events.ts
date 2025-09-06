// 事件管理器 - 处理Canvas交互事件和消息传递

import type { CanvasEvent, ClickableArea } from "./types.js";
import { DOMManager } from "./dom.js";
import { StateManager } from "./state.js";

export class EventsManager {
	private domManager: DOMManager;
	private stateManager: StateManager;
	private isInitialized: boolean = false;
	private eventListeners: Map<string, (event: Event) => void> = new Map();

	constructor(domManager: DOMManager, stateManager: StateManager) {
		this.domManager = domManager;
		this.stateManager = stateManager;

		console.log("🎪 Events Manager initializing...");
		this.setupEventListeners();
		this.isInitialized = true;
		console.log("✅ Events Manager initialized");
	}

	private setupEventListeners(): void {
		// Canvas 点击事件
		const canvasClickHandler = (event: MouseEvent) =>
			this.handleCanvasClick(event);
		this.domManager.canvas.addEventListener("click", canvasClickHandler);
		this.eventListeners.set("canvas-click", canvasClickHandler);

		// Canvas 鼠标移动事件（用于悬停效果）
		const canvasMouseMoveHandler = (event: MouseEvent) =>
			this.handleCanvasMouseMove(event);
		this.domManager.canvas.addEventListener(
			"mousemove",
			canvasMouseMoveHandler,
		);
		this.eventListeners.set("canvas-mousemove", canvasMouseMoveHandler);

		// Canvas 鼠标离开事件
		const canvasMouseLeaveHandler = () => this.handleCanvasMouseLeave();
		this.domManager.canvas.addEventListener(
			"mouseleave",
			canvasMouseLeaveHandler,
		);
		this.eventListeners.set("canvas-mouseleave", canvasMouseLeaveHandler);

		// 控制按钮事件
		const clearCanvasHandler = () => this.handleClearCanvas();
		this.domManager.clearCanvasBtn.addEventListener(
			"click",
			clearCanvasHandler,
		);
		this.eventListeners.set("clear-canvas", clearCanvasHandler);

		const clearHistoryHandler = () => this.handleClearHistory();
		this.domManager.clearHistoryBtn.addEventListener(
			"click",
			clearHistoryHandler,
		);
		this.eventListeners.set("clear-history", clearHistoryHandler);

		// 键盘快捷键
		const keyboardHandler = (event: KeyboardEvent) =>
			this.handleKeyboard(event);
		document.addEventListener("keydown", keyboardHandler);
		this.eventListeners.set("keyboard", keyboardHandler);

		// 监听来自父窗口的消息
		const messageHandler = (event: MessageEvent) =>
			this.handleWindowMessage(event);
		window.addEventListener("message", messageHandler);
		this.eventListeners.set("window-message", messageHandler);

		// 浏览器窗口关闭前的清理
		const beforeUnloadHandler = () => this.cleanup();
		window.addEventListener("beforeunload", beforeUnloadHandler);
		this.eventListeners.set("beforeunload", beforeUnloadHandler);
	}

	private handleCanvasClick(event: MouseEvent): void {
		const coords = this.domManager.getCanvasCoordinates(event);
		const action = this.stateManager.getClickedAction(coords.x, coords.y);

		console.log(
			`🖱️ Canvas clicked at (${coords.x.toFixed(1)}, ${coords.y.toFixed(1)})`,
		);

		if (action) {
			console.log(`🎯 Action triggered: ${action.eventName}`);
			this.triggerAction(action);

			// 视觉反馈 - 短暂高亮点击区域
			this.highlightClickableArea(action);
		} else {
			console.log("👆 Click outside of interactive areas");
		}
	}

	private handleCanvasMouseMove(event: MouseEvent): void {
		const coords = this.domManager.getCanvasCoordinates(event);
		const action = this.stateManager.getClickedAction(coords.x, coords.y);

		// 根据是否在可点击区域内改变鼠标样式
		if (action) {
			this.domManager.canvas.style.cursor = "pointer";

			// 可选：显示tooltip提示
			this.domManager.canvas.title = `Click to trigger: ${action.eventName}`;
		} else {
			this.domManager.canvas.style.cursor = "crosshair";
			this.domManager.canvas.title = "";
		}
	}

	private handleCanvasMouseLeave(): void {
		this.domManager.canvas.style.cursor = "crosshair";
		this.domManager.canvas.title = "";
	}

	private handleClearCanvas(): void {
		console.log("🗑️ Clear canvas button clicked");

		// 触发自定义事件
		this.dispatchCustomEvent("canvas-clear-requested", {
			source: "user-action",
			timestamp: Date.now(),
		});

		this.domManager.showMessage("Canvas will be cleared", "info");
	}

	private handleClearHistory(): void {
		console.log("🗑️ Clear history button clicked");

		// 触发自定义事件
		this.dispatchCustomEvent("history-clear-requested", {
			source: "user-action",
			timestamp: Date.now(),
		});

		this.domManager.showMessage("History will be cleared", "info");
	}

	private handleKeyboard(event: KeyboardEvent): void {
		if (event.ctrlKey || event.metaKey) {
			switch (event.key.toLowerCase()) {
				case "k":
					event.preventDefault();
					this.handleClearCanvas();
					break;
				case "h":
					event.preventDefault();
					this.handleClearHistory();
					break;
				case "d":
					event.preventDefault();
					this.debugInfo();
					break;
				case "r":
					event.preventDefault();
					this.refreshCanvas();
					break;
			}
		}

		// ESC键隐藏消息
		if (event.key === "Escape") {
			this.domManager.hideMessage();
		}
	}

	private handleWindowMessage(event: MessageEvent): void {
		// 处理来自MCP服务器或父窗口的消息
		if (!event.data || typeof event.data !== "object") {
			return;
		}

		// 只处理我们期望的 MCP 消息类型，忽略其他消息（如 MetaMask、其他扩展等）
		if (!event.data.type || !event.data.type.startsWith("mcp-")) {
			// 不输出日志以避免干扰，因为浏览器中有很多其他消息
			return;
		}

		console.log("📨 Received MCP window message:", event.data);

		switch (event.data.type) {
			case "mcp-canvas-command":
				this.handleMCPCommand(event.data.command);
				break;
			case "mcp-canvas-clear":
				this.dispatchCustomEvent("canvas-clear-requested", {
					source: "mcp-command",
					timestamp: Date.now(),
				});
				break;
			case "mcp-status-request":
				this.sendStatusUpdate();
				break;
			default:
				console.debug("Unknown MCP message type:", event.data.type);
		}
	}

	private handleMCPCommand(command: string): void {
		console.log("📝 Received MCP command:", command);

		// 分发给主应用处理
		this.dispatchCustomEvent("mcp-command-received", {
			command,
			timestamp: Date.now(),
			source: "mcp-server",
		});
	}

	private triggerAction(action: ClickableArea): void {
		const canvasEvent: CanvasEvent = {
			type: "ai-canvas-event",
			payload: {
				eventName: action.eventName,
				timestamp: Date.now(),
				source: "canvas-mcp",
			},
		};

		// 发送事件到父窗口
		try {
			window.parent.postMessage(canvasEvent, "*");

			this.domManager.showMessage(
				`Action triggered: ${action.eventName}`,
				"success",
			);

			console.log("📤 Event sent to parent window:", canvasEvent);
		} catch (error) {
			console.error("❌ Failed to send event to parent window:", error);
			this.domManager.showMessage(
				"Failed to trigger action: Communication error",
				"error",
			);
		}

		// 记录事件
		this.logActionEvent(action);
	}

	private highlightClickableArea(action: ClickableArea): void {
		// 创建短暂的视觉反馈
		const canvas = this.domManager.canvas;
		const ctx = this.domManager.ctx;

		// 保存当前上下文
		ctx.save();

		// 绘制高亮效果
		ctx.globalAlpha = 0.3;
		ctx.fillStyle = "#00ff00";
		ctx.fillRect(action.x, action.y, action.width, action.height);

		ctx.globalAlpha = 1;
		ctx.strokeStyle = "#00ff00";
		ctx.lineWidth = 2;
		ctx.strokeRect(action.x, action.y, action.width, action.height);

		// 250ms后恢复
		setTimeout(() => {
			ctx.restore();
			// 这里应该重新绘制canvas，但由于我们不想依赖外部状态，
			// 我们依靠应用的重绘机制
			this.dispatchCustomEvent("canvas-refresh-needed", {
				reason: "highlight-cleanup",
				timestamp: Date.now(),
			});
		}, 250);
	}

	private logActionEvent(action: ClickableArea): void {
		const logEntry = {
			type: "action-triggered",
			eventName: action.eventName,
			area: {
				x: action.x,
				y: action.y,
				width: action.width,
				height: action.height,
			},
			timestamp: Date.now(),
			timestampISO: new Date().toISOString(),
		};

		// 可以发送到分析服务或本地存储
		console.log("📊 Action event logged:", logEntry);
	}

	private sendStatusUpdate(): void {
		const status = this.stateManager.getStateSummary();
		const statusMessage = {
			type: "mcp-canvas-status",
			payload: {
				...status,
				isInitialized: this.isInitialized,
				timestamp: Date.now(),
			},
		};

		try {
			window.parent.postMessage(statusMessage, "*");
			console.log("📊 Status update sent:", statusMessage);
		} catch (error) {
			console.error("❌ Failed to send status update:", error);
		}
	}

	private refreshCanvas(): void {
		console.log("🔄 Canvas refresh requested");
		this.dispatchCustomEvent("canvas-refresh-needed", {
			reason: "user-request",
			timestamp: Date.now(),
		});
	}

	private debugInfo(): void {
		console.log("=== Events Manager Debug Info ===");
		console.log("Initialized:", this.isInitialized);
		console.log("Event Listeners:", Array.from(this.eventListeners.keys()));
		console.log(
			"Registered Actions:",
			this.stateManager.registeredActions.length,
		);

		// 显示详细的可点击区域信息
		this.stateManager.registeredActions.forEach((action, index) => {
			console.log(`Action ${index + 1}:`, {
				eventName: action.eventName,
				area: `(${action.x}, ${action.y}) ${action.width}×${action.height}`,
			});
		});
	}

	private dispatchCustomEvent(eventType: string, detail: any): void {
		const customEvent = new CustomEvent(eventType, { detail });
		document.dispatchEvent(customEvent);
	}

	// 公共API方法
	public addEventListener(
		eventType: string,
		handler: (event: CustomEvent) => void,
	): void {
		document.addEventListener(eventType, handler as EventListener);
	}

	public removeEventListener(
		eventType: string,
		handler: (event: CustomEvent) => void,
	): void {
		document.removeEventListener(eventType, handler as EventListener);
	}

	public triggerCanvasEvent(eventName: string): void {
		const mockAction: ClickableArea = {
			x: 0,
			y: 0,
			width: 0,
			height: 0,
			eventName: eventName,
		};
		this.triggerAction(mockAction);
	}

	public getActiveActions(): readonly ClickableArea[] {
		return this.stateManager.registeredActions;
	}

	public isActionAtCoordinate(x: number, y: number): ClickableArea | null {
		return this.stateManager.getClickedAction(x, y);
	}

	// 清理资源
	private cleanup(): void {
		console.log("🧹 Events Manager cleanup");

		// 移除所有事件监听器
		for (const [eventType, handler] of this.eventListeners) {
			switch (eventType) {
				case "canvas-click":
				case "canvas-mousemove":
				case "canvas-mouseleave":
					this.domManager.canvas.removeEventListener(
						eventType.replace("canvas-", ""),
						handler,
					);
					break;
				case "clear-canvas":
					this.domManager.clearCanvasBtn.removeEventListener("click", handler);
					break;
				case "clear-history":
					this.domManager.clearHistoryBtn.removeEventListener("click", handler);
					break;
				case "keyboard":
					document.removeEventListener("keydown", handler);
					break;
				case "window-message":
					window.removeEventListener("message", handler);
					break;
				case "beforeunload":
					window.removeEventListener("beforeunload", handler);
					break;
			}
		}

		this.eventListeners.clear();
		this.isInitialized = false;
	}

	public destroy(): void {
		this.cleanup();
		console.log("🔥 Events Manager destroyed");
	}
}
