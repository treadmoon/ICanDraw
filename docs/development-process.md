# ICanDraw 开发过程总结

## 概述

ICanDraw 项目使用 Kiro 的 Spec-Kit（v0.4.2）工作流进行开发。Spec-Kit 是一套"从需求到代码"的结构化开发流程，通过一系列 prompt 命令（`/speckit.*`）驱动 AI 逐步完成需求分析、架构设计、任务拆解和代码实现。

整个流程分为 **7 个阶段**，每个阶段有明确的输入、输出和交付物。

---

## 阶段 0：项目初始化

**做了什么**：初始化 Spec-Kit 工作环境，生成脚手架目录、自动化脚本、文档模板和 AI prompt 定义文件。这些文件构成了整个 Spec-Kit 工作流的基础设施。

### 生成的配置文件

| 文件 | 作用 |
|------|------|
| `.specify/init-options.json` | Spec-Kit 全局配置文件，记录初始化选项 |

`init-options.json` 内容详解：
```json
{
  "ai": "kiro-cli",           // 使用的 AI 工具（kiro-cli）
  "ai_commands_dir": null,     // 自定义 AI 命令目录（未使用）
  "ai_skills": false,          // 是否启用 AI 技能扩展
  "branch_numbering": "sequential", // feature 分支编号方式（顺序递增：001, 002...）
  "here": true,                // 在当前目录初始化（非子目录）
  "offline": false,            // 是否离线模式
  "preset": null,              // 预设配置（未使用）
  "script": "sh",              // 脚本类型（bash shell）
  "speckit_version": "0.4.2"   // Spec-Kit 版本号
}
```

### 生成的自动化脚本

所有脚本位于 `.specify/scripts/bash/` 目录下，由各阶段的 prompt 自动调用：

| 脚本文件 | 作用 | 被谁调用 |
|---------|------|---------|
| `common.sh` | 公共函数库，提供所有脚本共享的基础能力 | 被其他所有脚本 `source` 引入 |
| `check-prerequisites.sh` | 前置条件检查脚本 | 几乎每个 `/speckit.*` 命令执行前都会调用 |
| `create-new-feature.sh` | 创建新 feature 分支和文档目录 | 开始新功能开发时手动调用 |
| `setup-plan.sh` | 初始化 plan.md 文件（从模板复制） | `/speckit.plan` 调用 |
| `update-agent-context.sh` | 更新 AI agent 上下文文件 | plan 完成后自动调用 |

各脚本详细说明：

**`common.sh`** — 公共函数库（12KB）
- `find_specify_root()`: 向上搜索 `.specify` 目录，定位项目根目录
- `get_repo_root()`: 获取仓库根目录（优先 `.specify`，回退到 git root）
- `get_current_branch()`: 获取当前分支名（支持 `SPECIFY_FEATURE` 环境变量覆盖）
- `get_feature_paths()`: 计算 feature 相关的所有路径（FEATURE_DIR, FEATURE_SPEC, IMPL_PLAN, TASKS 等）
- `resolve_template()`: 查找模板文件路径
- `check_feature_branch()`: 验证当前是否在合法的 feature 分支上

**`check-prerequisites.sh`** — 前置条件检查（6KB）
- 验证当前是否在 feature 分支上
- 检查必需的文档文件是否存在（spec.md, plan.md, tasks.md）
- 支持多种输出模式：`--json`（JSON 格式）、`--paths-only`（仅路径）、`--require-tasks`（要求 tasks.md 存在）
- 输出关键变量：`FEATURE_DIR`, `AVAILABLE_DOCS`, `FEATURE_SPEC`, `IMPL_PLAN`, `TASKS`

**`create-new-feature.sh`** — 创建新 feature（12KB）
- 参数：`--short-name <name>` 指定短名称，`--number N` 指定编号，`--timestamp` 使用时间戳
- 自动计算下一个顺序编号（如 001 → 002）
- 创建 `specs/NNN-feature-name/` 目录
- 从模板复制 `spec.md` 到新目录
- 支持 `--json` 输出创建结果

**`setup-plan.sh`** — 初始化计划文件
- 从 `.specify/templates/plan-template.md` 复制模板到 feature 目录
- 确保 feature 目录存在

