// 状态管理器 - 维护 Canvas 状态和样式

import type { DrawingStyle, ClickableArea } from "./types.js";

export class StateManager {
	private _currentStyle: DrawingStyle;
	private _registeredActions: ClickableArea[] = [];
	private _commandHistory: string[] = [];
	private _lastExecutionTime: number = 0;

	constructor() {
		// 初始化默认样式
		this._currentStyle = {
			strokeColor: "#000000",
			fillColor: "#000000",
			lineWidth: 1,
			font: "16px Arial",
		};
	}

	// 样式管理
	get currentStyle(): DrawingStyle {
		return { ...this._currentStyle };
	}

	updateStyle(styleUpdates: Partial<DrawingStyle>): void {
		this._currentStyle = {
			...this._currentStyle,
			...styleUpdates,
		};
	}

	resetStyle(): void {
		this._currentStyle = {
			strokeColor: "#000000",
			fillColor: "#000000",
			lineWidth: 1,
			font: "16px Arial",
		};
	}

	// 动作区域管理
	get registeredActions(): readonly ClickableArea[] {
		return this._registeredActions;
	}

	addAction(area: ClickableArea): void {
		// 检查是否已存在相同的动作区域
		const existingIndex = this._registeredActions.findIndex(
			(existing) =>
				existing.x === area.x &&
				existing.y === area.y &&
				existing.width === area.width &&
				existing.height === area.height,
		);

		if (existingIndex >= 0) {
			// 更新现有区域的事件名称
			this._registeredActions[existingIndex] = area;
		} else {
			// 添加新的动作区域
			this._registeredActions.push(area);
		}
	}

	clearActions(): void {
		this._registeredActions = [];
	}

	// 点击检测
	getClickedAction(x: number, y: number): ClickableArea | null {
		for (const action of this._registeredActions) {
			if (this.isPointInArea(x, y, action)) {
				return action;
			}
		}
		return null;
	}

	private isPointInArea(x: number, y: number, area: ClickableArea): boolean {
		return (
			x >= area.x &&
			x <= area.x + area.width &&
			y >= area.y &&
			y <= area.y + area.height
		);
	}

	// 命令历史管理
	addToHistory(command: string): void {
		this._commandHistory.push(command);

		// 保持历史记录限制在最近100条
		if (this._commandHistory.length > 100) {
			this._commandHistory = this._commandHistory.slice(-100);
		}
	}

	getHistory(): readonly string[] {
		return this._commandHistory;
	}

	clearHistory(): void {
		this._commandHistory = [];
	}

	// 执行时间跟踪
	setLastExecutionTime(time: number): void {
		this._lastExecutionTime = time;
	}

	getLastExecutionTime(): number {
		return this._lastExecutionTime;
	}

	// 状态重置
	reset(): void {
		this.resetStyle();
		this.clearActions();
		this.clearHistory();
		this._lastExecutionTime = 0;
	}

	// 获取状态摘要
	getStateSummary(): {
		style: DrawingStyle;
		actionCount: number;
		historyCount: number;
		lastExecution: number;
	} {
		return {
			style: this.currentStyle,
			actionCount: this._registeredActions.length,
			historyCount: this._commandHistory.length,
			lastExecution: this._lastExecutionTime,
		};
	}

	// 样式工具方法
	parseColor(color: string): string {
		// 简单的颜色验证和格式化
		if (color.startsWith("#")) {
			return color;
		} else if (color.startsWith("rgb")) {
			return color;
		} else {
			// 尝试添加 # 前缀
			return "#" + color;
		}
	}

	parseLineWidth(width: string | number): number {
		const numWidth = typeof width === "string" ? parseFloat(width) : width;
		return Math.max(0.1, Math.min(50, numWidth)); // 限制线宽范围
	}

	parseFont(font: string): string {
		// 基本的字体格式验证
		if (font.includes("px") || font.includes("pt") || font.includes("em")) {
			return font;
		} else {
			// 默认添加像素单位
			return `16px ${font}`;
		}
	}

	// 调试信息
	debugInfo(): void {
		console.log("=== Canvas State Debug Info ===");
		console.log("Current Style:", this._currentStyle);
		console.log("Registered Actions:", this._registeredActions.length);
		console.log("Command History:", this._commandHistory.length);
		console.log("Last Execution:", new Date(this._lastExecutionTime));

		if (this._registeredActions.length > 0) {
			console.log("Action Areas:");
			this._registeredActions.forEach((action, index) => {
				console.log(
					`  ${index + 1}: (${action.x}, ${action.y}) ${action.width}×${action.height} -> ${action.eventName}`,
				);
			});
		}
	}
}
