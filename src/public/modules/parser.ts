// DSL 解析器 - 解析绘图命令语法

import type { DSLCommand, CommandType, ParseErrorType } from "./types.js";
import { ParseError } from "./types.js";

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

		const params = paramsStr.split(";").map((p) => p.trim());

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
	): Record<string, string> {
		const styleProps: Record<string, string> = {};

		for (const param of params) {
			const match = param.match(DSLParser.STYLE_PARAM_REGEX);
			if (!match) {
				throw new ParseError(
					`Invalid style parameter: "${param}"`,
					ParseErrorType.INVALID_PARAMETER,
					lineNumber,
				);
			}

			const [, prop, value] = match;

			// 验证样式属性
			if (!["sc", "fc", "lw", "f"].includes(prop)) {
				throw new ParseError(
					`Unknown style property: "${prop}"`,
					ParseErrorType.INVALID_PARAMETER,
					lineNumber,
				);
			}

			styleProps[prop] = value.trim();
		}

		return styleProps;
	}

	private parseLineParameters(
		params: string[],
		lineNumber: number,
	): [number, number, number, number] {
		if (params.length !== 2) {
			throw new ParseError(
				"Line command requires exactly 2 parameters: x1,y1;x2,y2",
				ParseErrorType.INVALID_PARAMETER,
				lineNumber,
			);
		}

		const start = this.parseCoordinate(params[0], lineNumber);
		const end = this.parseCoordinate(params[1], lineNumber);

		return [start.x, start.y, end.x, end.y];
	}

	private parseRectParameters(
		params: string[],
		lineNumber: number,
	): [number, number, number, number] {
		if (params.length !== 2) {
			throw new ParseError(
				"Rectangle command requires exactly 2 parameters: x,y;w,h",
				ParseErrorType.INVALID_PARAMETER,
				lineNumber,
			);
		}

		const position = this.parseCoordinate(params[0], lineNumber);
		const size = this.parseCoordinate(params[1], lineNumber);

		if (size.x <= 0 || size.y <= 0) {
			throw new ParseError(
				"Rectangle width and height must be positive",
				ParseErrorType.INVALID_PARAMETER,
				lineNumber,
			);
		}

		return [position.x, position.y, size.x, size.y];
	}

	private parseCircleParameters(
		params: string[],
		lineNumber: number,
	): [number, number, number] {
		if (params.length !== 2) {
			throw new ParseError(
				"Circle command requires exactly 2 parameters: x,y;radius",
				ParseErrorType.INVALID_PARAMETER,
				lineNumber,
			);
		}

		const center = this.parseCoordinate(params[0], lineNumber);
		const radius = this.parseNumber(params[1], lineNumber);

		if (radius <= 0) {
			throw new ParseError(
				"Circle radius must be positive",
				ParseErrorType.INVALID_PARAMETER,
				lineNumber,
			);
		}

		return [center.x, center.y, radius];
	}

	private parseTextParameters(
		params: string[],
		lineNumber: number,
	): [number, number, string] {
		if (params.length !== 2) {
			throw new ParseError(
				"Text command requires exactly 2 parameters: x,y;text",
				ParseErrorType.INVALID_PARAMETER,
				lineNumber,
			);
		}

		const position = this.parseCoordinate(params[0], lineNumber);
		const text = params[1].trim();

		if (!text) {
			throw new ParseError(
				"Text content cannot be empty",
				ParseErrorType.INVALID_PARAMETER,
				lineNumber,
			);
		}

		return [position.x, position.y, text];
	}

	private parsePathParameters(
		params: string[],
		lineNumber: number,
	): Array<{ x: number; y: number }> {
		if (params.length < 2) {
			throw new ParseError(
				"Path command requires at least 2 coordinate pairs",
				ParseErrorType.INVALID_PARAMETER,
				lineNumber,
			);
		}

		const points: Array<{ x: number; y: number }> = [];

		for (const param of params) {
			const point = this.parseCoordinate(param, lineNumber);
			points.push(point);
		}

		return points;
	}

	private parseActionParameters(
		params: string[],
		lineNumber: number,
	): [number, number, number, number, string] {
		if (params.length !== 3) {
			throw new ParseError(
				"Action command requires exactly 3 parameters: x,y;w,h;eventName",
				ParseErrorType.INVALID_PARAMETER,
				lineNumber,
			);
		}

		const position = this.parseCoordinate(params[0], lineNumber);
		const size = this.parseCoordinate(params[1], lineNumber);
		const eventName = params[2].trim();

		if (size.x <= 0 || size.y <= 0) {
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

		return [position.x, position.y, size.x, size.y, eventName];
	}

	private parseCoordinate(
		coordStr: string,
		lineNumber: number,
	): { x: number; y: number } {
		const parts = coordStr.split(",").map((p) => p.trim());

		if (parts.length !== 2) {
			throw new ParseError(
				`Invalid coordinate format: "${coordStr}". Expected: "x,y"`,
				ParseErrorType.INVALID_PARAMETER,
				lineNumber,
			);
		}

		const x = this.parseNumber(parts[0], lineNumber);
		const y = this.parseNumber(parts[1], lineNumber);

		return { x, y };
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
	 * 获取命令提示信息
	 */
	public getCommandHelp(): Record<CommandType, string> {
		return {
			style: "s(sc:#FF0000;lw:3) - Set drawing styles",
			line: "l(x1,y1;x2,y2) - Draw a line",
			rect: "r(x,y;w,h) - Draw rectangle outline",
			fillRect: "fr(x,y;w,h) - Draw filled rectangle",
			circle: "c(x,y;radius) - Draw circle outline",
			fillCircle: "fc(x,y;radius) - Draw filled circle",
			text: "t(x,y;text) - Draw text",
			path: "p(x1,y1;x2,y2;...) - Draw path/polyline",
			clear: "clear() - Clear canvas",
			action: "action(x,y;w,h;eventName) - Register clickable area",
		};
	}
}
