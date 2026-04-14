// GIF编辑状态接口
export interface GifEditState {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  scale: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  texts: TextElement[];
  drawings: DrawingElement[];
  isHue:number
}

export interface TextElement {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  fontWeight: string;
  direction: 'horizontal' | 'vertical';
}

export interface DrawingElement {
  id: string;
  type: 'brush' | 'line' | 'rect' | 'circle';
  points: { x: number; y: number }[];
  color: string;
  lineWidth: number;
}

export type EditMode = 'resize' | 'text' | 'draw';
export type DrawingTool = 'brush' | 'line' | 'rect' | 'circle'; 