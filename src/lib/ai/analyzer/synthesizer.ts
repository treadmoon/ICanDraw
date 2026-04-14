/**
 * Synthesizer Agent - Phase 3
 * Takes all analysis results and generates final diagrams
 * With post-processing layout algorithm
 */

import type { ModuleAnalysisResult, DiagramSpec, FlowNode, FlowEdge, SourceLocation } from "./modules";
import type { ProjectProfile } from "./intent";

// Color palette by module type
const TYPE_COLORS: Record<string, string> = {
  component: "#4dabf7",
  hook: "#74c0fc",
  store: "#63e6be",
  api: "#ffd43b",
  lib: "#b197fc",
  page: "#ffa8a8",
  config: "#ffe066",
  default: "#4dabf7",
};

// Element sizes
const SIZES = {
  rectangle: { width: 160, height: 60 },
  diamond: { width: 140, height: 80 },
  ellipse: { width: 140, height: 60 },
  text: { width: 80, height: 30 },
};

// Viewport constraints
const VIEWPORT = { minX: 50, maxX: 1150, minY: 50, maxY: 750 };
const GAP_X = 150;
const GAP_Y = 100;
const START_X = 100;
const START_Y = 100;

/**
 * Post-process diagrams with layout algorithm
 * This fixes coordinates that AI generates poorly
 * Preserves sourceLocation for learning traceability
 */
function layoutModuleGraph(
  nodes: FlowNode[],
  _edges: FlowEdge[]
): Array<{
  x: number; y: number; width: number; height: number;
  id: string; label: string; type: "rectangle";
  backgroundColor: string;
  sourceLocation?: SourceLocation;
  path?: string;
  functionName?: string;
  description?: string;
}> {
  if (nodes.length === 0) return [];

  // Simple grid layout algorithm
  const cols = Math.min(3, Math.ceil(Math.sqrt(nodes.length)));
  const elementWidth = SIZES.rectangle.width;
  const elementHeight = SIZES.rectangle.height;

  return nodes.map((node, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);

    return {
      id: node.id,
      x: START_X + col * (elementWidth + GAP_X),
      y: START_Y + row * (elementHeight + GAP_Y),
      width: elementWidth,
      height: elementHeight,
      label: node.name.length > 12 ? node.name.slice(0, 12) : node.name,
      type: "rectangle" as const,
      backgroundColor: TYPE_COLORS[node.type] ?? TYPE_COLORS.default,
      // Preserve source tracing info
      sourceLocation: node.sourceLocation || { file: node.path, function: node.functionName },
      path: node.path,
      functionName: node.functionName,
      description: node.description,
    };
  });
}

/**
 * Generate arrows for module graph edges
 * Preserves sourceLocation and apiRoute for learning traceability
 */
function layoutModuleArrows(
  nodes: Array<{ id: string; x: number; y: number; width: number; height: number }>,
  edges: FlowEdge[]
): Array<{
  x: number; y: number; points: number[][];
  type: "arrow"; strokeColor: string; label: string;
  sourceLocation?: SourceLocation;
  apiRoute?: string;
  flowDescription?: string;
}> {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return edges.map((edge, i) => {
    const from = nodeMap.get(edge.from);
    const to = nodeMap.get(edge.to);

    if (!from || !to) {
      return {
        x: 0,
        y: 0,
        points: [[0, 0], [100, 0]],
        type: "arrow" as const,
        strokeColor: "#495057",
        label: `edge-${i}`,
        sourceLocation: edge.sourceLocation,
        apiRoute: edge.apiRoute,
        flowDescription: edge.description,
      };
    }

    // Calculate arrow from center-bottom of source to center-top of target
    const fromX = from.x + from.width / 2;
    const fromY = from.y + from.height;
    const toX = to.x + to.width / 2;
    const toY = to.y;

    const points: number[][] = [[0, 0]];

    if (Math.abs(fromX - toX) < 10) {
      // Vertical arrow
      points.push([0, toY - fromY]);
    } else {
      // L-shaped arrow
      const midY = (fromY + toY) / 2;
      points.push([0, midY - fromY]);
      points.push([toX - fromX, midY - fromY]);
      points.push([toX - fromX, toY - fromY]);
    }

    // Build label from edge info
    const edgeLabel = edge.apiRoute || edge.description || `edge-${i}`;

    return {
      x: fromX,
      y: fromY,
      points,
      type: "arrow" as const,
      strokeColor: "#495057",
      label: edgeLabel,
      // Preserve source tracing info
      sourceLocation: edge.sourceLocation,
      apiRoute: edge.apiRoute,
      flowDescription: edge.description,
    };
  });
}

