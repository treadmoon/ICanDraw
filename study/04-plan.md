# 第 4 章：制定实施计划

> 核心问题：怎么做技术选型和架构设计？

---

## 4.1 从"做什么"到"怎么做"

前三章解决了三个问题：产品是什么（产品定义）、底线是什么（宪法）、做成什么样（功能规格）。

这一章要回答：**技术上怎么实现？**

Spec-Kit 用 `/speckit.plan` 命令生成实施计划。它读取 spec.md 和 constitution.md，输出 plan.md——包含技术选型、目录结构、关键技术决策。

## 4.2 技术上下文：先把约束条件摆出来

plan.md 开头就列出了技术上下文，这些是所有后续决策的前提：

```
Language/Version: TypeScript 5.x (strict mode)
Framework: Next.js 16 (App Router)
Primary Dependencies: @excalidraw/excalidraw, echarts, zustand, tailwindcss, papaparse
LLM Backend: 火山方舟 API（豆包模型），直接 fetch 调用
Storage: Browser memory (Zustand store)
Target Platform: Modern browsers
Constraints: AI response < 3s, CSV parse < 2s for < 10MB
```

注意 Constraints 直接来自 spec.md 的成功标准。**spec 定义了"要多快"，plan 定义了"怎么做到这么快"。**

## 4.3 宪法合规检查

plan.md 里有一个关键环节：**Constitution Check**。逐条对照六条宪法原则，确认技术方案没有违反任何一条：

| 原则 | 检查结果 | 怎么做到的 |
|------|---------|-----------|
| AI-Native | ✅ | 所有图表生成由 LLM 驱动 |
| Structured Output | ✅ | LLM 返回 JSON（ECharts option + Excalidraw elements） |
| Local-First | ✅ | CSV 用 Papa Parse 在浏览器端解析 |
| Dual-Engine | ✅ | Excalidraw + ECharts 独立但组合 |
| Incremental | ✅ | 画布状态是 JSON，AI 做 patch |
| Simplicity | ✅ | 最小依赖，无过度抽象 |

如果某条原则打了 ❌，就必须要么修改技术方案，要么修改宪法（需要团队讨论）。

这个检查不是走形式——它真的能抓住问题。比如如果你选了一个需要把数据上传到云端的分析服务，Local-First 原则就会亮红灯。

## 4.4 目录结构设计

plan.md 定义了完整的目录结构，每个文件标注职责：

```
src/
├── app/
│   ├── layout.tsx           # 根布局
│   ├── page.tsx             # 主页面——左画布 + 右对话面板
│   └── api/chat/route.ts    # AI 对话 API 端点
├── components/
│   ├── ChatPanel.tsx        # 对话面板：输入、消息列表、数据规范化
│   ├── Canvas.tsx           # 画布：Excalidraw + ECharts embeddable
│   ├── EChartEmbeddable.tsx # ECharts 嵌入渲染器
│   ├── ChatMessage.tsx      # 消息气泡
│   └── CsvUpload.tsx        # CSV 拖拽上传
├── stores/
│   ├── canvas-store.ts      # 画布状态
│   ├── chat-store.ts        # 对话状态
│   └── i18n-store.ts        # 国际化
├── lib/
│   └── ai/prompts.ts        # AI 系统提示词
└── types/index.ts           # 共享类型
```

**目录结构不是随便定的，它直接影响后面的任务拆解和并行开发能力。** 比如 stores/ 和 components/ 分开，意味着状态逻辑和 UI 逻辑解耦，不同的人可以同时改 store 和组件而不冲突。

## 4.5 关键技术决策

plan.md 记录了每个重要的技术决策及其理由。这是整个文档最有价值的部分——不是"选了什么"，而是"为什么选它、为什么不选别的"。

### 决策 1：ECharts + Excalidraw 集成方案

这个决策经历了一次重大变更：

| 阶段 | 方案 | 问题 |
|------|------|------|
| 最初设计 | Overlay（ECharts 浮在 Excalidraw 上方的绝对定位 div） | 图表不能拖拽/缩放/旋转，因为它不是画布的一部分 |
| 最终方案 | Embeddable（ECharts 作为 Excalidraw 原生 embeddable 元素） | 图表成为画布原生元素，交互由 Excalidraw 统一处理 |

变更理由写在 plan.md 里：

> overlay 方案下图表不能拖拽/缩放/旋转，用户体验差。embeddable 方案让图表成为画布原生元素，交互由 Excalidraw 统一处理。

**教学重点**：最初的设计不一定是最终的设计。plan.md 保留了原始方案和变更理由，这样后来的人能理解"为什么不用更简单的 overlay"。

### 决策 2：AI 输出格式

同样经历了变更：

| 阶段 | 方案 | 问题 |
|------|------|------|
| 最初设计 | Vercel AI SDK `generateObject` + Zod schema | 豆包模型返回 `reasoning_content` 字段，AI SDK 不兼容 |
| 最终方案 | 直接 fetch 火山方舟 API + JSON.parse + 手动 normalize | 更可控，不依赖第三方 SDK 的解析逻辑 |

**教学重点**：第三方 SDK 不是万能的。当你使用非主流模型时，SDK 的兼容性可能成为障碍。直接 fetch 虽然代码多一点，但更可控。

### 决策 3：状态管理

选择 Zustand 而非 Redux 或 Context API：

- Zustand：轻量（< 1KB），无 Provider，直接 hook 调用，符合 Simplicity 原则
- Redux：太重了，MVP 不需要中间件、devtools 那套
- Context API：性能问题——画布状态频繁更新会导致不必要的重渲染

### 决策 4：CSV 解析

选择 Papa Parse 在浏览器端解析：

- 符合 Local-First 原则（数据不出浏览器）
- 宪法要求用 DuckDB-WASM，但 MVP 阶段 Papa Parse 够用，遵循 Simplicity 原则
- 后续 Phase 3 再升级到 DuckDB-WASM

## 4.6 plan.md 是活文档

ICanDraw 的 plan.md 在开发过程中经历了多次更新：

1. 初始版本：overlay 方案 + Vercel AI SDK
2. 第一次更新：overlay → embeddable（发现图表不能拖拽）
3. 第二次更新：AI SDK → 直接 fetch（发现豆包模型不兼容）
4. 第三次更新：补充 drawings 支持、i18n、布局变更等后续迭代

每次更新都保留了原始描述，加 `[Updated]` 前缀标注变更。这样后来的人能看到决策的演变过程，而不只是最终结果。

## 4.7 教学要点

1. **技术决策要记录理由，不只是结论**。"用了 Zustand"没有价值，"用 Zustand 因为 Redux 太重、Context 有性能问题"才有价值。
2. **宪法合规检查不是走形式**。它能在设计阶段就抓住违反原则的方案，避免写完代码才发现要推翻重来。
3. **目录结构决定了并行开发能力**。模块边界清晰，不同的人才能同时工作而不冲突。
4. **plan.md 要随代码一起更新**。过时的设计文档比没有文档更危险——它会误导后来的人。

## 4.8 动手练习

为你的项目做一个技术决策记录，包含：

1. 决策标题（如"状态管理方案选型"）
2. 备选方案（至少 2 个）
3. 每个方案的优缺点
4. 最终选择及理由
5. 对照你的宪法原则做合规检查

---

> 下一章：[第 5 章 — 拆解开发任务](./05-tasks.md)