**`update-agent-context.sh`** — 更新 AI 上下文（29KB，最大的脚本）
- 解析 plan.md 提取项目元数据（语言、框架、数据库、项目类型）
- 支持 25+ 种 AI agent 格式（Claude, Gemini, Copilot, Cursor, Kiro CLI 等）
- 生成语言特定的构建/测试命令
- 更新 AGENTS.md / CLAUDE.md 等 agent 上下文文件

### 生成的文档模板

所有模板位于 `.specify/templates/` 目录下，是各阶段文档的骨架：

| 模板文件 | 用于生成 | 包含的占位符/结构 |
|---------|---------|-----------------|
| `constitution-template.md` | `.specify/memory/constitution.md` | `[PROJECT_NAME]`, `[PRINCIPLE_1_NAME]`, `[PRINCIPLE_1_DESCRIPTION]` 等占位符；包含 Core Principles、Technical Standards、Development Workflow、Governance 四大板块 |
| `spec-template.md` | `specs/NNN-xxx/spec.md` | User Stories（带优先级 P1/P2/P3）、Acceptance Scenarios（Given/When/Then）、Functional Requirements、Key Entities、Success Criteria、Assumptions |
| `plan-template.md` | `specs/NNN-xxx/plan.md` | Summary、Technical Context（语言/框架/存储/测试/平台）、Constitution Check、Project Structure（三种布局选项）、Complexity Tracking |
| `tasks-template.md` | `specs/NNN-xxx/tasks.md` | Phase 分组、Task ID 编号、`[P]` 并行标记、`[US1]` 故事标记、Checkpoint 检查点、Dependencies 依赖关系、Parallel Opportunities |
| `checklist-template.md` | 自定义检查清单 | 分类分组的检查项，`CHK001` 编号，用于需求质量验证（"需求的单元测试"） |
| `agent-file-template.md` | AGENTS.md / CLAUDE.md 等 | Active Technologies、Project Structure、Commands、Code Style、Recent Changes |

### 生成的 AI Prompt 定义

所有 prompt 位于 `.kiro/prompts/` 目录下，定义了每个 `/speckit.*` 命令的执行逻辑：

| Prompt 文件 | 对应命令 | 功能描述 | 下游衔接 |
|------------|---------|---------|---------|
| `speckit.constitution.md` | `/speckit.constitution` | 创建/更新项目宪法，填充模板占位符 | → `speckit.specify` |
| `speckit.specify.md` | `/speckit.specify` | 从自然语言描述生成功能规格书 | → `speckit.plan` 或 `speckit.clarify` |
| `speckit.clarify.md` | `/speckit.clarify` | 检测 spec 中的模糊点，提问并回写答案 | → `speckit.plan` |
| `speckit.plan.md` | `/speckit.plan` | 生成实施计划（架构、技术决策、目录结构） | → `speckit.tasks` 或 `speckit.checklist` |
| `speckit.tasks.md` | `/speckit.tasks` | 将 plan 拆解为可执行的任务清单 | → `speckit.analyze` 或 `speckit.implement` |
| `speckit.analyze.md` | `/speckit.analyze` | 只读分析三个文档的一致性 | 输出分析报告 |
| `speckit.implement.md` | `/speckit.implement` | 按 tasks.md 逐任务执行代码实现 | 生成源代码 |
| `speckit.checklist.md` | `/speckit.checklist` | 生成自定义检查清单（需求质量验证） | 独立使用 |
| `speckit.taskstoissues.md` | `/speckit.taskstoissues` | 将 tasks.md 转为 GitHub Issues | 需要 GitHub MCP Server |

每个 prompt 文件的结构：
- **YAML frontmatter**：`description`（命令描述）、`handoffs`（下游命令链接）、`tools`（需要的工具）
- **Pre-Execution Checks**：检查扩展钩子（`.specify/extensions.yml`）
- **Execution Steps**：调用脚本 → 读取输入文件 → 生成输出文件
- **Handoff Buttons**：完成后提供下一步操作的快捷按钮


---

## 阶段 1：制定项目宪法（Constitution）

**命令**：`/speckit.constitution`

**做了什么**：定义项目的核心原则和技术标准。宪法是整个项目的"最高法律"，后续所有设计和实现决策都必须遵守。如果新功能需要违反宪法，必须先修改宪法本身。

