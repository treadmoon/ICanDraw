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

/** 源码位置标记 - 用于流程图溯源 */
export interface SourceLocation {
  file: string;
  function?: string;
  line?: number;
  event?: string;
}

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
  // 溯源字段 - 用于学习目的
  sourceLocation?: SourceLocation;
  apiRoute?: string;
  flowDescription?: string;
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

// --- GitHub Project Analysis Types ---

export type DiagramType =
  | "architecture"
  | "module-graph"
  | "data-flow"
  | "state-machine"
  | "flowchart"
  | "overview";

export interface RepoInfo {
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  defaultBranch: string;
}

export interface FileNode {
  path: string;
  name: string;
  type: "file" | "dir";
  size?: number;
  children?: FileNode[];
}

export interface ModuleNode {
  id: string;
  name: string;
  path: string;
  type: "component" | "hook" | "store" | "api" | "lib" | "page" | "config" | "module";
  connections: number;
}

export interface ModuleEdge {
  from: string;
  to: string;
  type: "imports" | "exports" | "calls";
}

export interface ModuleGraph {
  nodes: ModuleNode[];
  edges: ModuleEdge[];
}

export interface ProjectDiagram {
  type: DiagramType;
  title: string;
  drawings: Drawing[];
  charts: ChartData[];
  annotations: Annotation[];
}

export interface ProjectAnalysis {
  repoInfo: RepoInfo;
  fileTree: FileNode[];
  moduleGraph: ModuleGraph;
  diagrams: ProjectDiagram[];
  summary: string;
}
