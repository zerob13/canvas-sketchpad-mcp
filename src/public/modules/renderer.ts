// Canvas 渲染器 - 处理所有 Canvas 绘制操作

import type { DSLCommand, CommandType, DrawingStyle, ClickableArea } from './types.js';
import { StateManager } from './state.js';

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
        case 'style':
          this.executeStyleCommand(command);
          break;
        case 'line':
          this.executeLineCommand(command);
          break;
        case 'rect':
          this.executeRectCommand(command);
          break;
        case 'fillRect':
          this.executeFillRectCommand(command);
          break;
        case 'circle':
          this.executeCircleCommand(command);
          break;
        case 'fillCircle':
          this.executeFillCircleCommand(command);
          break;
        case 'text':
          this.executeTextCommand(command);
          break;
        case 'path':
          this.executePathCommand(command);
          break;
        case 'clear':
          this.executeClearCommand(command);
          break;
        case 'action':
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
      's': 'style',
      'l': 'line',
      'r': 'rect',
      'fr': 'fillRect',
      'c': 'circle',
      'fc': 'fillCircle',
      't': 'text',
      'p': 'path',
      'clear': 'clear',
      'action': 'action'
    };
    
    return commandMap[command] || command as CommandType;
  }

  /**
   * 应用当前样式到 Canvas 上下文
   */
  private applyStyles(): void {
    const currentStyle = this.stateManager.currentStyle;
    
    // 只在样式发生变化时应用，避免重复设置
    if (!this.lastAppliedStyle || this.isStyleDifferent(currentStyle, this.lastAppliedStyle)) {
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
  private isStyleDifferent(style1: DrawingStyle, style2: DrawingStyle): boolean {
    return style1.strokeColor !== style2.strokeColor ||
           style1.fillColor !== style2.fillColor ||
           style1.lineWidth !== style2.lineWidth ||
           style1.font !== style2.font;
  }

  /**
   * 执行样式命令: s(sc:#FF0000;lw:3;fc:#00FF00;f:16px Arial)
   */
  private executeStyleCommand(command: DSLCommand): void {
    const styleUpdates: Partial<DrawingStyle> = {};
    
    for (const arg of command.args) {
      if (typeof arg === 'string' && arg.includes(':')) {
        const [key, value] = arg.split(':', 2);
        
        switch (key.trim()) {
          case 'sc': // strokeColor
            styleUpdates.strokeColor = this.stateManager.parseColor(value.trim());
            break;
          case 'fc': // fillColor
            styleUpdates.fillColor = this.stateManager.parseColor(value.trim());
            break;
          case 'lw': // lineWidth
            styleUpdates.lineWidth = this.stateManager.parseLineWidth(value.trim());
            break;
          case 'f': // font
            styleUpdates.font = this.stateManager.parseFont(value.trim());
            break;
          default:
            console.warn(`Unknown style property: ${key}`);
        }
      }
    }
    
    this.stateManager.updateStyle(styleUpdates);
  }

  /**
   * 执行线条命令: l(10,10;100,100)
   */
  private executeLineCommand(command: DSLCommand): void {
    if (command.args.length < 2) {
      throw new Error(`Line command requires 2 coordinate arguments, got ${command.args.length}`);
    }
    
    const [start, end] = command.args;
    const [x1, y1] = this.parseCoordinate(start);
    const [x2, y2] = this.parseCoordinate(end);
    
    this.applyStyles();
    
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
  }

  /**
   * 执行矩形命令: r(50,50;100,80)
   */
  private executeRectCommand(command: DSLCommand): void {
    if (command.args.length < 2) {
      throw new Error(`Rectangle command requires 2 arguments, got ${command.args.length}`);
    }
    
    const [position, size] = command.args;
    const [x, y] = this.parseCoordinate(position);
    const [width, height] = this.parseCoordinate(size);
    
    this.applyStyles();
    this.ctx.strokeRect(x, y, width, height);
  }

  /**
   * 执行填充矩形命令: fr(50,50;100,80)
   */
  private executeFillRectCommand(command: DSLCommand): void {
    if (command.args.length < 2) {
      throw new Error(`Fill rectangle command requires 2 arguments, got ${command.args.length}`);
    }
    
    const [position, size] = command.args;
    const [x, y] = this.parseCoordinate(position);
    const [width, height] = this.parseCoordinate(size);
    
    this.applyStyles();
    this.ctx.fillRect(x, y, width, height);
  }

  /**
   * 执行圆形命令: c(200,200;50)
   */
  private executeCircleCommand(command: DSLCommand): void {
    if (command.args.length < 2) {
      throw new Error(`Circle command requires 2 arguments, got ${command.args.length}`);
    }
    
    const [center, radiusArg] = command.args;
    const [x, y] = this.parseCoordinate(center);
    const radius = this.parseNumber(radiusArg);
    
    this.applyStyles();
    
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
    this.ctx.stroke();
  }

  /**
   * 执行填充圆形命令: fc(200,200;50)
   */
  private executeFillCircleCommand(command: DSLCommand): void {
    if (command.args.length < 2) {
      throw new Error(`Fill circle command requires 2 arguments, got ${command.args.length}`);
    }
    
    const [center, radiusArg] = command.args;
    const [x, y] = this.parseCoordinate(center);
    const radius = this.parseNumber(radiusArg);
    
    this.applyStyles();
    
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
    this.ctx.fill();
  }

  /**
   * 执行文本命令: t(50,60;Hello World)
   */
  private executeTextCommand(command: DSLCommand): void {
    if (command.args.length < 2) {
      throw new Error(`Text command requires 2 arguments, got ${command.args.length}`);
    }
    
    const [position, text] = command.args;
    const [x, y] = this.parseCoordinate(position);
    
    this.applyStyles();
    this.ctx.fillText(String(text), x, y);
  }

  /**
   * 执行路径命令: p(10,10;50,80;100,20)
   */
  private executePathCommand(command: DSLCommand): void {
    if (command.args.length < 2) {
      throw new Error(`Path command requires at least 2 coordinate arguments, got ${command.args.length}`);
    }
    
    this.applyStyles();
    
    this.ctx.beginPath();
    
    // 移动到第一个点
    const [firstX, firstY] = this.parseCoordinate(command.args[0]);
    this.ctx.moveTo(firstX, firstY);
    
    // 连接到其余点
    for (let i = 1; i < command.args.length; i++) {
      const [x, y] = this.parseCoordinate(command.args[i]);
      this.ctx.lineTo(x, y);
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
   * 执行动作命令: action(50,50;100,80;button_click)
   */
  private executeActionCommand(command: DSLCommand): void {
    if (command.args.length < 3) {
      throw new Error(`Action command requires 3 arguments, got ${command.args.length}`);
    }
    
    const [position, size, eventName] = command.args;
    const [x, y] = this.parseCoordinate(position);
    const [width, height] = this.parseCoordinate(size);
    
    const clickableArea: ClickableArea = {
      x,
      y,
      width,
      height,
      eventName: String(eventName)
    };
    
    this.stateManager.addAction(clickableArea);
  }

  /**
   * 解析坐标字符串 "x,y" -> [x, y]
   */
  private parseCoordinate(coord: any): [number, number] {
    if (typeof coord !== 'string') {
      throw new Error(`Invalid coordinate format: ${coord}`);
    }
    
    const parts = coord.split(',');
    if (parts.length !== 2) {
      throw new Error(`Invalid coordinate format: ${coord}, expected "x,y"`);
    }
    
    const x = parseFloat(parts[0].trim());
    const y = parseFloat(parts[1].trim());
    
    if (isNaN(x) || isNaN(y)) {
      throw new Error(`Invalid coordinate values: ${coord}`);
    }
    
    return [x, y];
  }

  /**
   * 解析数字参数
   */
  private parseNumber(value: any): number {
    const num = typeof value === 'string' ? parseFloat(value) : Number(value);
    
    if (isNaN(num)) {
      throw new Error(`Invalid number format: ${value}`);
    }
    
    return num;
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
        height: this.ctx.canvas.height
      },
      currentTransform: this.ctx.getTransform(),
      currentStyle: this.stateManager.currentStyle
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