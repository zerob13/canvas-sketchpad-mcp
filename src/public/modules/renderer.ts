// Canvas 渲染器 - 处理所有 Canvas 绘制操作

import type {
	DSLCommand,
	CommandType,
	DrawingStyle,
	ClickableArea,
} from "./types.js";
import { StateManager } from "./state.js";

export class CanvasRenderer {
	private ctx: CanvasRenderingContext2D;
	private stateManager: StateManager;
	private lastAppliedStyle: DrawingStyle | null = null;

	constructor(ctx: CanvasRenderingContext2D, stateManager: StateManager) {
		this.ctx = ctx;
		this.stateManager = stateManager;
	}

	/**
	 * 执行单个 DSL 命令
	 */
	execute(command: DSLCommand): void {
		try {
			const commandType = this.getCommandType(command.command);

			switch (commandType) {
				case "style":
					this.executeStyleCommand(command);
					break;
				case "line":
					this.executeLineCommand(command);
					break;
				case "rect":
					this.executeRectCommand(command);
					break;
				case "fillRect":
					this.executeFillRectCommand(command);
					break;
				case "circle":
					this.executeCircleCommand(command);
					break;
				case "fillCircle":
					this.executeFillCircleCommand(command);
					break;
				case "text":
					this.executeTextCommand(command);
					break;
				case "path":
					this.executePathCommand(command);
					break;
				case "clear":
					this.executeClearCommand(command);
					break;
				case "action":
					this.executeActionCommand(command);
					break;
				default:
					console.warn(`Unknown command type: ${command.command}`);
			}
		} catch (error) {
			console.error(`Error executing command ${command.command}:`, error);
			throw error;
		}
	}

	/**
	 * 批量执行多个命令（性能优化）
	 */
	executeBatch(commands: DSLCommand[]): void {
		this.ctx.save();

		try {
			for (const command of commands) {
				this.execute(command);
			}
		} finally {
			this.ctx.restore();
		}
	}

	/**
	 * 获取命令类型
	 */
	private getCommandType(command: string): CommandType {
		const commandMap: Record<string, CommandType> = {
			s: "style",
			l: "line",
			r: "rect",
			fr: "fillRect",
			c: "circle",
			fc: "fillCircle",
			t: "text",
			p: "path",
			clear: "clear",
			action: "action",
		};

		return commandMap[command] || (command as CommandType);
	}

	/**
	 * 应用当前样式到 Canvas 上下文
	 */
	private applyStyles(): void {
		const currentStyle = this.stateManager.currentStyle;

		// 只在样式发生变化时应用，避免重复设置
		if (
			!this.lastAppliedStyle ||
			this.isStyleDifferent(currentStyle, this.lastAppliedStyle)
		) {
			this.ctx.strokeStyle = currentStyle.strokeColor;
			this.ctx.fillStyle = currentStyle.fillColor;
			this.ctx.lineWidth = currentStyle.lineWidth;
			this.ctx.font = currentStyle.font;

			this.lastAppliedStyle = { ...currentStyle };
		}
	}

	/**
	 * 检查样式是否发生变化
	 */
	private isStyleDifferent(
		style1: DrawingStyle,
		style2: DrawingStyle,
	): boolean {
		return (
			style1.strokeColor !== style2.strokeColor ||
			style1.fillColor !== style2.fillColor ||
			style1.lineWidth !== style2.lineWidth ||
			style1.font !== style2.font
		);
	}

	/**
	 * 执行样式命令: s(sc:#FF0000;lw:3;fc:#00FF00;f:16px Arial)
	 */
	private executeStyleCommand(command: DSLCommand): void {
		const styleUpdates: Partial<DrawingStyle> = {};

		for (const arg of command.args) {
			if (typeof arg === "string" && arg.includes(":")) {
				const [key, value] = arg.split(":", 2);

				switch (key.trim()) {
					case "sc": // strokeColor
						styleUpdates.strokeColor = this.stateManager.parseColor(
							value.trim(),
						);
						break;
					case "fc": // fillColor
						styleUpdates.fillColor = this.stateManager.parseColor(value.trim());
						break;
					case "lw": // lineWidth
						styleUpdates.lineWidth = this.stateManager.parseLineWidth(
							value.trim(),
						);
						break;
					case "f": // font (complete font string)
						styleUpdates.font = this.stateManager.parseFont(value.trim());
						break;
					case "fs": // fontSize
						const currentFont = this.stateManager.currentStyle.font || "16px Arial";
						const [, , , fontFamily] = currentFont.split(" ");
						styleUpdates.font = `${value.trim()}px ${fontFamily || "Arial"}`;
						break;
					case "fw": // fontWeight
						const existingFont = this.stateManager.currentStyle.font || "16px Arial";
						const [fontSize, , , fontFamilyName] = existingFont.split(" ");
						styleUpdates.font = `${value.trim()} ${fontSize} ${fontFamilyName || "Arial"}`;
						break;
					case "bg": // backgroundColor (not directly supported in canvas, could be used for background fills)
					case "bc": // borderColor (could map to strokeColor)
					case "bo": // borderWidth (could map to lineWidth)
						// These are extended properties that might not directly map to canvas styles
						console.info(`Style property "${key}" is not directly supported in canvas rendering`);
						break;
					default:
						console.warn(`Unknown style property: ${key}`);
				}
			}
		}

		this.stateManager.updateStyle(styleUpdates);
	}

