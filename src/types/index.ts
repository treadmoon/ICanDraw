import type { EChartsOption } from "echarts";

// --- Chart data from AI ---

export interface ChartData {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  option: EChartsOption;
}

// --- Excalidraw element data (shared by drawings & annotations) ---

export interface ExcalidrawElementData {
  type: "arrow" | "text" | "ellipse" | "rectangle" | "diamond" | "line";
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  strokeColor?: string;
  backgroundColor?: string;
  points?: number[][];
}

// --- Drawing: standalone Excalidraw diagram (flowchart, mindmap, etc.) ---

export interface Drawing {
  id: string;
  elements: ExcalidrawElementData[];
}

// --- Annotation: supplementary marks bound to a chart ---

export interface Annotation {
  id: string;
  bindTo?: string;
  elements: ExcalidrawElementData[];
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
  charts: ChartData[];
  drawings: Drawing[];
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
