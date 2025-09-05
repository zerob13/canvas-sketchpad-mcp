// 核心类型定义

export interface DSLCommand {
  command: string;
  args: any[];
  line: number;
}

export interface DrawingStyle {
  strokeColor: string;
  fillColor: string;
  lineWidth: number;
  font: string;
}

export interface ClickableArea {
  x: number;
  y: number;
  width: number;
  height: number;
  eventName: string;
}

export interface CanvasEvent {
  type: 'ai-canvas-event';
  payload: {
    eventName: string;
    timestamp: number;
    source: 'canvas-mcp';
  };
}

export type CommandType = 
  | 'style'     // s(sc:#FF0000;lw:3)
  | 'line'      // l(10,10;100,100)  
  | 'rect'      // r(50,50;100,80)
  | 'fillRect'  // fr(50,50;100,80)
  | 'circle'    // c(200,200;50)
  | 'fillCircle'// fc(200,200;50)
  | 'text'      // t(50,60;Hello)
  | 'path'      // p(10,10;50,80;100,20)
  | 'clear'     // clear()
  | 'action';   // action(50,50;100,80;click)

export enum ParseErrorType {
  SYNTAX_ERROR = 'SYNTAX_ERROR',
  INVALID_COMMAND = 'INVALID_COMMAND',
  INVALID_PARAMETER = 'INVALID_PARAMETER',
  TYPE_MISMATCH = 'TYPE_MISMATCH'
}

export class ParseError extends Error {
  constructor(
    message: string,
    public type: ParseErrorType,
    public line?: number,
    public column?: number
  ) {
    super(message);
    this.name = 'ParseError';
  }
}