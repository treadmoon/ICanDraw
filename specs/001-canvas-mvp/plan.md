# Implementation Plan: AI Canvas MVP

**Branch**: `001-canvas-mvp` | **Date**: 2026-03-26 | **Spec**: specs/001-canvas-mvp/spec.md

## Summary

构建 ICanDraw MVP：一个左右分栏的 Web 应用，左侧对话面板接收自然语言输入，通过 LLM 生成结构化 JSON，右侧画布同时渲染 ECharts 交互式图表和 Excalidraw 手绘批注。

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Framework**: Next.js 16 (App Router)
**Primary Dependencies**: @excalidraw/excalidraw, echarts, zustand, tailwindcss, papaparse
**LLM Backend**: 火山方舟 API（豆包模型），直接 fetch 调用（未使用 Vercel AI SDK，原因见 Key Decision 2）
**Storage**: Browser memory (Zustand store), no backend database for MVP
**Target Platform**: Modern browsers (Chrome/Edge/Firefox latest)
**Project Type**: Web application (single Next.js app)
**Constraints**: AI response < 3s to first render, CSV parse < 2s for files < 10MB

## Constitution Check

- ✅ AI-Native: All chart generation driven by LLM
- ✅ Structured Output: LLM returns JSON (ECharts option + Excalidraw elements)
- ✅ Local-First: CSV parsed in browser, no raw data sent to LLM
- ✅ Dual-Engine: Excalidraw + ECharts as independent composable layers
- ✅ Incremental: Canvas state is JSON, AI patches it
- ✅ Simplicity: Minimal dependencies, no premature abstractions

## Project Structure

### Documentation (this feature)

```text
specs/001-canvas-mvp/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Technology research
├── data-model.md        # Data model definitions
└── tasks.md             # Task breakdown
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── layout.tsx           # Root layout with font loading
│   ├── page.tsx             # Main page — left canvas + right chat panel
│   ├── globals.css          # Tailwind + Excalidraw overrides
│   ├── loading.tsx          # Page-level loading spinner
│   ├── error.tsx            # Route-level error boundary
│   ├── global-error.tsx     # Global error boundary (inline styles)
│   └── api/
│       └── chat/
│           └── route.ts     # AI chat endpoint (direct fetch to 火山方舟 API)
├── components/
│   ├── ChatPanel.tsx        # Right panel: chat input + message list + data normalization
│   ├── Canvas.tsx           # Left panel: Excalidraw + ECharts embeddable rendering
│   ├── ChatMessage.tsx      # Single chat message bubble
│   ├── EChartEmbeddable.tsx # ECharts instance rendered inside Excalidraw embeddable element
│   └── CsvUpload.tsx        # CSV drag-and-drop upload zone (includes Papa Parse parsing)
├── stores/
│   ├── canvas-store.ts      # Zustand: canvas state (charts + drawings + annotations)
│   ├── chat-store.ts        # Zustand: chat messages + loading state
│   └── i18n-store.ts        # Zustand: Chinese/English internationalization
├── lib/
│   ├── ai/
│   │   └── prompts.ts       # System prompt defining AI output format (charts + drawings + annotations)
│   └── canvas-utils.ts      # Helpers: generateId (crypto.randomUUID)
└── types/
    └── index.ts             # Shared TypeScript types (ChartData, Drawing, Annotation, AIResponse, etc.)
```

**Structure Decision**: Single Next.js app with App Router. No separate backend — the API route handles LLM calls via direct fetch to 火山方舟 API. ECharts charts are rendered as Excalidraw `embeddable` elements using the `echart://` protocol, enabling native drag/resize/rotate support. Excalidraw drawings and annotations are injected as native Excalidraw elements.

## Key Technical Decisions

### 1. ECharts + Excalidraw Integration Strategy

**[Updated]** ~~ECharts 实例渲染在 Excalidraw 画布上方的独立 `<div>` 中，通过绝对定位对齐。~~ → ECharts 图表作为 Excalidraw 的 `embeddable` 原生元素渲染。ChatPanel 插入 `type: "embeddable"` 元素并设置 `link: "echart://<chartId>"`，Canvas.tsx 通过 `validateEmbeddable` 接受 `echart://` 协议，`renderEmbeddable` 回调渲染 `<EChartEmbeddable>` 组件。

变更理由：overlay 方案下图表不能拖拽/缩放/旋转，用户体验差。embeddable 方案让图表成为画布原生元素，交互由 Excalidraw 统一处理。

### 2. AI 输出格式

**[Updated]** ~~LLM 通过 Vercel AI SDK 的 `generateObject` 返回结构化 JSON~~ → API route 直接 fetch 火山方舟 API，返回的 content 经 JSON.parse 解析，再由 ChatPanel.tsx 的 `normalizeResponse` / `normalizeChart` / `normalizeAnnotation` 做数据规范化。

变更理由：豆包推理模型返回 `reasoning_content` 字段，Vercel AI SDK 不兼容，报 Invalid JSON response。改为直接 fetch 更可控。

LLM 返回格式：

```typescript
{
  charts: [{ id, x, y, width, height, option: EChartsOption }],
  drawings: [{ id, elements: ExcalidrawElementData[] }],
  annotations: [{ id, bindTo?, elements: ExcalidrawElementData[] }],
  summary: string
}
```

注意：相比原始设计，新增了 `drawings` 数组，用于支持流程图、思维导图等 Excalidraw 原生图形。

### 3. 状态管理

Zustand store 维护完整的 canvas state。每次 AI 响应返回 diff/patch，前端 merge 到现有 state。对话历史包含每轮的 canvas state snapshot 用于上下文。

### 4. CSV 解析

使用 Papa Parse 在浏览器端解析 CSV。解析后提取 schema（列名、类型、行数）和基础统计（min/max/mean），仅将 schema + 统计发送给 LLM。

## Complexity Tracking

No constitution violations. All decisions follow simplicity principle.