/**
 * Validate and fix element coordinates to be within viewport
 */
function validateElement(el: Record<string, unknown>): Record<string, unknown> {
  const x = Number(el.x) || 0;
  const y = Number(el.y) || 0;
  const width = Number(el.width) || 100;
  const height = Number(el.height) || 50;

  // Clamp to viewport
  return {
    ...el,
    x: Math.max(VIEWPORT.minX, Math.min(x, VIEWPORT.maxX - width)),
    y: Math.max(VIEWPORT.minY, Math.min(y, VIEWPORT.maxY - height)),
  };
}

const FEW_SHOT_EXAMPLE = `

## Example Output (for reference):

Input: A small React project with 4 modules
Output:
{
  "summary": "这是一个 React Web 应用，使用 Zustand 状态管理",
  "keyInsights": ["采用组件化架构", "使用 Zustand 管理全局状态", "API 层与组件解耦"],
  "diagrams": [
    {
      "type": "module-graph",
      "title": "模块关系图",
      "summary": "展示核心模块及其依赖关系",
      "elements": [
        {"type": "rectangle", "id": "n1", "x": 100, "y": 100, "width": 160, "height": 60, "text": "App", "backgroundColor": "#4dabf7"},
        {"type": "rectangle", "id": "n2", "x": 400, "y": 100, "width": 160, "height": 60, "text": "useAuth", "backgroundColor": "#74c0fc"},
        {"type": "rectangle", "id": "n3", "x": 100, "y": 260, "width": 160, "height": 60, "text": "apiStore", "backgroundColor": "#63e6be"},
        {"type": "arrow", "id": "e1", "x": 260, "y": 130, "points": [[0,0],[140,0]], "strokeColor": "#495057"}
      ]
    }
  ]
}`;

const SYNTHESIS_PROMPT = `You are a senior architect creating beautiful architecture diagrams using Excalidraw.

## Your Mission
Based on the REAL project analysis data, create accurate diagrams. Use ONLY real module names from moduleGraph.

## CRITICAL RULES
1. Use ONLY real module names from moduleGraph.nodes
2. Do NOT invent modules like "模块A" or "Module X"
3. If moduleGraph is empty, create a simple architecture diagram based on techStack
4. Keep all elements within viewport (x: 50-1150, y: 50-750)

## LAYOUT ALGORITHM

For module-graph (grid layout):
- 3 columns maximum
- Start at x=100, y=100
- Element size: 160x60
- Gap: 150px horizontal, 100px vertical
- Calculate positions: x = 100 + col*(160+150), y = 100 + row*(60+100)

For architecture (3 layers):
- Layer 1 y=80: Frontend
- Layer 2 y=260: Business Logic
- Layer 3 y=440: Data Storage

## COLOR CODING
- component: #4dabf7 (blue)
- hook: #74c0fc (light blue)
- store: #63e6be (teal)
- api: #ffd43b (yellow)
- lib: #b197fc (purple)
- page: #ffa8a8 (coral)
- config: #ffe066 (gold)

## ELEMENT SIZES
- rectangle: width=160, height=60
- diamond: width=140, height=80
- ellipse: width=140, height=60
- Arrow points are relative to arrow x,y position

## OUTPUT FORMAT
{
  "summary": "项目概要（2-3句）",
  "keyInsights": ["关键发现1", "关键发现2", "关键发现3"],
  "diagrams": [
    {
      "type": "module-graph",
      "title": "模块关系图",
      "summary": "这张图展示什么",
      "elements": [
        {"type": "rectangle", "id": "unique-id", "x": 100, "y": 100, "width": 160, "height": 60, "text": "模块名", "backgroundColor": "#4dabf7"},
        {"type": "arrow", "id": "arrow-1", "x": 260, "y": 130, "points": [[0,0],[100,0]], "strokeColor": "#495057"}
      ]
    }
  ]
}

Generate 2-3 diagrams. All labels in Chinese.${FEW_SHOT_EXAMPLE}`;

/**
 * Convert DiagramSpec to Excalidraw elements format
 */
