# ICanDraw NoteBook — 文件索引说明

> 本目录是对 ICanDraw 项目中所有 `.md` 和 `.json` 文件的统一归档副本。  
> 文件命名规则：将原始相对路径中的 `/` 替换为 `__`，方便在单一目录中区分来源。  
> 本文档记录每个文件的**原始位置**和**用途说明**。

---

## 📁 根目录文件

| NoteBook 文件名 | 原始路径 | 用途说明 |
|---|---|---|
| `AGENTS.md` | `AGENTS.md` | AI Agent 使用规则，提醒 Agent 本项目使用的 Next.js 版本有 Breaking Change，需在写代码前先阅读官方文档。 |
| `CLAUDE.md` | `CLAUDE.md` | Claude AI 编辑器配置文档，定义 Claude 在本项目中的行为规范。 |
| `README.md` | `README.md` | 项目主说明文档，介绍 Next.js 项目启动方式及基本使用指引。 |
| `spec.md` | `spec.md` | ICanDraw v1.0 产品规格文档——AI 驱动的数据可视化智能画布，定义产品定位与核心功能。 |
| `spec2.md` | `spec2.md` | ICanDraw v2.0 优化版规格文档，在 v1 基础上重塑产品定位，补充改进方案。 |
| `spec3.md` | `spec3.md` | ICanDraw v3.0 规格文档，定位为"数据叙事伴侣"，强调可交互、带情绪的视觉故事。 |
| `package.json` | `package.json` | Node.js 项目包配置，记录项目依赖、脚本命令（dev/build/lint）等。 |
| `tsconfig.json` | `tsconfig.json` | TypeScript 编译器配置，定义类型检查规则与路径别名。 |

---

## 📁 docs/ — 项目文档

| NoteBook 文件名 | 原始路径 | 用途说明 |
|---|---|---|
| `docs__development-process.md` | `docs/development-process.md` | ICanDraw 开发过程总结，介绍使用 Kiro Spec-Kit 工作流从需求到代码的结构化开发流程。 |
| `docs__getting-started.md` | `docs/getting-started.md` | 新手上手指南，目标是让开发者在 15 分钟内把项目跑起来、理解代码结构并开始修改。 |
| `docs__internal-sharing.md` | `docs/internal-sharing.md` | 内部技术分享文字稿，面向非 AI 编程背景同事，讲述如何用 AI 从一句话变成可运行产品。 |

---

## 📁 specs/001-canvas-mvp/ — 功能规格

| NoteBook 文件名 | 原始路径 | 用途说明 |
|---|---|---|
| `specs__001-canvas-mvp__spec.md` | `specs/001-canvas-mvp/spec.md` | AI Canvas MVP 功能规格说明，定义分支 `001-canvas-mvp` 的功能范围与设计要求（创建于 2026-03-26）。 |
| `specs__001-canvas-mvp__plan.md` | `specs/001-canvas-mvp/plan.md` | AI Canvas MVP 实施计划，基于 spec.md 制定的技术架构与开发步骤。 |
| `specs__001-canvas-mvp__tasks.md` | `specs/001-canvas-mvp/tasks.md` | AI Canvas MVP 任务清单，以 spec.md 和 plan.md 为输入拆解的具体开发任务列表。 |

---

## 📁 .kiro/ — Kiro AI 工具配置

### agents/

| NoteBook 文件名 | 原始路径 | 用途说明 |
|---|---|---|
| `kiro__agents__default.json` | `.kiro/agents/default.json` | Kiro 默认 Agent 配置，名为 `default`，附带 stop hook 可在 AI 响应后自动记录技术决策到 `docs/decision-log.md`。 |

### prompts/ — Spec-Kit 提示词

