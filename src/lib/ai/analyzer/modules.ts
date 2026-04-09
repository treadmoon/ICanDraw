/**
 * Module Analysis Agent - Phase 2
 * Analyzes specific modules/files in depth, one step at a time
 * With source code tracing for learning purposes
 */

import { fetchFileContent } from "@/lib/github/api";
import { parseImports, parseExports } from "@/lib/github/parser";
import { selectKeyFiles, summarizeFileContent } from "./context-manager";
import { sanitizeForPrompt, sanitizePath, sanitizeStringArray } from "@/lib/ai/sanitize";
import type { SourceLocation } from "@/types";

// ============================================================
//溯源数据类型 - 用于标注流程图中每个元素的来源
// ============================================================

/** 带溯源信息的流程边 */
export interface FlowEdge {
  from: string;       // 源节点 ID
  to: string;         // 目标节点 ID
  type: "imports" | "calls" | "provides" | "event" | "api";
  // 溯源字段
  sourceLocation?: SourceLocation;  // 触发位置
  apiRoute?: string;               // API 路由（如 "POST /api/analyze"）
  handler?: string;                // 处理函数（如 "route.ts:handleAnalyze"）
  description?: string;            // 中文描述这个调用的作用
}

/** 带详细信息的流程节点 */
export interface FlowNode {
  id: string;
  name: string;        // 显示名称（如 "提交按钮"）
  path: string;       // 文件路径
  type: "component" | "hook" | "store" | "api" | "lib" | "page" | "config" | "route";
  // 溯源字段
  sourceLocation?: SourceLocation;  // 源码位置
  functionName?: string;  // 导出的主函数名
  exports?: string[];     // 导出的所有接口
  description?: string;   // 功能描述
  layer?: "ui" | "api" | "handler";  // 层级：界面 / API / 处理器
}

// Re-export SourceLocation for backwards compatibility
export type { SourceLocation };

// ============================================================
// 分析结果类型
// ============================================================

export interface ModuleAnalysisResult {
  step: number;
  stepId: string;
  description: string;
  findings: string[];
  moduleGraph: {
    nodes: FlowNode[];
    edges: FlowEdge[];
  };
  diagramSpecs: DiagramSpec[];
  status: "done" | "failed";
  error?: string;
}

export interface DiagramSpec {
  type: "architecture" | "module-graph" | "data-flow" | "state-machine" | "flowchart" | "request-chain";
  title: string;
  summary?: string;  // 图的用途说明
  elements: DiagramElement[];
}

/** 图表元素 - 支持溯源标注 */
export interface DiagramElement {
  type: "rectangle" | "diamond" | "ellipse" | "text" | "arrow";
  label: string;      // 显示文本
  x: number;
  y: number;
  width?: number;
  height?: number;
  color?: string;
  connections?: string[];
  points?: number[][];
  strokeColor?: string;
  backgroundColor?: string;
  text?: string;
  // 溯源字段
  sourceLocation?: SourceLocation;  // 元素对应的源码位置
  apiRoute?: string;              // API 路由（仅箭头使用）
  flowDescription?: string;       // 流程步骤的中文描述
}

// ============================================================
// 静态代码分析工具函数
// ============================================================

/**
 * 解析文件中的所有函数定义和导出
 */