**输入**：项目愿景描述（本项目来自 spec.md / spec2.md / spec3.md 中的产品定位）

**执行过程**：
1. 读取 `.specify/templates/constitution-template.md` 模板
2. 识别所有 `[PLACEHOLDER]` 占位符
3. 根据用户输入和项目上下文填充具体内容
4. 写入 `.specify/memory/constitution.md`

**生成的文件**：

| 文件 | 作用 |
|------|------|
| `.specify/memory/constitution.md` | 项目宪法，所有后续阶段的合规基准 |

**本项目宪法的具体内容**：

| 原则 | 名称 | 含义 |
|------|------|------|
| I | AI-Native Product | AI 是核心驱动力，不是增强功能。每个功能都围绕 AI 优先交互设计 |
| II | Structured Output, Never Images | LLM 输出必须是结构化 JSON（ECharts option + Excalidraw elements），不是生成图片。确保内容可编辑、可回退、可增量修改 |
| III | Local-First Data Privacy | 用户数据在浏览器端处理，只有脱敏的 schema/统计信息发送给 LLM |
| IV | Dual-Engine Rendering | Excalidraw（手绘画布）+ ECharts（交互图表）双引擎，各自独立但可组合 |
| V | Incremental Generation | AI 支持增量画布更新，每次指令修改现有状态而非重新生成 |
| VI | Simplicity & YAGNI | 最小可行，不过度设计，每个复杂度必须有具体场景支撑 |

技术标准：TypeScript strict、Next.js App Router、Tailwind CSS、Zustand、Vercel AI SDK、pnpm

开发工作流：feature 分支、每个故事独立可测、逻辑完成即提交、不留死代码

治理规则：宪法优先于所有其他开发实践，偏离需要在 spec 或 plan 中明确记录理由

---

## 阶段 2：编写功能规格（Specification）

**命令**：`/speckit.specify`

**做了什么**：将产品需求转化为结构化的功能规格文档。这是从"用户想要什么"到"系统应该做什么"的翻译过程。

**输入**：用户的自然语言描述，本项目为 "ICanDraw Phase 1 — AI 图表生成器 MVP，对话式生成 ECharts 图表 + Excalidraw 手绘批注到画布上"

**执行过程**：
1. 调用 `check-prerequisites.sh --json --paths-only` 获取路径
2. 检查扩展钩子（`.specify/extensions.yml`）
3. 读取 `.specify/templates/spec-template.md` 模板
4. 根据用户描述填充所有板块
5. 写入 `specs/001-canvas-mvp/spec.md`

**生成的文件**：

| 文件 | 作用 |
|------|------|
| `specs/001-canvas-mvp/spec.md` | 功能规格书，定义"做什么"和"怎么验收" |

**spec.md 的结构详解**：

**1. User Scenarios & Testing（用户场景与测试）**

每个 User Story 包含：
- 标题和优先级（P1 最高）
- 自然语言描述
- 优先级理由（Why this priority）
- 独立测试方法（Independent Test）
- Given/When/Then 验收场景

本项目的 4 个 User Story：

| 优先级 | 标题 | 核心价值 |
|--------|------|---------|
| P1 | 对话生成图表 | 产品核心链路——自然语言到可视化 |
| P2 | AI 手绘批注 | 与普通 BI 工具的核心差异——"情绪化批注" |
| P3 | 对话迭代修改 | AI 原生产品关键体验——协作打磨 |
| P4 | CSV 数据上传 | 从"玩具"到"工具"的关键跨越 |

**2. Edge Cases（边界情况）**
- 无关输入的引导
- CSV 格式异常处理
- 多图表时的指令指向
- ECharts option 格式错误的优雅降级

**3. Requirements（需求）**
- 8 条功能需求（FR-001 ~ FR-008），使用 MUST 关键字
- Key Entities：Canvas State、Chat Message、Chart Instance、Annotation

**4. Success Criteria（成功标准）**
- 5 条可量化指标（如"3 秒内开始渲染"、"支持 5 种图表类型"）

**5. Assumptions（假设）**
- MVP 使用 GPT-4o 兼容 API
- 现代浏览器
- 不需要登录
- 不需要持久化

---

## 阶段 2.5（可选）：需求澄清（Clarify）