| NoteBook 文件名 | 原始路径 | 用途说明 |
|---|---|---|
| `kiro__prompts__speckit.analyze.md` | `.kiro/prompts/speckit.analyze.md` | `/speckit.analyze` 命令提示词，对 spec.md、plan.md、tasks.md 进行一致性与质量分析（非破坏性）。 |
| `kiro__prompts__speckit.checklist.md` | `.kiro/prompts/speckit.checklist.md` | `/speckit.checklist` 命令提示词，生成功能实现前的检查清单。 |
| `kiro__prompts__speckit.clarify.md` | `.kiro/prompts/speckit.clarify.md` | `/speckit.clarify` 命令提示词，对模糊需求进行澄清和追问。 |
| `kiro__prompts__speckit.constitution.md` | `.kiro/prompts/speckit.constitution.md` | `/speckit.constitution` 命令提示词，管理项目架构原则（Constitution 文档）。 |
| `kiro__prompts__speckit.implement.md` | `.kiro/prompts/speckit.implement.md` | `/speckit.implement` 命令提示词，驱动 AI 按 tasks.md 逐步实现代码。 |
| `kiro__prompts__speckit.plan.md` | `.kiro/prompts/speckit.plan.md` | `/speckit.plan` 命令提示词，基于 spec.md 生成技术实施计划（plan.md）。 |
| `kiro__prompts__speckit.specify.md` | `.kiro/prompts/speckit.specify.md` | `/speckit.specify` 命令提示词，将自然语言功能描述转化为结构化功能规格（spec.md）。 |
| `kiro__prompts__speckit.tasks.md` | `.kiro/prompts/speckit.tasks.md` | `/speckit.tasks` 命令提示词，将 plan.md 拆解为具体开发任务（tasks.md）。 |
| `kiro__prompts__speckit.taskstoissues.md` | `.kiro/prompts/speckit.taskstoissues.md` | `/speckit.taskstoissues` 命令提示词，将 tasks.md 中的任务转换为 Issue 格式（如 GitHub Issues）。 |

---

## 📁 .specify/ — Specify 工作流工具

### memory/

| NoteBook 文件名 | 原始路径 | 用途说明 |
|---|---|---|
| `specify__memory__constitution.md` | `.specify/memory/constitution.md` | ICanDraw Constitution 文件，记录项目核心架构原则，供 Specify 工具跨会话引用。 |

### templates/ — 文档模板

| NoteBook 文件名 | 原始路径 | 用途说明 |
|---|---|---|
| `specify__templates__agent-file-template.md` | `.specify/templates/agent-file-template.md` | Agent 文件模板，规定 Agent 上下文文件的标准格式。 |
| `specify__templates__checklist-template.md` | `.specify/templates/checklist-template.md` | 检查清单模板，用于生成功能实现前的标准检查项。 |
| `specify__templates__constitution-template.md` | `.specify/templates/constitution-template.md` | Constitution 文档模板，定义项目架构原则文件的结构。 |
| `specify__templates__plan-template.md` | `.specify/templates/plan-template.md` | 实施计划模板，规定 plan.md 的标准章节与格式。 |
| `specify__templates__spec-template.md` | `.specify/templates/spec-template.md` | 功能规格模板，规定 spec.md 的标准章节与格式。 |
| `specify__templates__tasks-template.md` | `.specify/templates/tasks-template.md` | 任务清单模板，规定 tasks.md 的标准任务条目格式。 |

### 配置

| NoteBook 文件名 | 原始路径 | 用途说明 |
|---|---|---|
| `specify__init-options.json` | `.specify/init-options.json` | Specify 工具初始化配置，记录工作流的初始化选项。 |

---

## 📁 .workbuddy/ — WorkBuddy AI 助手配置

| NoteBook 文件名 | 原始路径 | 用途说明 |
|---|---|---|
| `workbuddy__memory__MEMORY.md` | `.workbuddy/memory/MEMORY.md` | WorkBuddy 长期记忆文件，跨会话保存项目关键信息、决策记录和用户偏好。 |
| `workbuddy__settings.local.json` | `.workbuddy/settings.local.json` | WorkBuddy 本地设置文件，存储 WorkBuddy 在本项目的本地配置项。 |

---

## 统计

| 类型 | 数量 |
|---|---|
| `.md` 文件 | 28 个 |
| `.json` 文件 | 5 个 |
| **合计** | **33 个** |

---

*归档时间：2026-03-30*
