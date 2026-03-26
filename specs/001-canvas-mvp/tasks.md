# Tasks: AI Canvas MVP

**Input**: Design documents from `/specs/001-canvas-mvp/`
**Prerequisites**: plan.md (required), spec.md (required)

## Phase 1: Setup

- [ ] T001 Initialize Next.js project with TypeScript, Tailwind CSS, App Router
- [ ] T002 [P] Install dependencies: @excalidraw/excalidraw, echarts, ai, zustand, zod, papaparse
- [ ] T003 [P] Configure TypeScript strict mode, ESLint, Prettier
- [ ] T004 Create shared TypeScript types in `src/types/index.ts`

---

## Phase 2: Foundational (Blocking)

- [ ] T005 Create Zustand canvas store (`src/stores/canvas-store.ts`) — charts array, annotations array, CRUD actions
- [ ] T006 Create Zustand chat store (`src/stores/chat-store.ts`) — messages array, addMessage, conversation context builder
- [ ] T007 Create AI output Zod schema (`src/lib/ai/schema.ts`) — structured output definition for charts + annotations
- [ ] T008 Create system prompts (`src/lib/ai/prompts.ts`) — chart generation prompt, annotation generation prompt
- [ ] T009 Create AI chat API route (`src/app/api/chat/route.ts`) — Vercel AI SDK, structured output with Zod schema
- [ ] T010 Create root layout (`src/app/layout.tsx`) with global styles and font setup

**Checkpoint**: API route callable, stores functional, types defined

---

## Phase 3: User Story 1 - 对话生成图表 (P1) 🎯 MVP

**Goal**: 用户输入自然语言 → AI 生成 ECharts 图表 → 渲染到画布

### Implementation

- [ ] T011 Create ChatMessage component (`src/components/ChatMessage.tsx`) — render user/assistant messages with markdown
- [ ] T012 Create ChatPanel component (`src/components/ChatPanel.tsx`) — message list, input box, send handler, streaming display
- [ ] T013 Create ChartOverlay component (`src/components/ChartOverlay.tsx`) — single ECharts instance, absolute positioned, resizable
- [ ] T014 Create Canvas component (`src/components/Canvas.tsx`) — Excalidraw wrapper + ChartOverlay instances from store
- [ ] T015 Create main page (`src/app/page.tsx`) — left/right split layout, ChatPanel + Canvas
- [ ] T016 Wire chat flow: user input → API call → parse AI response → update canvas store → render chart

**Checkpoint**: 输入自然语言，画布上出现可交互的 ECharts 图表

---

## Phase 4: User Story 2 - AI 手绘批注 (P2)

**Goal**: AI 生成图表时同时生成 Excalidraw 手绘批注

### Implementation

- [ ] T017 Extend AI schema and prompts to include annotation generation (arrows, text, circles)
- [ ] T018 Create canvas-utils (`src/lib/canvas-utils.ts`) — position calculation for annotations relative to chart bounds
- [ ] T019 Update Canvas component to inject AI-generated Excalidraw elements into the Excalidraw scene
- [ ] T020 Update chat flow to merge both charts and annotations into canvas store on AI response

**Checkpoint**: 生成图表时自动出现手绘箭头和文字批注

---

## Phase 5: User Story 3 - 对话迭代修改 (P3)

**Goal**: 用户通过后续对话修改已有图表，AI 增量更新

### Implementation

- [ ] T021 Update chat store to build conversation context including current canvas state summary
- [ ] T022 Update AI prompts to support modification instructions (change chart type, update style, modify data)
- [ ] T023 Implement canvas store merge logic — AI returns partial update, store patches existing charts/annotations
- [ ] T024 Handle chart replacement (e.g., bar → pie) while preserving position and data

**Checkpoint**: 对已有图表发出修改指令，图表在原位更新

---

## Phase 6: User Story 4 - CSV 数据上传 (P4)

**Goal**: 用户上传 CSV，AI 自动分析并生成可视化

### Implementation

- [ ] T025 Create CsvUpload component (`src/components/CsvUpload.tsx`) — drag-and-drop zone in chat panel
- [ ] T026 Create csv-parser (`src/lib/csv-parser.ts`) — Papa Parse wrapper, extract schema + basic stats
- [ ] T027 Update chat flow: CSV upload → parse locally → send schema+stats to AI → generate chart + annotations
- [ ] T028 Support user follow-up instructions to customize CSV visualization ("用第2列做X轴")

**Checkpoint**: 拖入 CSV 文件，AI 自动生成图表和批注

---

## Phase 7: Polish

- [ ] T029 Add loading states and error handling for AI responses
- [ ] T030 Responsive layout adjustments (panel resize handle)
- [ ] T031 Add .gitignore, README.md, environment variable documentation

---

## Dependencies & Execution Order

- **Phase 1 (Setup)**: No dependencies
- **Phase 2 (Foundational)**: Depends on Phase 1
- **Phase 3 (US1)**: Depends on Phase 2 — MUST complete before other stories
- **Phase 4 (US2)**: Depends on Phase 3 (needs working chart generation)
- **Phase 5 (US3)**: Depends on Phase 3 (needs working chart to modify)
- **Phase 6 (US4)**: Depends on Phase 3 (needs working chart generation pipeline)
- Phase 4, 5, 6 can run in parallel after Phase 3

### Within Each Phase

- Stores/schemas before components
- Components before page wiring
- Core logic before polish