**命令**：`/speckit.clarify`

**做了什么**：检测 spec.md 中的模糊点和缺失决策点，提出最多 5 个针对性问题，将答案编码回 spec.md。

**执行过程**：
1. 读取当前 spec.md
2. 分析每个 User Story、Requirement、Assumption 中的模糊表述
3. 识别标记为 `[NEEDS CLARIFICATION]` 的条目
4. 生成最多 5 个高针对性问题
5. 与用户交互获取答案
6. 将答案写回 spec.md 对应位置

**何时使用**：
- 复杂功能建议执行
- 探索性开发可跳过（但会增加下游返工风险）
- 必须在 `/speckit.plan` 之前完成

---

## 阶段 3：制定实施计划（Plan）

**命令**：`/speckit.plan`

**做了什么**：基于 spec.md 和 constitution.md，制定技术架构和实施计划。这是从"做什么"到"怎么做"的翻译。

**输入**：`specs/001-canvas-mvp/spec.md` + `.specify/memory/constitution.md`

**执行过程**：
1. 调用 `setup-plan.sh` 从模板初始化 plan.md
2. 读取 spec.md 和 constitution.md
3. 逐条对照宪法做合规检查
4. 设计技术架构和目录结构
5. 记录关键技术决策及理由
6. 调用 `update-agent-context.sh` 更新 AI 上下文
7. 写入 `specs/001-canvas-mvp/plan.md`

**生成的文件**：

| 文件 | 作用 |
|------|------|
| `specs/001-canvas-mvp/plan.md` | 实施计划书，定义"怎么做"和"为什么这么做" |

**plan.md 的结构详解**：

**1. Technical Context（技术上下文）**
```
Language/Version: TypeScript 5.x (strict mode)
Framework: Next.js 15 (App Router)
Primary Dependencies: @excalidraw/excalidraw, echarts, ai, zustand, tailwindcss
Storage: Browser memory (Zustand store)
Target Platform: Modern browsers
Constraints: AI response < 3s, CSV parse < 2s for < 10MB
```

**2. Constitution Check（宪法合规检查）**

逐条对照 6 条原则，标记 ✅ 通过：
- ✅ AI-Native: 所有图表生成由 LLM 驱动
- ✅ Structured Output: LLM 返回 JSON
- ✅ Local-First: CSV 在浏览器解析
- ✅ Dual-Engine: Excalidraw + ECharts
- ✅ Incremental: 画布状态是 JSON，AI 做 patch
- ✅ Simplicity: 最小依赖

**3. Project Structure（项目结构）**

完整的目录树，每个文件标注职责：
```
src/
├── app/
│   ├── layout.tsx           # 根布局
│   ├── page.tsx             # 主页面——左右分栏
│   └── api/chat/route.ts    # AI 对话端点
├── components/
│   ├── ChatPanel.tsx        # 对话面板
│   ├── Canvas.tsx           # 画布（Excalidraw + ECharts）
│   ├── ChatMessage.tsx      # 消息气泡
│   ├── ChartOverlay.tsx     # ECharts 覆盖层
│   └── CsvUpload.tsx        # CSV 上传
├── stores/
│   ├── canvas-store.ts      # 画布状态
│   └── chat-store.ts        # 对话状态
├── lib/
│   ├── ai/prompts.ts        # AI 提示词
│   ├── ai/schema.ts         # AI 输出 Zod schema
│   └── canvas-utils.ts      # 工具函数
└── types/index.ts           # 共享类型
```

**4. Key Technical Decisions（关键技术决策）**

| 决策 | 方案 | 理由 |
|------|------|------|
| ECharts + Excalidraw 集成 | Overlay（绝对定位浮层） | ForeignObject 在 Safari 兼容性差 |
| AI 输出格式 | Vercel AI SDK `generateObject` + Zod schema | 结构化输出，类型安全 |
| 状态管理 | Zustand store + diff/patch | 轻量，支持增量更新 |
| CSV 解析 | Papa Parse 浏览器端 | 符合 Local-First 原则 |


---

## 阶段 4：任务拆解（Tasks）

**命令**：`/speckit.tasks`

**做了什么**：将 plan.md 拆解为可执行的开发任务，按依赖关系排序，分配到各阶段。每个任务有明确的目标文件、前置依赖和完成标准。

