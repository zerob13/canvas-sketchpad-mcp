// DOM 管理器 - 统一管理页面元素引用

export class DOMManager {
	// Canvas 相关元素
	public readonly canvas: HTMLCanvasElement;
	public readonly ctx: CanvasRenderingContext2D;

	// Control elements
	public readonly commandHistory: HTMLDivElement;
	public readonly clearHistoryBtn: HTMLButtonElement;
	public readonly clearCanvasBtn: HTMLButtonElement;
	// Status display elements
	public readonly commandCount: HTMLSpanElement;
	public readonly messageArea: HTMLDivElement;
	public readonly messageContent: HTMLDivElement;

	constructor() {
		// 获取 Canvas 元素
		this.canvas = document.getElementById("canvas") as HTMLCanvasElement;
		if (!this.canvas) {
			throw new Error("Canvas element not found");
		}

		const ctx = this.canvas.getContext("2d");
		if (!ctx) {
			throw new Error("Failed to get 2D context from canvas");
		}
		this.ctx = ctx;

		// Get control elements
		this.commandHistory = document.getElementById(
			"command-history",
		) as HTMLDivElement;
		this.clearHistoryBtn = document.getElementById(
			"clear-history-btn",
		) as HTMLButtonElement;
		this.clearCanvasBtn = document.getElementById(
			"clear-canvas-btn",
		) as HTMLButtonElement;

		// Get status display elements
		this.commandCount = document.getElementById(
			"command-count",
		) as HTMLSpanElement;
		this.messageArea = document.getElementById(
			"message-area",
		) as HTMLDivElement;
		this.messageContent = document.getElementById(
			"message-content",
		) as HTMLDivElement;

		// 验证所有必需元素都存在
		this.validateElements();

		// 初始化 Canvas
		this.initializeCanvas();
	}

	private validateElements(): void {
		const elements = [
			{ name: "commandHistory", element: this.commandHistory },
			{ name: "clearHistoryBtn", element: this.clearHistoryBtn },
			{ name: "clearCanvasBtn", element: this.clearCanvasBtn },
			{ name: "commandCount", element: this.commandCount },
			{ name: "messageArea", element: this.messageArea },
			{ name: "messageContent", element: this.messageContent },
		];

		for (const { name, element } of elements) {
			if (!element) {
				throw new Error(`Required element '${name}' not found`);
			}
		}
	}

	private initializeCanvas(): void {
		// 设置 Canvas 默认样式
		this.ctx.lineCap = "round";
		this.ctx.lineJoin = "round";
		this.ctx.textBaseline = "alphabetic";

		// 设置默认样式
		this.ctx.strokeStyle = "#000000";
		this.ctx.fillStyle = "#000000";
		this.ctx.lineWidth = 1;
		this.ctx.font = "16px Arial";
	}

	// 状态更新方法
	updateCommandCount(count: number): void {
		this.commandCount.textContent = count.toString();
	}

	showMessage(
		message: string,
		type: "success" | "error" | "info" = "info",
	): void {
		this.messageArea.classList.remove("hidden");

		// 清除之前的样式
		this.messageContent.className = "p-3 rounded-md text-sm";

		// 添加对应的样式
		switch (type) {
			case "success":
				this.messageContent.classList.add(
					"bg-green-50",
					"text-green-800",
					"border",
					"border-green-200",
				);
				break;
			case "error":
				this.messageContent.classList.add(
					"bg-red-50",
					"text-red-800",
					"border",
					"border-red-200",
				);
				break;
			case "info":
			default:
				this.messageContent.classList.add(
					"bg-blue-50",
					"text-blue-800",
					"border",
					"border-blue-200",
				);
				break;
		}

		this.messageContent.textContent = message;

		// 5秒后自动隐藏消息
		setTimeout(() => {
			this.hideMessage();
		}, 5000);
	}

	hideMessage(): void {
		this.messageArea.classList.add("hidden");
	}

	// 获取 Canvas 相对坐标
	getCanvasCoordinates(event: MouseEvent): { x: number; y: number } {
		const rect = this.canvas.getBoundingClientRect();
		const scaleX = this.canvas.width / rect.width;
		const scaleY = this.canvas.height / rect.height;

		return {
			x: (event.clientX - rect.left) * scaleX,
			y: (event.clientY - rect.top) * scaleY,
		};
	}

	// 清空画布
	clearCanvas(): void {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
	}


	// Add command to history display
	addCommandToHistory(
		command: string,
		status: "success" | "error" | "executing" = "success",
	): void {
		const timestamp = new Date().toLocaleTimeString();
		const historyItem = document.createElement("div");
		historyItem.className = "mb-2 p-2 border-l-4 text-xs font-mono";

		switch (status) {
			case "success":
				historyItem.classList.add(
					"border-green-400",
					"bg-green-50",
					"text-green-800",
				);
				break;
			case "error":
				historyItem.classList.add(
					"border-red-400",
					"bg-red-50",
					"text-red-800",
				);
				break;
			case "executing":
				historyItem.classList.add(
					"border-blue-400",
					"bg-blue-50",
					"text-blue-800",
				);
				break;
		}

		historyItem.innerHTML = `
      <div class="flex justify-between items-center">
        <span class="font-medium">${timestamp}</span>
        <span class="text-xs capitalize">${status}</span>
      </div>
      <div class="mt-1">${command}</div>
    `;

		// Remove placeholder if it exists
		const placeholder = this.commandHistory.querySelector(".text-gray-500");
		if (
			placeholder &&
			placeholder.textContent?.includes("Waiting for MCP commands")
		) {
			this.commandHistory.innerHTML = "";
		}

		this.commandHistory.appendChild(historyItem);
		this.commandHistory.scrollTop = this.commandHistory.scrollHeight;
	}

	// Clear command history
	clearCommandHistory(): void {
		this.commandHistory.innerHTML = `
      <div class="text-gray-500 text-center py-8">
        Waiting for MCP commands...
        <br>
        <span class="text-xs">Commands will appear here when executed via MCP tools</span>
      </div>
    `;
	}
}
