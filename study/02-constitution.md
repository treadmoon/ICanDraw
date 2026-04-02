# 第 2 章：制定项目宪法

> 核心问题：怎么给 AI 设定不可逾越的底线？

---

## 2.1 为什么需要"宪法"？

产品定义告诉 AI"做什么"，但没有告诉它"什么绝对不能做"。

举个例子：用户上传了一份包含客户手机号的 CSV 文件。AI 在调用大模型时，是把整个 CSV 发过去，还是只发统计摘要？如果你不提前定好规矩，AI 可能就把用户的隐私数据全发给了云端 API。

再比如：AI 生成图表时，是输出一张 PNG 图片，还是输出 ECharts 的 JSON 配置？如果输出图片，用户就没法编辑了——但 AI 不知道这一点，除非你告诉它。

**项目宪法就是这些"底线规矩"的集合。** 它是整个项目的最高法律，后续所有设计和代码都必须遵守。

## 2.2 ICanDraw 的六条宪法

Spec-Kit 的 `/speckit.constitution` 命令会引导你定义项目宪法。ICanDraw 定了六条：

### 原则 I：AI-Native Product（AI 是核心驱动力）

> AI is the core driver, not an enhancement. Every feature must be designed around AI-first interaction.

含义：不是"做一个图表工具然后加个 AI 功能"，而是"整个产品围绕 AI 设计"。用户不需要懂 ECharts 配置，不需要会画图，AI 全权负责。

**这条原则的实际影响**：后来设计 `SYSTEM_PROMPT` 时，AI 被要求对每个图表自动生成批注——不是用户要求才加，而是默认就有。因为 AI 是核心，不是辅助。

### 原则 II：Structured Output, Never Images（结构化输出，永远不生成图片）

> LLM output MUST always be structured JSON (ECharts option + Excalidraw elements), never generated images.

含义：AI 返回的是 JSON 数据，不是截图。这样用户可以编辑、AI 可以增量修改。

**这条原则的实际影响**：整个 `prompts.ts` 的 SYSTEM_PROMPT 都在强调"你必须返回 JSON"。`route.ts` 的 API 端点做的核心工作就是 `JSON.parse`。如果 AI 返回了非 JSON 内容，前端会报错而不是静默接受。

### 原则 III：Local-First Data Privacy（用户数据不出浏览器）

> User data MUST be processed in the browser. Only desensitized schema/statistics are sent to LLM APIs.

含义：用户的 CSV 文件在浏览器里解析，只把列名、类型、统计值（min/max/mean）发给 AI，不发原始数据。

**这条原则的实际影响**：`CsvUpload.tsx` 用 Papa Parse 在浏览器端解析 CSV，`analyzeCsv()` 提取 schema 和统计值，生成的提示文本只包含摘要信息。

### 原则 IV：Dual-Engine Rendering（双引擎渲染）

> Excalidraw (hand-drawn canvas) and ECharts (interactive charts) as two independent but composable engines.

含义：手绘用 Excalidraw，图表用 ECharts，各司其职，不互相替代。

**这条原则的实际影响**：`Canvas.tsx` 加载 Excalidraw 作为底层画布，`EChartEmbeddable.tsx` 在 Excalidraw 的 embeddable 元素内渲染 ECharts。两个引擎独立运行但组合在一起。

### 原则 V：Incremental Generation（增量生成）

> AI must support incremental canvas updates. Each instruction modifies existing state rather than regenerating from scratch.

含义：用户说"把颜色改成蓝色"，AI 只改颜色，不重新生成整个图表。

**这条原则的实际影响**：`SYSTEM_PROMPT` 的 Modification Rules 明确要求"Keep the same IDs to update in place. Only change what the user requested."。`ChatPanel.tsx` 在发送请求时会附加当前画布上下文，让 AI 知道画布上已有什么。

### 原则 VI：Simplicity & YAGNI（够用就行）

> Start with the minimal viable interaction loop. No premature abstractions. Every added complexity must be justified.

含义：不提前设计用不到的功能。

**这条原则的实际影响**：MVP 没有做用户认证、数据持久化、多人协作、模板市场。`canvas-utils.ts` 只有一个函数 `generateId()`。状态管理用最轻量的 Zustand 而不是 Redux。

## 2.3 宪法的实际文件

宪法存储在 `.specify/memory/constitution.md`，包含四个板块：

| 板块 | 内容 |
|------|------|
| Core Principles | 六条核心原则（上面详述） |
| Technical Standards | 技术栈约束：TypeScript strict、Next.js App Router、Tailwind、Zustand、pnpm |
| Development Workflow | 开发规范：feature 分支、每个故事独立可测、逻辑完成即提交、不留死代码 |
| Governance | 治理规则：宪法优先于所有其他实践，偏离需要在 spec 或 plan 中记录理由 |

## 2.4 宪法在后续阶段的作用

宪法不是写完就放着的。后续每个阶段都会回来对照：

- **制定实施计划时**（第 4 章）：plan.md 里有一个 "Constitution Check" 环节，逐条对照六条原则，确认技术方案没有违反任何一条
- **代码实现时**（第 6 章）：AI 生成的代码如果违反了宪法（比如把原始 CSV 数据发给了 API），review 时应该被拒绝
- **迭代变更时**（第 7 章）：如果新功能需要违反宪法，必须先修改宪法本身，而不是悄悄绕过

## 2.5 教学要点

1. **宪法是给 AI 看的约束，不是给人看的口号**。每条原则都要具体到能影响代码实现。"用户体验优先"太模糊，"用户数据不出浏览器"才有用。
2. **宪法要少而精**。6 条足够了。太多了 AI 记不住，你自己也记不住。
3. **宪法可以修改，但要走流程**。不是不能改，而是改了要通知所有人、更新所有文档。这就是"治理"的含义。

## 2.6 动手练习

为你自己的项目写 3~5 条宪法原则。每条原则要满足：

1. 能用一句话说清楚
2. 能直接影响代码实现（不是空话）
3. 违反了会导致严重后果

---

> 下一章：[第 3 章 — 编写功能规格](./03-specification.md)