**输入**：`specs/001-canvas-mvp/plan.md` + `specs/001-canvas-mvp/spec.md`

**执行过程**：
1. 调用 `check-prerequisites.sh --json --paths-only` 获取路径
2. 读取 plan.md（目录结构、技术决策）和 spec.md（用户故事、验收标准）
3. 按 User Story 优先级组织任务
4. 标注并行机会（`[P]`）和故事归属（`[US1]`）
5. 设置阶段检查点（Checkpoint）
6. 写入 `specs/001-canvas-mvp/tasks.md`

**生成的文件**：

| 文件 | 作用 |
|------|------|
| `specs/001-canvas-mvp/tasks.md` | 任务清单，定义"按什么顺序做"和"每步做什么" |

**tasks.md 的结构详解**：

**任务格式规范**：
- `[x]` / `[ ]`：完成/未完成状态
- `T001`：任务编号（全局唯一）
- `[P]`：可并行执行（不同文件，无依赖）
- 每个任务包含目标文件路径

**本项目的 7 个阶段、31 个任务**：

| 阶段 | 任务数 | 目标 | 检查点 |
|------|--------|------|--------|
| Phase 1: Setup | T001-T003 | 初始化项目、安装依赖、配置工具链 | 项目可运行 |
| Phase 2: Foundational | T004-T010 | 类型定义、Store、Schema、Prompt、API 路由、布局 | API 可调用，Store 可用 |
| Phase 3: US1 对话生成图表 | T011-T016 | ChatMessage、ChatPanel、ChartOverlay、Canvas、Page、流程串联 | 输入文字，画布出现图表 |
| Phase 4: US2 手绘批注 | T017-T020 | 扩展 Schema/Prompt、canvas-utils、Canvas 注入 Excalidraw 元素、合并流程 | 图表旁出现手绘批注 |
| Phase 5: US3 迭代修改 | T021-T024 | 上下文构建、修改 Prompt、Store merge 逻辑、图表替换 | 修改指令后图表原位更新 |
| Phase 6: US4 CSV 上传 | T025-T028 | CsvUpload 组件、csv-parser、上传流程、自定义指令 | 拖入 CSV 自动生成图表 |
| Phase 7: Polish | T029-T031 | 加载状态、响应式布局、文档 | 体验完善 |

**依赖关系**：
```
Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3 (US1 核心链路)
                                              ├→ Phase 4 (US2 批注) ─┐
                                              ├→ Phase 5 (US3 修改) ─┼→ Phase 7 (Polish)
                                              └→ Phase 6 (US4 CSV) ──┘
```
Phase 4/5/6 可并行，都只依赖 Phase 3。

---

## 阶段 4.5（可选）：一致性分析（Analyze）

**命令**：`/speckit.analyze`

**做了什么**：只读分析 spec.md、plan.md、tasks.md 三个文档的一致性，检测矛盾、遗漏、重复。

**执行过程**：
1. 调用 `check-prerequisites.sh --json --require-tasks --include-tasks`
2. 读取三个文档
3. 交叉比对：
   - spec 中的每个 User Story 是否在 tasks 中有对应任务
   - plan 中的每个技术决策是否在 tasks 中有实现任务
   - tasks 中的每个任务是否能追溯到 spec 的需求
   - 宪法原则是否被违反
4. 输出结构化分析报告

**关键规则**：
- **严格只读**：不修改任何文件
- **宪法权威**：宪法冲突自动标记为 CRITICAL
- 必须在 `/speckit.tasks` 之后、`/speckit.implement` 之前执行

---

## 阶段 5：代码实现（Implement）

**命令**：`/speckit.implement`

**做了什么**：按 tasks.md 的顺序逐个执行任务，生成代码文件。每完成一个任务，在 tasks.md 中标记 `[x]`。

**输入**：`specs/001-canvas-mvp/tasks.md`（任务清单）+ plan.md（架构参考）

**执行过程**：
1. 读取 tasks.md，找到第一个未完成的任务 `[ ]`
2. 读取任务描述中的目标文件路径
3. 根据 plan.md 的架构设计和 spec.md 的需求生成代码
4. 写入目标文件
5. 在 tasks.md 中将该任务标记为 `[x]`
6. 到达 Checkpoint 时验证阶段目标
7. 重复直到所有任务完成