	/**
	 * 执行线条命令: l(x1,y1,x2,y2)
	 */
	private executeLineCommand(command: DSLCommand): void {
		if (command.args.length !== 4) {
			throw new Error(
				`Line command requires 4 arguments: x1,y1,x2,y2, got ${command.args.length}`,
			);
		}

		const [x1, y1, x2, y2] = command.args as [number, number, number, number];

		this.applyStyles();

		this.ctx.beginPath();
		this.ctx.moveTo(x1, y1);
		this.ctx.lineTo(x2, y2);
		this.ctx.stroke();
	}

	/**
	 * 执行矩形命令: r(x,y,width,height)
	 */
	private executeRectCommand(command: DSLCommand): void {
		if (command.args.length !== 4) {
			throw new Error(
				`Rectangle command requires 4 arguments: x,y,width,height, got ${command.args.length}`,
			);
		}

		const [x, y, width, height] = command.args as [number, number, number, number];

		this.applyStyles();
		this.ctx.strokeRect(x, y, width, height);
	}

	/**
	 * 执行填充矩形命令: fr(x,y,width,height)
	 */
	private executeFillRectCommand(command: DSLCommand): void {
		if (command.args.length !== 4) {
			throw new Error(
				`Fill rectangle command requires 4 arguments: x,y,width,height, got ${command.args.length}`,
			);
		}

		const [x, y, width, height] = command.args as [number, number, number, number];

		this.applyStyles();
		this.ctx.fillRect(x, y, width, height);
	}

	/**
	 * 执行圆形命令: c(x,y,radius)
	 */
	private executeCircleCommand(command: DSLCommand): void {
		if (command.args.length !== 3) {
			throw new Error(
				`Circle command requires 3 arguments: x,y,radius, got ${command.args.length}`,
			);
		}

		const [x, y, radius] = command.args as [number, number, number];

		this.applyStyles();

		this.ctx.beginPath();
		this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
		this.ctx.stroke();
	}

	/**
	 * 执行填充圆形命令: fc(x,y,radius)
	 */
	private executeFillCircleCommand(command: DSLCommand): void {
		if (command.args.length !== 3) {
			throw new Error(
				`Fill circle command requires 3 arguments: x,y,radius, got ${command.args.length}`,
			);
		}

		const [x, y, radius] = command.args as [number, number, number];

		this.applyStyles();

		this.ctx.beginPath();
		this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
		this.ctx.fill();
	}

	/**
	 * 执行文本命令: t(text,x,y)
	 */
	private executeTextCommand(command: DSLCommand): void {
		if (command.args.length !== 3) {
			throw new Error(
				`Text command requires 3 arguments: text,x,y, got ${command.args.length}`,
			);
		}

		const [x, y, text] = command.args as [number, number, string];

		this.applyStyles();
		this.ctx.fillText(text, x, y);
	}

	/**
	 * 执行路径命令: p(x1,y1,x2,y2,x3,y3,...)
	 */
	private executePathCommand(command: DSLCommand): void {
		// command.args 现在是一个点的数组 Array<{x: number, y: number}>
		const points = command.args as Array<{ x: number; y: number }>;
		
		if (points.length < 2) {
			throw new Error(
				`Path command requires at least 2 points, got ${points.length}`,
			);
		}

		this.applyStyles();

		this.ctx.beginPath();

		// 移动到第一个点
		const firstPoint = points[0];
		this.ctx.moveTo(firstPoint.x, firstPoint.y);

		// 连接到其余点
		for (let i = 1; i < points.length; i++) {
			const point = points[i];
			this.ctx.lineTo(point.x, point.y);
		}

		this.ctx.stroke();
	}

	/**
	 * 执行清空命令: clear()
	 */
	private executeClearCommand(command: DSLCommand): void {
		this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

		// 清空时重置已应用的样式缓存
		this.lastAppliedStyle = null;
	}

	/**
	 * 执行动作命令: action(x,y,width,height,eventName)
	 */
	private executeActionCommand(command: DSLCommand): void {
		if (command.args.length !== 5) {
			throw new Error(
				`Action command requires 5 arguments: x,y,width,height,eventName, got ${command.args.length}`,
			);
		}

		const [x, y, width, height, eventName] = command.args as [number, number, number, number, string];

		const clickableArea: ClickableArea = {
			x,
			y,
			width,
			height,
			eventName,
		};

		this.stateManager.addAction(clickableArea);
	}


	/**
	 * 获取 Canvas 上下文信息（调试用）
	 */
	getContextInfo(): {
		canvasSize: { width: number; height: number };
		currentTransform: DOMMatrix;
		currentStyle: DrawingStyle;
	} {
		return {
			canvasSize: {
				width: this.ctx.canvas.width,
				height: this.ctx.canvas.height,
			},
			currentTransform: this.ctx.getTransform(),
			currentStyle: this.stateManager.currentStyle,
		};
	}

	/**
	 * 重置渲染器状态
	 */
	reset(): void {
		this.lastAppliedStyle = null;
		this.ctx.save();
		this.ctx.setTransform(1, 0, 0, 1, 0, 0);
		this.ctx.restore();
	}
}
