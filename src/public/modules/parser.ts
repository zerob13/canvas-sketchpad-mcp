// DSL 解析器 - 解析绘图命令语法

import type { DSLCommand, CommandType, ParseErrorTypeValue } from "./types.js";
import { ParseError, ParseErrorType } from "./types.js";

export class DSLParser {
	private static readonly COMMAND_REGEX = /^([a-zA-Z]+)\s*\(([^)]*)\)\s*$/;
	private static readonly COMMENT_REGEX = /\/\/.*$/;
	private static readonly STYLE_PARAM_REGEX = /^([a-z]+):(.+)$/;

	// 支持的命令映射
	private static readonly COMMAND_MAP: Record<string, CommandType> = {
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

	constructor() {
		console.log("📝 DSL Parser initialized");
	}

	/**
	 * 解析DSL命令字符串
	 * @param input DSL命令字符串
	 * @returns 解析后的命令数组
	 */
	public parse(input: string): DSLCommand[] {
		if (!input?.trim()) {
			throw new ParseError("Empty input", ParseErrorType.SYNTAX_ERROR);
		}

		const lines = this.preprocessInput(input);
		const commands: DSLCommand[] = [];

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			const lineNumber = i + 1;

			if (!line || this.isComment(line)) {
				continue;
			}

			try {
				const command = this.parseSingleCommand(line, lineNumber);
				commands.push(command);
			} catch (error) {
				if (error instanceof ParseError) {
					throw error;
				}
				throw new ParseError(
					`Line ${lineNumber}: ${(error as Error).message}`,
					ParseErrorType.SYNTAX_ERROR,
					lineNumber,
				);
			}
		}

		if (commands.length === 0) {
			throw new ParseError(
				"No valid commands found",
				ParseErrorType.SYNTAX_ERROR,
			);
		}

		return commands;
	}

	private preprocessInput(input: string): string[] {
		return input
			.split(/\r?\n/)
			.map((line) => line.replace(DSLParser.COMMENT_REGEX, "").trim())
			.filter((line) => line.length > 0);
	}

	private isComment(line: string): boolean {
		return line.startsWith("//");
	}

	private parseSingleCommand(line: string, lineNumber: number): DSLCommand {
		const match = line.match(DSLParser.COMMAND_REGEX);

		if (!match) {
			throw new ParseError(
				`Invalid command syntax: "${line}"`,
				ParseErrorType.SYNTAX_ERROR,
				lineNumber,
			);
		}

		const [, cmdName, paramsStr] = match;
		const commandType = DSLParser.COMMAND_MAP[cmdName.toLowerCase()];

		if (!commandType) {
			throw new ParseError(
				`Unknown command: "${cmdName}"`,
				ParseErrorType.INVALID_COMMAND,
				lineNumber,
			);
		}

		const args = this.parseParameters(paramsStr, commandType, lineNumber);

		return {
			command: commandType,
			args,
			line: lineNumber,
		};
	}

	private parseParameters(
		paramsStr: string,
		commandType: CommandType,
		lineNumber: number,
	): any[] {
		if (commandType === "clear") {
			// clear命令不需要参数
			return [];
		}

		if (!paramsStr.trim()) {
			throw new ParseError(
				`Command "${commandType}" requires parameters`,
				ParseErrorType.INVALID_PARAMETER,
				lineNumber,
			);
		}

		// 统一使用逗号分隔参数，不再支持分号
		const params = paramsStr.split(",").map((p) => p.trim());

		switch (commandType) {
			case "style":
				return this.parseStyleParameters(params, lineNumber);
			case "line":
				return this.parseLineParameters(params, lineNumber);
			case "rect":
			case "fillRect":
				return this.parseRectParameters(params, lineNumber);
			case "circle":
			case "fillCircle":
				return this.parseCircleParameters(params, lineNumber);
			case "text":
				return this.parseTextParameters(params, lineNumber);
			case "path":
				return this.parsePathParameters(params, lineNumber);
			case "action":
				return this.parseActionParameters(params, lineNumber);
			default:
				throw new ParseError(
					`Unsupported command type: ${commandType}`,
					ParseErrorType.INVALID_COMMAND,
					lineNumber,
				);
		}
	}

	private parseStyleParameters(
		params: string[],
		lineNumber: number,
	): string[] {
		// 检查是否是旧的键值对格式（包含冒号）
		const isKeyValueFormat = params.some(param => param.includes(':'));
		
		if (isKeyValueFormat) {
			// 支持旧的键值对格式：sc:#FF0000,lw:2 等，直接返回参数数组
			for (const param of params) {
				const match = param.match(DSLParser.STYLE_PARAM_REGEX);
				if (!match) {
					throw new ParseError(
						`Invalid style parameter: "${param}"`,
						ParseErrorType.INVALID_PARAMETER,
						lineNumber,
					);
				}

				const [, prop] = match;

				// 验证样式属性
				if (!["sc", "fc", "lw", "f", "fs", "fw", "bg", "bc", "bo"].includes(prop)) {
					throw new ParseError(
						`Unknown style property: "${prop}"`,
						ParseErrorType.INVALID_PARAMETER,
						lineNumber,
					);
				}
			}
			return params;
		} else {
			// 新的固定顺序格式：s(strokeColor,fillColor,lineWidth,fontSize,fontWeight,backgroundColor,borderColor,borderWidth)
			const styleKeys = ["sc", "fc", "lw", "fs", "fw", "bg", "bc", "bo"];
			
			if (params.length === 0 || params.length > styleKeys.length) {
				throw new ParseError(
					`Style command expects 1-${styleKeys.length} parameters in order: strokeColor,fillColor,lineWidth,fontSize,fontWeight,backgroundColor,borderColor,borderWidth`,
					ParseErrorType.INVALID_PARAMETER,
					lineNumber,
				);
			}

			// 转换为键值对格式数组供渲染器使用
			const result: string[] = [];
			for (let i = 0; i < params.length; i++) {
				const value = params[i].trim();
				if (value) { // 只有非空值才设置
					result.push(`${styleKeys[i]}:${value}`);
				}
			}
			return result;
		}
	}

	private parseLineParameters(
		params: string[],
		lineNumber: number,
	): [number, number, number, number] {
		// 固定参数顺序：l(x1,y1,x2,y2)
		if (params.length !== 4) {
			throw new ParseError(
				"Line command requires exactly 4 parameters: x1,y1,x2,y2",
				ParseErrorType.INVALID_PARAMETER,
				lineNumber,
			);
		}

		const x1 = this.parseNumber(params[0], lineNumber);
		const y1 = this.parseNumber(params[1], lineNumber);
		const x2 = this.parseNumber(params[2], lineNumber);
		const y2 = this.parseNumber(params[3], lineNumber);

		return [x1, y1, x2, y2];
	}

	private parseRectParameters(
		params: string[],
		lineNumber: number,
	): [number, number, number, number] {
		// 固定参数顺序：r(x,y,width,height) 或 fr(x,y,width,height)
		if (params.length !== 4) {
			throw new ParseError(
				"Rectangle command requires exactly 4 parameters: x,y,width,height",
				ParseErrorType.INVALID_PARAMETER,
				lineNumber,
			);
		}

		const x = this.parseNumber(params[0], lineNumber);
		const y = this.parseNumber(params[1], lineNumber);
		const width = this.parseNumber(params[2], lineNumber);
		const height = this.parseNumber(params[3], lineNumber);

		if (width <= 0 || height <= 0) {
			throw new ParseError(
				"Rectangle width and height must be positive",
				ParseErrorType.INVALID_PARAMETER,
				lineNumber,
			);
		}

		return [x, y, width, height];
	}

	private parseCircleParameters(
		params: string[],
		lineNumber: number,
	): [number, number, number] {
		// 固定参数顺序：c(x,y,radius) 或 fc(x,y,radius)
		if (params.length !== 3) {
			throw new ParseError(
				"Circle command requires exactly 3 parameters: x,y,radius",
				ParseErrorType.INVALID_PARAMETER,
				lineNumber,
			);
		}

		const x = this.parseNumber(params[0], lineNumber);
		const y = this.parseNumber(params[1], lineNumber);
		const radius = this.parseNumber(params[2], lineNumber);

		if (radius <= 0) {
			throw new ParseError(
				"Circle radius must be positive",
				ParseErrorType.INVALID_PARAMETER,
				lineNumber,
			);
		}

		return [x, y, radius];
	}

	private parseTextParameters(
		params: string[],
		lineNumber: number,
	): [number, number, string] {
		// 固定参数顺序：t(text,x,y)
		if (params.length !== 3) {
			throw new ParseError(
				"Text command requires exactly 3 parameters: text,x,y",
				ParseErrorType.INVALID_PARAMETER,
				lineNumber,
			);
		}

		const text = params[0].trim();
		const x = this.parseNumber(params[1], lineNumber);
		const y = this.parseNumber(params[2], lineNumber);

		if (!text) {
			throw new ParseError(
				"Text content cannot be empty",
				ParseErrorType.INVALID_PARAMETER,
				lineNumber,
			);
		}

		return [x, y, text];
	}

	private parsePathParameters(
		params: string[],
		lineNumber: number,
	): Array<{ x: number; y: number }> {
		// 固定参数顺序：p(x1,y1,x2,y2,x3,y3,...) - 参数数量必须是偶数
		if (params.length < 4) {
			throw new ParseError(
				"Path command requires at least 4 parameters (minimum 2 points): x1,y1,x2,y2,...",
				ParseErrorType.INVALID_PARAMETER,
				lineNumber,
			);
		}

		if (params.length % 2 !== 0) {
			throw new ParseError(
				"Path command requires an even number of parameters (x,y pairs)",
				ParseErrorType.INVALID_PARAMETER,
				lineNumber,
			);
		}

		const points: Array<{ x: number; y: number }> = [];

		for (let i = 0; i < params.length; i += 2) {
			const x = this.parseNumber(params[i], lineNumber);
			const y = this.parseNumber(params[i + 1], lineNumber);
			points.push({ x, y });
		}

		return points;
	}

	private parseActionParameters(
		params: string[],
		lineNumber: number,
	): [number, number, number, number, string] {
		// 固定参数顺序：action(x,y,width,height,eventName)
		if (params.length !== 5) {
			throw new ParseError(
				"Action command requires exactly 5 parameters: x,y,width,height,eventName",
				ParseErrorType.INVALID_PARAMETER,
				lineNumber,
			);
		}

		const x = this.parseNumber(params[0], lineNumber);
		const y = this.parseNumber(params[1], lineNumber);
		const width = this.parseNumber(params[2], lineNumber);
		const height = this.parseNumber(params[3], lineNumber);
		const eventName = params[4].trim();

		if (width <= 0 || height <= 0) {
			throw new ParseError(
				"Action area width and height must be positive",
				ParseErrorType.INVALID_PARAMETER,
				lineNumber,
			);
		}

		if (!eventName || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(eventName)) {
			throw new ParseError(
				"Action event name must be a valid identifier",
				ParseErrorType.INVALID_PARAMETER,
				lineNumber,
			);
		}

		return [x, y, width, height, eventName];
	}


	private parseNumber(numStr: string, lineNumber: number): number {
		const trimmed = numStr.trim();

		if (!trimmed) {
			throw new ParseError(
				"Empty number value",
				ParseErrorType.INVALID_PARAMETER,
				lineNumber,
			);
		}

		const num = parseFloat(trimmed);

		if (isNaN(num)) {
			throw new ParseError(
				`Invalid number: "${trimmed}"`,
				ParseErrorType.TYPE_MISMATCH,
				lineNumber,
			);
		}

		return num;
	}

	/**
	 * 验证命令是否有效（不执行解析，仅检查语法）
	 */
	public validate(input: string): { isValid: boolean; errors: ParseError[] } {
		const errors: ParseError[] = [];

		try {
			this.parse(input);
			return { isValid: true, errors: [] };
		} catch (error) {
			if (error instanceof ParseError) {
				errors.push(error);
			} else {
				errors.push(
					new ParseError(
						"Unknown parsing error: " + (error as Error).message,
						ParseErrorType.SYNTAX_ERROR,
					),
				);
			}
		}

		return { isValid: false, errors };
	}

	/**
	 * 获取命令提示信息 - 新的逗号分隔格式
	 */
	public getCommandHelp(): Record<CommandType, string> {
		return {
			style: "s(strokeColor,fillColor,lineWidth,fontSize,fontWeight,backgroundColor,borderColor,borderWidth) - Set drawing styles (e.g., s(#FF0000,#0000FF,2,16,bold,#FFFFFF,#000000,1))",
			line: "l(x1,y1,x2,y2) - Draw a line (e.g., l(50,620,50,820))",
			rect: "r(x,y,width,height) - Draw rectangle outline (e.g., r(10,10,100,50))",
			fillRect: "fr(x,y,width,height) - Draw filled rectangle (e.g., fr(10,10,100,50))",
			circle: "c(x,y,radius) - Draw circle outline (e.g., c(100,100,30))",
			fillCircle: "fc(x,y,radius) - Draw filled circle (e.g., fc(100,100,30))",
			text: "t(text,x,y) - Draw text (e.g., t(步骤5: 产品网格区域2,100,30))",
			path: "p(x1,y1,x2,y2,x3,y3,...) - Draw path/polyline (e.g., p(10,10,50,30,100,10))",
			clear: "clear() - Clear canvas",
			action: "action(x,y,width,height,eventName) - Register clickable area (e.g., action(50,50,100,80,buttonClick))",
		};
	}
}