**本项目生成的源码文件**：

| 文件 | 作用 | 对应任务 |
|------|------|---------|
| `src/types/index.ts` | 共享 TypeScript 类型（ChartData, Drawing, Annotation, AIResponse 等） | T004 |
| `src/stores/canvas-store.ts` | Zustand 画布状态（chartOptions, drawings, annotations, excalidrawAPI） | T005 |
| `src/stores/chat-store.ts` | Zustand 对话状态（messages, isLoading） | T006 |
| `src/lib/ai/schema.ts` | AI 输出的 Zod 校验 schema（charts + annotations 结构定义） | T007 |
| `src/lib/ai/prompts.ts` | AI 系统提示词（图表生成规则、图形绘制规则、修改规则） | T008 |
| `src/app/api/chat/route.ts` | AI 对话 API 路由（调用火山方舟 API，解析 JSON 响应） | T009 |
| `src/app/layout.tsx` | 根布局（字体、全局样式） | T010 |
| `src/app/page.tsx` | 主页面（左画布 + 右对话面板的分栏布局） | T015 |
| `src/app/globals.css` | Tailwind 全局样式 | T010 |
| `src/app/error.tsx` | 路由级错误边界 | T029 |
| `src/app/global-error.tsx` | 全局错误边界 | T029 |
| `src/app/loading.tsx` | 加载状态 | T029 |
| `src/components/ChatPanel.tsx` | 对话面板（输入框、消息列表、AI 调用、数据规范化、画布应用） | T012 |
| `src/components/Canvas.tsx` | 画布组件（Excalidraw 加载、embeddable 渲染、drawings/annotations 同步） | T014 |
| `src/components/EChartEmbeddable.tsx` | ECharts 嵌入组件（在 Excalidraw embeddable 元素内渲染图表） | 后续迭代 |
| `src/components/ChatMessage.tsx` | 单条消息气泡（用户/AI/错误三种样式） | T011 |
| `src/components/CsvUpload.tsx` | CSV 拖拽上传（Papa Parse 解析、schema 提取、发送给 AI） | T025 |
| `src/lib/canvas-utils.ts` | 工具函数（`generateId()` 使用 `crypto.randomUUID()`） | T018 |
| `src/stores/i18n-store.ts` | 国际化状态（中英文字典、locale 切换） | 后续迭代 |

---

## 阶段 6：后续迭代

Spec-Kit 流程产出 MVP 代码后，后续功能迭代在 MVP 基础上进行。本项目实际进行的迭代：

| 迭代内容 | 触发原因 | 改动的文件 |
|----------|---------|-----------|
| 布局调整（画布左、对话右） | 用户要求 | `page.tsx` |
| 修复 AI API 兼容性 | doubao reasoning 模型返回 `reasoning_content` 字段，ai-sdk 不兼容 | `api/chat/route.ts`（去掉 ai-sdk，改用直接 fetch） |
| AI 响应数据规范化 | 模型返回的 JSON 结构和代码期望不一致 | `ChatPanel.tsx`（新增 normalizeChart/normalizeAnnotation） |
| ECharts 作为 Excalidraw 原生元素 | 图表需要支持拖拽、缩放、旋转 | 新增 `EChartEmbeddable.tsx`，重写 `Canvas.tsx`、`canvas-store.ts`，删除 `ChartOverlay.tsx` |
| 支持 Excalidraw 原生图形 | 用户需要画流程图等结构化图形 | 新增 `Drawing` 类型，扩展 `prompts.ts`、`Canvas.tsx`、`ChatPanel.tsx` |
| 中英文国际化 | 用户要求 | 新增 `i18n-store.ts`，修改所有含 UI 文本的组件 |
| 修复流程图连线 | 箭头 width/height 计算错误 | `Canvas.tsx`（从 points 自动计算尺寸） |

---

## 完整文件关系图

