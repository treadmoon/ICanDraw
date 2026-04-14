/**
 * Chat Pipeline — 把用户的绘图请求拆成子任务
 *
 * Task 1: 分析意图 → 判断类型（chart/drawing/mixed），提取结构
 * Task 2: 生成内容 → AI 只生成逻辑结构（节点、连接），不管坐标
 * Task 3: 布局计算 → 确定性算法计算坐标，不依赖 AI
 * Task 4: 标注生成 → AI 生成标注（可跳过）
 */

import type { TaskDef } from "@/stores/task-engine";
import type { AIResponse, ChartData, Drawing, Annotation, ExcalidrawElementData } from "@/types";
import { validateAndFixAll } from "@/lib/ai/layout-validator";

// ============================================================
// Types
// ============================================================

interface ChatContext {
  userMessage: string;
  history: Array<{ role: string; content: string }>;
  canvasContext: string;
}

interface IntentResult {
  type: "chart" | "drawing" | "mixed";
  chartCount: number;
  drawingType: string | null; // flowchart, mindmap, architecture, etc.
  description: string;
}

interface StructureResult {
  charts: ChartData[];
  /** Nodes without coordinates */
  nodes: Array<{
    id: string;
    type: ExcalidrawElementData["type"];
    text: string;
    backgroundColor?: string;
    width?: number;
    height?: number;
  }>;
  /** Edges referencing node IDs */
  edges: Array<{
    from: string;
    to: string;
    label?: string;
    strokeColor?: string;
  }>;
  summary: string;
}

interface LayoutResult {
  charts: ChartData[];
  drawings: Drawing[];
  summary: string;
}

interface AnnotationResult {
  annotations: Annotation[];
}

// ============================================================
// Prompts (focused, single-responsibility)
// ============================================================

const INTENT_PROMPT = `You analyze user requests for data visualization.
Respond with ONLY valid JSON:
{
  "type": "chart" | "drawing" | "mixed",
  "chartCount": number,
  "drawingType": "flowchart" | "mindmap" | "architecture" | "er" | "sequence" | null,
  "description": "brief description of what to generate"
}`;

const STRUCTURE_PROMPT = `You generate the LOGICAL STRUCTURE of diagrams. Do NOT generate coordinates.

## For charts
Return complete ECharts option objects with id, width, height.

## For drawings
Return ONLY nodes and edges. The layout engine will calculate positions.

Node format: { "id": "unique-id", "type": "rectangle|diamond|ellipse|text", "text": "显示文本", "backgroundColor": "#color", "width": 160, "height": 60 }
Edge format: { "from": "node-id", "to": "node-id", "label": "optional label", "strokeColor": "#color" }

## Color rules
- "#a5d8ff" normal steps, "#fff3bf" decisions, "#b2f2bb" success/end, "#ffc9c9" error, "#e7f5ff" start

## Output format
{
  "charts": [{ "id": "chart-1", "width": 500, "height": 350, "option": { ECharts option } }],
  "nodes": [{ "id": "n1", "type": "rectangle", "text": "步骤1", "backgroundColor": "#a5d8ff" }],
  "edges": [{ "from": "n1", "to": "n2", "label": "是" }],
  "summary": "生成了什么"
}

IMPORTANT: Do NOT include x, y coordinates. Only structure and content.`;

const ANNOTATION_PROMPT = `You add annotations to highlight key insights on charts/diagrams.
Return ONLY: { "annotations": [{ "id": "ann-1", "elements": [{ "type": "text", "x": number, "y": number, "text": "insight" }] }] }
Keep annotations minimal — 1-2 per chart.`;

// ============================================================
// Layout Algorithm (deterministic, no AI)
// ============================================================

const LAYOUT = {
  startX: 100,
  startY: 100,
  nodeGapX: 200,
  nodeGapY: 120,
  defaultW: 160,
  defaultH: 60,
  diamondW: 140,
  diamondH: 80,
  ellipseW: 140,
  ellipseH: 60,
};