export function convertToExcalidrawElements(
  spec: DiagramSpec,
  offsetX = 0,
  offsetY = 0
): Array<Record<string, unknown>> {
  return spec.elements.map((el, i) => {
    const id = `${spec.type}-${spec.title}-${i}`;

    if (el.type === "arrow") {
      return {
        type: "arrow",
        id,
        x: (el.x ?? 0) + offsetX,
        y: (el.y ?? 0) + offsetY,
        points: el.points ?? [[0, 0], [100, 0]],
        strokeColor: el.strokeColor ?? "#495057",
        backgroundColor: "transparent",
        // Preserve source tracing for learning
        label: el.label,
        sourceLocation: el.sourceLocation,
        apiRoute: el.apiRoute,
        flowDescription: el.flowDescription,
      };
    }

    if (el.type === "text") {
      return {
        type: "text",
        id,
        x: (el.x ?? 0) + offsetX,
        y: (el.y ?? 0) + offsetY,
        text: el.text ?? el.label ?? "",
        strokeColor: el.strokeColor ?? "#2b2b2b",
        backgroundColor: "transparent",
      };
    }

    // rectangle, diamond, ellipse - preserve source tracing
    const base = {
      type: el.type,
      id,
      x: (el.x ?? 0) + offsetX,
      y: (el.y ?? 0) + offsetY,
      width: el.width ?? SIZES[el.type as keyof typeof SIZES]?.width ?? 160,
      height: el.height ?? SIZES[el.type as keyof typeof SIZES]?.height ?? 60,
      text: el.text ?? el.label ?? "",
      strokeColor: el.strokeColor ?? "#2b2b2b",
      backgroundColor: el.backgroundColor ?? TYPE_COLORS.default,
      // Preserve source tracing for learning
      sourceLocation: el.sourceLocation,
      flowDescription: el.flowDescription,
    };

    return validateElement(base);
  });
}

/**
 * Generate a simple architecture diagram based on techStack
 */
function generateTechStackDiagram(
  projectName: string,
  techStack: string[],
  _projectType: string
): DiagramSpec {
  const layers: DiagramSpec["elements"] = [];
  const techLower = techStack.join(" ").toLowerCase();

  // Determine layers based on tech stack
  const hasFrontend = /react|vue|angular|next|nuxt|svelte/.test(techLower);
  const hasBackend = /node|express|fastify|nest|python|flask|fastapi|go|rust|java|spring/.test(techLower);
  const hasDatabase = /postgres|mysql|mongodb|redis|sqlite|prisma|sequelize/.test(techLower);
  const _hasState = /zustand|redux|jotai|recoil|context/.test(techLower); // Reserved for future use

  const yPositions = [80, 260, 440].filter((_, i) => {
    if (i === 0) return hasFrontend || techStack.length > 0;
    if (i === 1) return hasBackend || techStack.length > 0;
    if (i === 2) return hasDatabase;
    return false;
  });

  let yIdx = 0;
  if (yPositions.length === 0 || (!hasFrontend && !hasBackend)) {
    // Just show tech stack
    layers.push({
      type: "rectangle",
      label: "tech",
      x: 520,
      y: 200,
      width: 160,
      height: 60,
      backgroundColor: "#4dabf7",
    });
    techStack.slice(0, 4).forEach((tech, i) => {
      layers.push({
        type: "rectangle",
        label: tech,
        x: 220 + i * 200,
        y: 350,
        width: 160,
        height: 60,
        backgroundColor: TYPE_COLORS.lib,
      });
    });
  } else {
    if (hasFrontend) {
      layers.push({
        type: "rectangle",
        label: "前端层",
        x: 520,
        y: yPositions[yIdx++],
        width: 160,
        height: 60,
        backgroundColor: "#4dabf7",
      });
    }
    if (hasBackend) {
      layers.push({
        type: "rectangle",
        label: "后端/API",
        x: 520,
        y: yPositions[yIdx++],
        width: 160,
        height: 60,
        backgroundColor: "#b197fc",
      });
    }
    if (hasDatabase) {
      layers.push({
        type: "rectangle",
        label: "数据层",
        x: 520,
        y: yPositions[yIdx],
        width: 160,
        height: 60,
        backgroundColor: "#63e6be",
      });
    }
  }

  return {
    type: "architecture",
    title: "架构图",
    elements: layers,
  };
}

/**
 * Run synthesis agent to create final diagrams
 */
