import type { EChartsOption } from "echarts";

// --- Canvas State Types ---

export interface ChartInstance {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  option: EChartsOption;
}

export interface Annotation {
  id: string;
  bindTo?: string; // chart id
  elements: ExcalidrawElementData[];
}

export interface ExcalidrawElementData {
  type: "arrow" | "text" | "ellipse" | "rectangle" | "line";
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  strokeColor?: string;
  points?: number[][];
}

export interface CanvasState {
  charts: ChartInstance[];
  annotations: Annotation[];
}

// --- Chat Types ---

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  canvasDiff?: AIResponse | null;
}

// --- AI Response Types ---

export interface AIResponse {
  charts: ChartInstance[];
  annotations: Annotation[];
  summary: string;
}

// --- CSV Types ---

export interface CsvSchema {
  columns: CsvColumn[];
  rowCount: number;
  preview: Record<string, string>[];
}

export interface CsvColumn {
  name: string;
  type: "number" | "string" | "date";
  min?: number;
  max?: number;
  mean?: number;
}