function computeLayout(
  nodes: StructureResult["nodes"],
  edges: StructureResult["edges"]
): ExcalidrawElementData[] {
  if (nodes.length === 0) return [];

  // Build adjacency for topological sort
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const n of nodes) {
    adj.set(n.id, []);
    inDegree.set(n.id, 0);
  }
  for (const e of edges) {
    adj.get(e.from)?.push(e.to);
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
  }

  // Topological sort (Kahn's algorithm) for layered layout
  const layers: string[][] = [];
  let queue = nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0).map((n) => n.id);

  if (queue.length === 0) queue = [nodes[0].id]; // fallback: break cycle

  const visited = new Set<string>();
  while (queue.length > 0) {
    layers.push([...queue]);
    const nextQueue: string[] = [];
    for (const id of queue) {
      visited.add(id);
      for (const next of adj.get(id) ?? []) {
        const deg = (inDegree.get(next) ?? 1) - 1;
        inDegree.set(next, deg);
        if (deg <= 0 && !visited.has(next)) {
          nextQueue.push(next);
        }
      }
    }
    queue = nextQueue;
  }

  // Add any unvisited nodes (cycles) to last layer
  for (const n of nodes) {
    if (!visited.has(n.id)) {
      if (layers.length === 0) layers.push([]);
      layers[layers.length - 1].push(n.id);
    }
  }

  // Assign coordinates by layer
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const posMap = new Map<string, { x: number; y: number; w: number; h: number }>();

  for (let row = 0; row < layers.length; row++) {
    const layer = layers[row];
    const totalWidth = layer.reduce((sum, id) => {
      const n = nodeMap.get(id)!;
      return sum + (n.width ?? LAYOUT.defaultW);
    }, 0) + (layer.length - 1) * LAYOUT.nodeGapX;

    let x = LAYOUT.startX + Math.max(0, (800 - totalWidth) / 2); // center

    for (const id of layer) {
      const n = nodeMap.get(id)!;
      const w = n.width ?? (n.type === "diamond" ? LAYOUT.diamondW : n.type === "ellipse" ? LAYOUT.ellipseW : LAYOUT.defaultW);
      const h = n.height ?? (n.type === "diamond" ? LAYOUT.diamondH : n.type === "ellipse" ? LAYOUT.ellipseH : LAYOUT.defaultH);
      const y = LAYOUT.startY + row * LAYOUT.nodeGapY;
      posMap.set(id, { x, y, w, h });
      x += w + LAYOUT.nodeGapX;
    }
  }

  // Build elements
  const elements: ExcalidrawElementData[] = [];

  // Nodes
  for (const n of nodes) {
    const pos = posMap.get(n.id);
    if (!pos) continue;
    elements.push({
      type: n.type === "text" ? "text" : n.type,
      x: pos.x,
      y: pos.y,
      width: pos.w,
      height: pos.h,
      text: n.text,
      backgroundColor: n.backgroundColor,
    });
  }

  // Arrows
  for (const e of edges) {
    const from = posMap.get(e.from);
    const to = posMap.get(e.to);
    if (!from || !to) continue;

    // Smart anchor selection
    const fromCx = from.x + from.w / 2;
    const fromCy = from.y + from.h / 2;
    const toCx = to.x + to.w / 2;
    const toCy = to.y + to.h / 2;
    const dx = toCx - fromCx;
    const dy = toCy - fromCy;

    let startX: number, startY: number, endX: number, endY: number;

    if (Math.abs(dy) > Math.abs(dx)) {
      // Vertical connection
      if (dy > 0) {
        startX = from.x + from.w / 2; startY = from.y + from.h;
        endX = to.x + to.w / 2; endY = to.y;
      } else {
        startX = from.x + from.w / 2; startY = from.y;
        endX = to.x + to.w / 2; endY = to.y + to.h;
      }
    } else {
      // Horizontal connection
      if (dx > 0) {
        startX = from.x + from.w; startY = from.y + from.h / 2;
        endX = to.x; endY = to.y + to.h / 2;
      } else {
        startX = from.x; startY = from.y + from.h / 2;
        endX = to.x + to.w; endY = to.y + to.h / 2;
      }
    }

    elements.push({
      type: "arrow",
      x: startX,
      y: startY,
      points: [[0, 0], [endX - startX, endY - startY]],
      strokeColor: e.strokeColor,
    });

    // Edge label
    if (e.label) {
      elements.push({
        type: "text",
        x: (startX + endX) / 2 - 15,
        y: (startY + endY) / 2 - 10,
        text: e.label,
      });
    }
  }

  return elements;
}