export function parseFunctionsAndExports(content: string): {
  functions: string[];
  exports: string[];
  eventHandlers: Array<{ name: string; line: number; event: string }>;
} {
  const functions: string[] = [];
  const eventHandlers: Array<{ name: string; line: number; event: string }> = [];

  // 匹配函数定义
  const funcPatterns = [
    /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/gm,
    /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|\(\)|_\w+)\s*=>/gm,
    /^(?:export\s+)?(?:async\s+)?(?:\w+)\s*\(.*?\)\s*{/gm,
  ];

  for (const pattern of funcPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const name = match[1] || match[0].slice(0, 40);
      if (!functions.includes(name)) {
        functions.push(name);
      }
    }
  }

  // 匹配 React 事件处理函数（onClick={handleXxx}, onChange={...} 等）
  const eventPatterns = [
    /on(\w+)\s*=\s*\{\s*(?:(\w+)|(?:\(\s*\)\s*=>))/g,
    /addEventListener\s*\(\s*['"](\w+)['"]\s*,\s*(\w+)/g,
  ];

  for (const pattern of eventPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const event = match[1].toLowerCase();
      const handler = match[2] || match[0].slice(0, 30);
      if (!eventHandlers.find((h) => h.name === handler)) {
        eventHandlers.push({ name: handler, line: content.slice(0, match.index).split("\n").length, event });
      }
    }
  }

  return {
    functions,
    exports: parseExports(content),
    eventHandlers,
  };
}

/**
 * 解析 API 路由定义
 */
export function parseApiRoutes(content: string, filePath: string): Array<{
  method: string;
  path: string;
  handler: string;
  line: number;
}> {
  const routes: Array<{ method: string; path: string; handler: string; line: number }> = [];

  // Next.js App Router: export async function GET/POST/PUT/DELETE
  const nextAppPatterns = [
    /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\([^)]*\)/g,
  ];

  // Next.js Pages Router: router.get/post/...
  const nextPagesPatterns = [
    /router\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]\s*,\s*(\w+)/gi,
  ];

  // Express/Fastify: app.post('/path', handler)
  const expressPatterns = [
    /app\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]\s*,\s*(\w+)/gi,
  ];

  // Helper to extract App Router path from filePath
  // e.g., "src/app/api/analyze/route.ts" -> "/api/analyze"
  // e.g., "app/users/[id]/route.ts" -> "/users/[id]"
  function extractAppRouterPath(fp: string): string {
    const parts = fp.split("/");
    const routeIdx = parts.indexOf("route");
    if (routeIdx > 0) {
      const pathParts = parts.slice(1, routeIdx); // skip "app" prefix
      return "/" + pathParts.join("/");
    }
    // fallback
    return "/" + parts.pop()!.replace(/\.[^.]+$/, "");
  }

  for (const pattern of nextAppPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const method = match[1];
      routes.push({
        method,
        path: extractAppRouterPath(filePath),
        handler: `${filePath}:${method.toLowerCase()}`,
        line: content.slice(0, match.index).split("\n").length,
      });
    }
  }

  for (const pattern of [...nextPagesPatterns, ...expressPatterns]) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      routes.push({
        method: match[1].toUpperCase(),
        path: match[2],
        handler: `${filePath}:${match[3]}`,
        line: content.slice(0, match.index).split("\n").length,
      });
    }
  }

  return routes;
}

