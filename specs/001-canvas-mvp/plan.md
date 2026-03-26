# Implementation Plan: AI Canvas MVP

**Branch**: `001-canvas-mvp` | **Date**: 2026-03-26 | **Spec**: specs/001-canvas-mvp/spec.md

## Summary

构建 ICanDraw MVP：一个左右分栏的 Web 应用，左侧对话面板接收自然语言输入，通过 LLM 生成结构化 JSON，右侧画布同时渲染 ECharts 交互式图表和 Excalidraw 手绘批注。

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Framework**: Next.js 15 (App Router)
**Primary Dependencies**: @excalidraw/excalidraw, echarts, ai (Vercel AI SDK), zustand, tailwindcss
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
│   ├── layout.tsx           # Root layout with providers
│   ├── page.tsx             # Main page — split panel layout
│   ├── globals.css          # Tailwind + global styles
│   └── api/
│       └── chat/
│           └── route.ts     # AI chat endpoint (Vercel AI SDK)
├── components/
│   ├── ChatPanel.tsx        # Left panel: chat input + message list
│   ├── Canvas.tsx           # Right panel: Excalidraw + ECharts overlay
│   ├── ChatMessage.tsx      # Single chat message bubble
│   ├── ChartOverlay.tsx     # ECharts instance rendered as overlay on canvas
│   └── CsvUpload.tsx        # CSV drag-and-drop upload zone
├── stores/
│   ├── canvas-store.ts      # Zustand: canvas state (charts + annotations)
│   └── chat-store.ts        # Zustand: chat messages + conversation history
├── lib/
│   ├── ai/
│   │   ├── prompts.ts       # System prompts for chart/annotation generation
│   │   └── schema.ts        # Zod schemas for AI structured output
│   ├── csv-parser.ts        # Browser-side CSV parsing (Papa Parse)
│   └── canvas-utils.ts      # Helpers: position calculation, ID generation
└── types/
    └── index.ts             # Shared TypeScript types
```

**Structure Decision**: Single Next.js app with App Router. No separate backend — the API route handles LLM calls. Excalidraw runs as the base canvas layer, ECharts instances are rendered as absolutely-positioned overlays synced to canvas coordinates.

## Key Technical Decisions

### 1. ECharts + Excalidraw Integration Strategy

ECharts 实例渲染在 Excalidraw 画布上方的独立 `<div>` 中，通过绝对定位对齐。Excalidraw 画布提供底层手绘元素，ECharts div 浮在上方。两者通过 Zustand store 中的 canvas state 同步位置和大小。

理由：ForeignObject 在 Safari 兼容性差，overlay 方案更稳定。

### 2. AI 输出格式

LLM 通过 Vercel AI SDK 的 `generateObject` 返回结构化 JSON：

```typescript
{
  charts: [{ id, x, y, width, height, option: EChartsOption }],
  annotations: [{ id, type, bindTo, elements: ExcalidrawElement[] }],
  summary: string
}
```

### 3. 状态管理

Zustand store 维护完整的 canvas state。每次 AI 响应返回 diff/patch，前端 merge 到现有 state。对话历史包含每轮的 canvas state snapshot 用于上下文。

### 4. CSV 解析

使用 Papa Parse 在浏览器端解析 CSV。解析后提取 schema（列名、类型、行数）和基础统计（min/max/mean），仅将 schema + 统计发送给 LLM。

## Complexity Tracking

No constitution violations. All decisions follow simplicity principle.