// ============================================================
// AI Call Helper
// ============================================================

async function callAI(
  systemPrompt: string,
  userContent: string,
  signal: AbortSignal
): Promise<string> {
  const res = await fetch("/api/chat/raw", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemPrompt, userContent }),
    signal,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `AI 请求失败 (${res.status})`);
  }

  const data = await res.json();
  return data.content;
}

function parseJSON<T>(raw: string): T {
  let cleaned = raw.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) cleaned = fence[1].trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to fix truncated JSON
    let patched = cleaned;
    const opens = (patched.match(/[{[]/g) || []).length;
    const closes = (patched.match(/[}\]]/g) || []).length;
    for (let i = 0; i < opens - closes; i++) {
      patched += patched.lastIndexOf("{") > patched.lastIndexOf("[") ? "}" : "]";
    }
    return JSON.parse(patched);
  }
}

// ============================================================
// Task Definitions
// ============================================================

export function createChatTasks(context: ChatContext): TaskDef[] {
  const tasks: TaskDef[] = [];

  // Task 1: Analyze Intent
  tasks.push({
    id: "intent",
    name: "分析意图",
    buildInput: () => context,
    execute: async (input: unknown, signal: AbortSignal) => {
      const ctx = input as ChatContext;
      const raw = await callAI(INTENT_PROMPT, ctx.userMessage, signal);
      return parseJSON<IntentResult>(raw);
    },
  });

  // Task 2: Generate Structure
  tasks.push({
    id: "structure",
    name: "生成结构",
    buildInput: (prev) => ({
      context,
      intent: prev.get("intent") as IntentResult,
    }),
    execute: async (input: unknown, signal: AbortSignal) => {
      const { context: ctx, intent } = input as { context: ChatContext; intent: IntentResult };
      const historyStr = ctx.history
        .slice(-6)
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n");

      const userContent = [
        ctx.canvasContext,
        `对话历史:\n${historyStr}`,
        `用户请求: ${ctx.userMessage}`,
        `意图分析: ${JSON.stringify(intent)}`,
      ].filter(Boolean).join("\n\n");

      const raw = await callAI(STRUCTURE_PROMPT, userContent, signal);
      return parseJSON<StructureResult>(raw);
    },
  });

  // Task 3: Compute Layout (deterministic, no AI call)
  tasks.push({
    id: "layout",
    name: "计算布局",
    buildInput: (prev) => prev.get("structure") as StructureResult,
    execute: async (input: unknown) => {
      const structure = input as StructureResult;
      const elements = computeLayout(structure.nodes, structure.edges);

      const drawings: Drawing[] = elements.length > 0
        ? [{ id: "drawing-0", elements }]
        : [];

      // Run layout validator
      const fixedDrawings = await validateAndFixAll(drawings);

      // Position charts
      const charts: ChartData[] = (structure.charts ?? []).map((c, i) => ({
        ...c,
        x: c.x ?? 100 + i * 550,
        y: c.y ?? (elements.length > 0 ? 500 : 100),
      }));

      return {
        charts,
        drawings: fixedDrawings,
        summary: structure.summary,
      } as LayoutResult;
    },
  });

  // Task 4: Generate Annotations (skippable)
  tasks.push({
    id: "annotations",
    name: "生成标注",
    skippable: true,
    buildInput: (prev) => prev.get("layout") as LayoutResult,
    execute: async (input: unknown, signal: AbortSignal) => {
      const layout = input as LayoutResult;
      if (layout.charts.length === 0 && layout.drawings.length === 0) {
        return { annotations: [] } as AnnotationResult;
      }

      const raw = await callAI(
        ANNOTATION_PROMPT,
        `当前画布内容: ${layout.summary}\n图表数: ${layout.charts.length}\n绘图数: ${layout.drawings.length}`,
        signal
      );
      return parseJSON<AnnotationResult>(raw);
    },
  });

  return tasks;
}

/**
 * Assemble final AIResponse from task results
 */
export function assembleResponse(results: Record<string, unknown>): AIResponse | null {
  const layout = results["layout"] as LayoutResult | null;
  if (!layout) return null;

  const annotations = (results["annotations"] as AnnotationResult | null)?.annotations ?? [];

  return {
    charts: layout.charts,
    drawings: layout.drawings,
    annotations,
    summary: layout.summary,
  };
}