const MODULE_ANALYSIS_PROMPT = `You are a senior developer creating LEARNABLE architecture diagrams. Your goal is to help developers trace exactly how data flows through the codebase.

## CORE TASK: Source Code Tracing
For each flow you identify, you MUST trace:
1. **WHERE it starts**: Which file, which function, which line has the user action/event
2. **WHERE it goes**: Which API endpoint is called (e.g., POST /api/analyze)
3. **WHERE it ends**: Which backend file and function handles the request

## Analysis Approach
For each module, identify:
- **Entry points**: User actions, event handlers (onClick, onSubmit, etc.)
- **API calls**: fetch/axios calls with route paths
- **Route handlers**: Backend handlers for API routes
- **Data transformations**: How data changes through the flow

## CRITICAL: Include Source Locations
For EVERY node and edge in the graph, you MUST include:
- **Node**: path (file path), functionName (exported function name)
- **Edge**: sourceLocation (file+function+line where call happens), apiRoute (HTTP method + path)

## Output Format (LEARNING-FOCUSED)
{
  "findings": [
    "用户点击【提交】按钮（在 ChatPanel.tsx 第 45 行 onClick={handleSubmit}）",
    "请求发送到 POST /api/analyze",
    "后端 route.ts 的 handleAnalyze 函数处理（在 route.ts 第 103 行）"
  ],
  "moduleGraph": {
    "nodes": [
      {
        "id": "btn-submit",
        "name": "提交按钮",
        "path": "src/components/ChatPanel.tsx",
        "type": "component",
        "functionName": "handleSubmit",
        "description": "处理用户点击提交的事件"
      },
      {
        "id": "api-analyze",
        "name": "分析接口",
        "path": "src/app/api/analyze/route.ts",
        "type": "route",
        "functionName": "POST",
        "description": "处理项目分析请求"
      }
    ],
    "edges": [
      {
        "from": "btn-submit",
        "to": "api-analyze",
        "type": "event",
        "sourceLocation": { "file": "src/components/ChatPanel.tsx", "function": "handleSubmit", "line": 45, "event": "click" },
        "apiRoute": "POST /api/analyze",
        "description": "用户点击提交按钮，触发分析请求"
      }
    ]
  },
  "diagramSpecs": [
    {
      "type": "request-chain",
      "title": "分析请求链路图",
      "summary": "展示从用户点击到后端处理的完整调用链",
      "elements": [
        {
          "type": "rectangle",
          "label": "提交按钮\nChatPanel.tsx:45",
          "x": 100, "y": 100, "width": 200, "height": 80,
          "sourceLocation": { "file": "src/components/ChatPanel.tsx", "function": "handleSubmit", "line": 45, "event": "click" },
          "backgroundColor": "#4dabf7"
        },
        {
          "type": "arrow",
          "label": "POST /api/analyze",
          "x": 300, "y": 120, "points": [[0,0], [120,0]],
          "apiRoute": "POST /api/analyze",
          "flowDescription": "点击后发送 POST 请求"
        },
        {
          "type": "rectangle",
          "label": "POST handler\nroute.ts:103",
          "x": 420, "y": 100, "width": 200, "height": 80,
          "sourceLocation": { "file": "src/app/api/analyze/route.ts", "function": "handleAnalyze", "line": 103 },
          "backgroundColor": "#b197fc"
        }
      ]
    }
  ]
}

## Element Sizes
- rectangle: width=200, height=80 (for request chain nodes with source info)
- diamond: width=140, height=90 (decision points)
- ellipse: width=160, height=60 (start/end states)
- text: height=30

## Arrow Labels
- Show apiRoute on arrows (e.g., "POST /api/analyze")
- Show flowDescription below arrows

## Color Palette (Layer-based)
- #4dabf7 - UI layer (components, buttons)
- #ffd43b - API layer (fetch calls, route references)
- #b197fc - Handler layer (backend functions)
- #63e6be - Data layer (stores, databases)
- #e7f5ff - Start/Entry points

## Rules
- findings: 3-5 insights that explicitly name file paths and function names
- moduleGraph: identify 5-10 nodes, include sourceLocation for each
- edges: MUST include sourceLocation and apiRoute
- diagramSpecs: create 1 "request-chain" type diagram with source tracing
- Use Chinese for labels, but include file paths and function names in English`;



