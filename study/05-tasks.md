# 第 5 章：拆解开发任务

> 核心问题：怎么把设计方案变成可执行的任务清单？

---

## 5.1 为什么要拆任务？

plan.md 告诉你"怎么做"，但它是一份架构文档，不是施工指令。你不能把 plan.md 丢给 AI 说"照着做"——它不知道先做什么后做什么，不知道哪些文件有依赖关系。

tasks.md 就是把设计方案翻译成**有序的、可执行的、有明确目标文件的任务清单**。

Spec-Kit 用 `/speckit.tasks` 命令生成任务清单。它读取 plan.md 和 spec.md，输出 tasks.md。

## 5.2 任务的格式

每个任务包含：

```markdown
- [x] T012 Create ChatPanel component (`src/components/ChatPanel.tsx`) — message list, input box, send handler
```

- `[x]` / `[ ]`：完成/未完成
- `T012`：全局唯一编号
- 目标文件路径：`src/components/ChatPanel.tsx`
- 简要描述：做什么

有些任务标注 `[P]`，表示可以和同阶段的其他任务并行执行（改的是不同文件，没有依赖）。

## 5.3 ICanDraw 的任务拆解

31 个任务分 7 个阶段，后来又补录了 8 个迭代任务：

### Phase 1: Setup（T001-T003）

```
[x] T001 初始化 Next.js 项目
[x] T002 [P] 安装依赖
[x] T003 [P] 配置 TypeScript strict、ESLint
```

这个阶段没有业务逻辑，纯粹是脚手架。T002 和 T003 标了 `[P]`，可以并行。

### Phase 2: Foundational（T004-T010）

```
[x] T004 共享类型定义 (types/index.ts)
[x] T005 画布 store (canvas-store.ts)
[x] T006 对话 store (chat-store.ts)
[x] T007 AI 输出 Zod schema (schema.ts)        ← 后来实际未使用
[x] T008 系统提示词 (prompts.ts)
[x] T009 AI 对话 API 路由 (route.ts)
[x] T010 根布局 (layout.tsx)
```

**关键设计**：类型定义（T004）排在最前面，因为 store 和组件都依赖它。Store（T005-T006）排在组件之前，因为组件要读写 store。

**Checkpoint**：API 路由可调用，Store 可用，类型已定义。

### Phase 3: User Story 1 — 对话生成图表（T011-T016）

```
[x] T011 ChatMessage 组件
[x] T012 ChatPanel 组件
[x] T013 EChartEmbeddable 组件      ← 原计划是 ChartOverlay，后来改了
[x] T014 Canvas 组件
[x] T015 主页面 (page.tsx)
[x] T016 串联完整流程
```

这是 MVP 的核心。做完这 6 个任务，产品就能用了——输入文字，画布出现图表。

**Checkpoint**：输入自然语言，画布上出现可交互的 ECharts 图表。

### Phase 4/5/6: 三个 User Story 可并行

```
Phase 4 (手绘批注): T017-T020
Phase 5 (对话修改): T021-T024
Phase 6 (CSV 上传): T025-T028
```

**关键设计**：这三个阶段都只依赖 Phase 3，互相不依赖。如果有三个人，可以同时做。

```
Phase 3 (核心链路) 完成后：
  ├→ Phase 4 (手绘批注)  → 改 prompts.ts + Canvas.tsx
  ├→ Phase 5 (对话修改)  → 改 chat-store.ts + ChatPanel.tsx
  └→ Phase 6 (CSV 上传)  → 改 CsvUpload.tsx
```

这不是巧合——plan.md 在设计目录结构时就考虑了模块边界。

### Phase 7: Polish（T029-T031）

```
[x] T029 错误处理和加载状态
[ ] T030 响应式布局
[x] T031 文档和环境变量
```

### Phase 8: 补录的迭代任务（T032-T039）

这些任务是在 MVP 开发过程中完成的，但原始任务清单没有包含。后来做文档同步时补录：

```
[x] T032 布局变更：画布移到左侧，对话面板移到右侧
[x] T033 EChartEmbeddable 组件（替代 ChartOverlay）
[x] T034 Excalidraw 原生图形支持（流程图、思维导图）
[x] T035 中英文国际化 (i18n-store.ts)
[x] T036 去掉 Vercel AI SDK，改为直接 fetch
[x] T037 数据规范化层 (normalizeChart/normalizeAnnotation)
[x] T038 修复箭头渲染（从 points 自动计算 width/height）
[x] T039 自动生成形状元素的文字标签
```

## 5.4 依赖关系是任务拆解的灵魂

任务拆解不只是"列一个 TODO list"。核心是**依赖关系**：

```
Phase 1 (Setup)
  → Phase 2 (Foundational)
    → Phase 3 (US1 核心链路)
      ├→ Phase 4 (US2 批注)  ─┐
      ├→ Phase 5 (US3 修改)  ─┼→ Phase 7 (Polish)
      └→ Phase 6 (US4 CSV)  ─┘
```

**阶段内部也有依赖**：
- Store/Schema 在组件之前（组件依赖 store）
- 组件在页面之前（页面组合组件）
- 核心逻辑在 polish 之前

如果依赖关系搞错了——比如先写 ChatPanel 再写 canvas-store——AI 写 ChatPanel 时不知道 store 的接口长什么样，要么猜错，要么写出不兼容的代码。

## 5.5 Checkpoint：阶段性验收

每个阶段结束时有一个 Checkpoint，用自然语言描述"做完这个阶段应该能看到什么"：

| 阶段 | Checkpoint |
|------|-----------|
| Phase 2 | API 路由可调用，Store 可用 |
| Phase 3 | 输入文字，画布出现图表 |
| Phase 4 | 图表旁出现手绘批注 |
| Phase 5 | 修改指令后图表原位更新 |
| Phase 6 | 拖入 CSV 自动生成图表 |

Checkpoint 的价值：**你不需要等所有任务做完才能验证**。每个阶段结束就能跑一次，确认方向没跑偏。

## 5.6 教学要点

1. **任务要有明确的目标文件**。"实现图表功能"太模糊，"创建 `src/components/Canvas.tsx`"才能执行。
2. **依赖关系决定执行顺序**。类型 → Store → 组件 → 页面 → 串联，这个顺序不能乱。
3. **并行机会要显式标注**。标了 `[P]` 的任务可以同时做，这对团队协作至关重要。
4. **Checkpoint 是阶段性验收点**。不要等全部做完才测试，每个阶段结束就验证一次。
5. **任务清单是活文档**。开发过程中会有计划外的任务（如 T032-T039），要补录进来保持完整性。

## 5.7 动手练习

把你的 P1 User Story 拆成 5~8 个任务：

1. 每个任务标注目标文件路径
2. 画出依赖关系（哪个任务依赖哪个）
3. 标注哪些任务可以并行
4. 写一个 Checkpoint 描述

---

> 下一章：[第 6 章 — AI 代码实现](./06-implement.md)