```
用户需求描述 (spec.md / spec2.md / spec3.md)
    │
    ▼
/speckit.constitution ──→ .specify/memory/constitution.md (项目宪法)
    │
    ▼
/speckit.specify ──→ specs/001-canvas-mvp/spec.md (功能规格)
    │
    ▼
/speckit.clarify ──→ 更新 spec.md (澄清模糊点，可选)
    │
    ▼
/speckit.plan ──→ specs/001-canvas-mvp/plan.md (实施计划)
    │
    ▼
/speckit.tasks ──→ specs/001-canvas-mvp/tasks.md (任务清单)
    │
    ▼
/speckit.analyze ──→ 一致性分析报告 (只读，可选)
    │
    ▼
/speckit.implement ──→ src/**/*.ts(x) (源代码)
```

---

## 阶段 7：决策日志自动记录（Hook 机制）

**做了什么**：配置 Kiro CLI 的 stop hook，在每次 AI 回复后自动检测是否包含技术决策，如果有则追加到 `docs/decision-log.md`。

**动机**：前面"长期记忆与共享记忆"章节提到，关键决策如果只存在于聊天记录里，对话关了就丢了。手动记录又容易忘。通过 hook 自动化，确保每个决策都被捕获。

**涉及的文件**：

| 文件 | 作用 |
|------|------|
| `.kiro/hooks/log-decisions.sh` | Hook 脚本，解析 AI 回复并提取决策摘要 |
| `.kiro/agents/default.json` | Agent 配置，注册 stop hook |
| `docs/decision-log.md` | 自动生成的决策日志（首次触发时创建） |

**工作原理**：

1. Kiro CLI 每次 AI 回复结束后触发 `stop` hook
2. 脚本从 stdin 读取 hook 事件 JSON，提取 `assistant_response`
3. 用正则匹配决策关键词（改了/换成/删除/新增/重写/修复/因为...所以 等中英文模式）
4. 匹配到则提取第一行决策摘要（截断到 120 字符）
5. 追加带时间戳的条目到 `docs/decision-log.md`

**Agent 配置**（`.kiro/agents/default.json`）：
```json
{
  "name": "default",
  "description": "ICanDraw default agent with decision logging",
  "hooks": {
    "stop": [
      {
        "command": "bash .kiro/hooks/log-decisions.sh",
        "description": "Auto-log technical decisions from AI responses to docs/decision-log.md",
        "timeout_ms": 5000
      }
    ]
  }
}
```

**决策日志格式**：
```markdown
### 2026-03-30 10:05

去掉 ai-sdk，改用直接 fetch 调用豆包 API

---
```

---

## 功能迭代指南

### 判断迭代规模

| 规模 | 典型场景 | 是否走 Spec-Kit |
|------|---------|----------------|
| 小改动 | Bug 修复、UI 微调、样式调整 | 否，直接改代码 |
| 中等功能 | 新增独立能力（如国际化、新图形类型） | 部分，更新现有 spec 文档 |
| 大功能 | 独立模块（如多人协作、数据持久化） | 是，创建新 feature 走完整流程 |

### 小改动：直接修改代码

不需要更新任何文档，直接定位问题文件修改即可。

### 中等功能：更新现有 spec 文档 + 写代码

修改顺序：
```
1. specs/001-canvas-mvp/spec.md    → 追加 User Story 和验收标准
2. specs/001-canvas-mvp/plan.md    → 更新目录结构、补充技术决策
3. specs/001-canvas-mvp/tasks.md   → 追加新的 Phase 和 Task
4. src/types/index.ts              → 新增/修改类型定义
5. src/lib/ai/prompts.ts           → 扩展 AI 提示词（如果涉及 AI 行为变化）
6. 相关组件和 store                 → 实现代码
```

### 大功能：创建新 feature，走完整 Spec-Kit 流程

```bash
# Step 1: 创建新 feature
.specify/scripts/bash/create-new-feature.sh --short-name "collaboration"

# 生成：specs/002-collaboration/spec.md

# Step 2: 按顺序执行
/speckit.specify   → 编写功能规格
/speckit.clarify   → 澄清模糊点（可选）
/speckit.plan      → 制定实施计划
/speckit.tasks     → 拆解任务清单
/speckit.analyze   → 一致性检查（可选）
/speckit.implement → 逐任务实现
```

### 迭代后的文档维护

每次迭代完成后建议补录：
1. **tasks.md** — 将完成的任务标记 `[x]`，追加新任务
2. **spec.md** — 补充新的 User Story（如果改变了用户体验）
3. **plan.md** — 更新技术决策（如果引入了新架构）