export async function runSynthesizerAgent(
  profile: ProjectProfile,
  analysisResults: ModuleAnalysisResult[],
  apiKey: string,
  signal?: AbortSignal
): Promise<{
  summary: string;
  keyInsights: string[];
  drawings: Array<{ id: string; type: string; elements: Array<Record<string, unknown>> }>;
}> {
  // Merge all findings
  const allFindings = analysisResults.flatMap((r) => r.findings);
  const uniqueFindings = [...new Set(allFindings)].slice(0, 5);

  // Aggregate module graphs
  const aggregatedModuleGraph = {
    nodes: [
      ...new Map(
        analysisResults
          .flatMap((r) => r.moduleGraph?.nodes ?? [])
          .map((n) => [n.id, n])
      ).values(),
    ],
    edges: analysisResults.flatMap((r) => r.moduleGraph?.edges ?? []),
  };

  // Build context
  const context = JSON.stringify({
    projectName: profile.fullName,
    projectType: profile.projectType,
    techStack: profile.techStack,
    allFindings: uniqueFindings,
    moduleGraph: aggregatedModuleGraph,
  });

  // Call AI
  const res = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.ARK_MODEL_ID ?? "doubao-1-5-pro-256k-250115",
      messages: [
        { role: "system", content: SYNTHESIS_PROMPT },
        {
          role: "user",
          content: `综合分析结果，生成最终图表：\n\n${context}\n\n只返回 JSON。`,
        },
      ],
      temperature: 0.2, // Lower temperature for more consistent output
    }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`Synthesis failed: ${res.status}`);
  }

  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";

  // Parse JSON
  let parsed: { summary?: string; keyInsights?: string[]; diagrams?: DiagramSpec[] };
  try {
    const raw = content.trim().replace(/```json\n?|```\n?/g, "");
    parsed = JSON.parse(raw);
  } catch {
    // Fallback: generate simple tech stack diagram
    parsed = {
      summary: `${profile.fullName} 是一个 ${profile.projectType} 项目，使用 ${profile.techStack.slice(0, 3).join(", ")}`,
      keyInsights: uniqueFindings.length > 0 ? uniqueFindings : ["分析完成"],
      diagrams: [generateTechStackDiagram(profile.fullName, profile.techStack, profile.projectType)],
    };
  }

  // Post-process diagrams: if moduleGraph has data but AI didn't use it well, regenerate
  const diagrams = parsed.diagrams ? [...parsed.diagrams] : [];

  // If moduleGraph has nodes but diagrams are empty or don't use them, generate module graph
  if (aggregatedModuleGraph.nodes.length >= 2 && diagrams.length === 0) {
    const elements = layoutModuleGraph(
      aggregatedModuleGraph.nodes,
      []
    );
    diagrams.push({
      type: "module-graph",
      title: "模块关系图",
      elements: elements as DiagramSpec["elements"],
    });
  }

  // If we have nodes and edges, add arrows
  if (aggregatedModuleGraph.nodes.length >= 2 && aggregatedModuleGraph.edges.length > 0) {
    const nodes = layoutModuleGraph(
      aggregatedModuleGraph.nodes,
      aggregatedModuleGraph.edges
    );
    const arrows = layoutModuleArrows(
      nodes as Array<{ id: string; x: number; y: number; width: number; height: number }>,
      aggregatedModuleGraph.edges
    );

    // Find or create module-graph diagram and add arrows
    const moduleGraphIdx = diagrams.findIndex((d) => d.type === "module-graph");
    if (moduleGraphIdx >= 0) {
      // Only replace elements for module-graph type (AI often puts them at wrong positions)
      // For other types (request-chain, etc.), preserve AI-calculated positions
      diagrams[moduleGraphIdx].elements = [...nodes, ...arrows] as DiagramSpec["elements"];
    } else {
      diagrams.unshift({
        type: "module-graph",
        title: "模块关系图",
        elements: [...nodes, ...arrows] as DiagramSpec["elements"],
      });
    }
  }

  // Convert diagrams to Excalidraw format
  const rawDrawings = diagrams.map((spec, i) => ({
    id: `diagram-${i}`,
    type: spec.type,
    elements: convertToExcalidrawElements(spec, (i % 2) * 800, Math.floor(i / 2) * 500),
  }));

  // Auto-fix layout: validate → detect collisions → fix → recalc arrows
  const { validateAndFixAll } = await import("@/lib/ai/layout-validator");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fixedDrawings = await validateAndFixAll(rawDrawings as any);
  const drawings = rawDrawings.map((d, i) => ({
    ...d,
    elements: fixedDrawings[i].elements as unknown as Record<string, unknown>[],
  }));

  return {
    summary: parsed.summary ?? `分析了 ${profile.fullName}`,
    keyInsights: parsed.keyInsights ?? uniqueFindings,
    drawings,
  };
}