const DATA_FLOW_ANALYSIS_PROMPT = `You are a data flow analyst creating LEARNABLE diagrams. Trace data movement with SOURCE LOCATIONS.

## CRITICAL: Include Source Locations
For EVERY element, include:
- path: exact file path
- functionName: the function where data enters/transforms
- sourceLocation: { file, function, line } for each step

## Output Format
{
  "findings": [
    "数据从 src/components/Input.tsx 的 handleChange 函数（第 23 行）获取用户输入",
    "传递到 src/hooks/useAnalysis.ts 的 analyzeData 函数处理"
  ],
  "moduleGraph": {
    "nodes": [
      {
        "id": "user-input",
        "name": "用户输入",
        "path": "src/components/Input.tsx",
        "type": "component",
        "functionName": "handleChange",
        "description": "获取用户输入"
      }
    ],
    "edges": [
      {
        "from": "user-input",
        "to": "data-proc",
        "type": "calls",
        "sourceLocation": { "file": "src/components/Input.tsx", "function": "handleChange", "line": 23 },
        "description": "将输入数据发送到处理函数"
      }
    ]
  },
  "diagramSpecs": [{
    "type": "data-flow",
    "title": "数据流图",
    "summary": "展示数据从输入到存储的完整路径",
    "elements": [
      { "type": "rectangle", "label": "用户输入\nInput.tsx:23", "x": 100, "y": 100, "width": 200, "height": 80, "sourceLocation": { "file": "src/components/Input.tsx", "function": "handleChange", "line": 23 }, "backgroundColor": "#4dabf7" },
      { "type": "arrow", "label": "数据传递", "x": 300, "y": 130, "points": [[0,0], [100,0]], "flowDescription": "传递到处理函数" },
      { "type": "rectangle", "label": "数据处理\nuseAnalysis.ts", "x": 400, "y": 100, "width": 200, "height": 80, "sourceLocation": { "file": "src/hooks/useAnalysis.ts", "function": "analyzeData", "line": 45 }, "backgroundColor": "#b197fc" }
    ]
  }]
}

Use Chinese labels, include file paths in English.`;

const STATE_ANALYSIS_PROMPT = `You are a state machine analyst creating LEARNABLE diagrams. Trace state transitions with SOURCE LOCATIONS.

## CRITICAL: Include Source Locations
For state transitions, include:
- sourceLocation: { file, function, line, event } for each transition trigger

## Output Format
{
  "findings": [
    "状态存储在 src/stores/project-store.ts 的 projectStore 中",
    "状态转换由 src/components/ChatPanel.tsx 的 handleAnalyze 触发（第 67 行 click 事件）"
  ],
  "moduleGraph": {
    "nodes": [
      {
        "id": "state-idle",
        "name": "空闲状态",
        "path": "src/stores/project-store.ts",
        "type": "store",
        "functionName": "projectStore",
        "description": "项目分析状态管理"
      }
    ],
    "edges": [
      {
        "from": "state-idle",
        "to": "state-analyzing",
        "type": "event",
        "sourceLocation": { "file": "src/components/ChatPanel.tsx", "function": "handleAnalyze", "line": 67, "event": "click" },
        "description": "点击分析按钮触发状态转换"
      }
    ]
  },
  "diagramSpecs": [{
    "type": "state-machine",
    "title": "状态机图",
    "summary": "展示项目分析的状态转换过程",
    "elements": [
      { "type": "ellipse", "label": "空闲\nproject-store.ts", "x": 100, "y": 100, "width": 160, "height": 60, "sourceLocation": { "file": "src/stores/project-store.ts", "function": "projectStore", "line": 1 }, "backgroundColor": "#e7f5ff" },
      { "type": "diamond", "label": "点击分析?", "x": 320, "y": 85, "width": 140, "height": 90, "sourceLocation": { "file": "src/components/ChatPanel.tsx", "function": "handleAnalyze", "line": 67, "event": "click" }, "backgroundColor": "#ffd43b" },
      { "type": "ellipse", "label": "分析中", "x": 520, "y": 100, "width": 160, "height": 60, "backgroundColor": "#74c0fc" },
      { "type": "arrow", "x": 190, "y": 130, "points": [[0,0], [130,0]], "flowDescription": "click 事件触发" }
    ]
  }]
}

Use Chinese labels, include file paths in English.`;

/**
 * Analyze a specific step based on the plan
 */
export async function runModuleAnalysis(
  owner: string,
  repo: string,
  branch: string,
  step: {
    id: string;
    description: string;
    focusArea: string;
    type: "module" | "dataflow" | "state" | "architecture";
  },
  allFiles: Array<{ path: string; content: string }>,
  apiKey: string,
  stepNumber: number,
  signal?: AbortSignal
): Promise<ModuleAnalysisResult> {
  // Select relevant files for this step
  const relevantFiles = selectKeyFiles(allFiles, 10, 2000);

  // Build file summaries
  const fileSummaries = relevantFiles
    .map((f) => summarizeFileContent(sanitizePath(f.path), f.content, 50))
    .join("\n\n");

  // Build enhanced context with source tracing information
  const fileAnalysis = relevantFiles.map((f) => {
    const { functions, exports: fileExports, eventHandlers } = parseFunctionsAndExports(f.content);
    const apiRoutes = parseApiRoutes(f.content, f.path);
    return {
      path: sanitizePath(f.path),
      imports: sanitizeStringArray(parseImports(f.content)),
      exports: sanitizeStringArray(fileExports),
      functions: sanitizeStringArray(functions.slice(0, 10)),  // Top 10 functions
      eventHandlers: eventHandlers.slice(0, 5).map((h) => ({
        ...h,
        name: sanitizeForPrompt(h.name),
        event: sanitizeForPrompt(h.event),
      })),
      apiRoutes: apiRoutes.map((r) => ({
        ...r,
        method: sanitizeForPrompt(r.method),
        path: sanitizeForPrompt(r.path),
        handler: sanitizeForPrompt(r.handler),
      })),
    };
  });

  // Build context (sanitize all AI-generated data)
  const context = JSON.stringify({
    step: sanitizeForPrompt(step.description),
    focusArea: sanitizeForPrompt(step.focusArea),
    files: fileSummaries,
    fileAnalysis,  // Enhanced with function/event/API route info
  });

  // Select prompt based on step type
  const prompt =
    step.type === "dataflow"
      ? DATA_FLOW_ANALYSIS_PROMPT
      : step.type === "state"
      ? STATE_ANALYSIS_PROMPT
      : MODULE_ANALYSIS_PROMPT;

  try {
    const res = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.ARK_MODEL_ID ?? "doubao-1-5-pro-256k-250115",
        messages: [
          { role: "system", content: prompt },
          {
            role: "user",
            content: `分析这个模块：\n\n${context}\n\n只返回 JSON。`,
          },
        ],
        temperature: 0.3,
      }),
      signal,
    });

    if (!res.ok) {
      throw new Error(`Module analysis failed: ${res.status}`);
    }

    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";

    // Parse JSON
    let parsed: Partial<ModuleAnalysisResult>;
    try {
      const raw = content.trim().replace(/```json\n?|```\n?/g, "");
      parsed = JSON.parse(raw);
    } catch {
      parsed = {
        findings: ["分析完成"],
        moduleGraph: { nodes: [], edges: [] },
        diagramSpecs: [],
      };
    }

    return {
      step: stepNumber,
      stepId: step.id,
      description: step.description,
      findings: parsed.findings ?? [],
      moduleGraph: parsed.moduleGraph ?? { nodes: [], edges: [] },
      diagramSpecs: parsed.diagramSpecs ?? [],
      status: "done",
    };
  } catch (err) {
    return {
      step: stepNumber,
      stepId: step.id,
      description: step.description,
      findings: [],
      moduleGraph: { nodes: [], edges: [] },
      diagramSpecs: [],
      status: "failed",
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Fetch key files for analysis with parallel fetching
 */
export async function fetchAnalysisFiles(
  owner: string,
  repo: string,
  branch: string,
  filePaths: string[],
  maxRetries = 2
): Promise<Array<{ path: string; content: string }>> {
  const paths = filePaths.slice(0, 30); // Max 30 files
  const CONCURRENCY = 5; // Parallel fetch limit

  async function fetchWithRetry(path: string): Promise<{ path: string; content: string } | null> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const content = await fetchFileContent(owner, repo, path, branch);
        return { path, content };
      } catch {
        if (attempt === maxRetries - 1) {
          return null;
        }
      }
    }
    return null;
  }

  // Process in batches of CONCURRENCY
  const results: Array<{ path: string; content: string }> = [];
  for (let i = 0; i < paths.length; i += CONCURRENCY) {
    const batch = paths.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(fetchWithRetry));
    for (const result of batchResults) {
      if (result) {
        results.push(result);
      }
    }
  }

  return results;
}
