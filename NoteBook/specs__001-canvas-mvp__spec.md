# Feature Specification: AI Canvas MVP

**Feature Branch**: `001-canvas-mvp`
**Created**: 2026-03-26
**Status**: Draft
**Input**: User description: "ICanDraw Phase 1 — AI 图表生成器 MVP，对话式生成 ECharts 图表 + Excalidraw 手绘批注到画布上"

## User Scenarios & Testing

### User Story 1 - 对话生成图表 (Priority: P1)

用户在左侧对话面板输入自然语言描述（如"画一个2024年Q1-Q4的销售趋势折线图"），AI 解析意图并在右侧画布上生成一个可交互的 ECharts 图表。

**Why this priority**: 这是产品的核心价值链路——自然语言到可视化图表的转换。没有这个，产品不存在。

**Independent Test**: 输入一句话描述，画布上出现对应的 ECharts 图表，图表支持 tooltip 交互。

**Acceptance Scenarios**:

1. **Given** 用户在对话框输入"画一个柱状图，展示周一到周五的销售额"，**When** 按下回车，**Then** 画布上出现一个柱状图，X轴为周一到周五，Y轴为AI生成的示例数据，图表支持 hover tooltip。
2. **Given** 用户输入"折线图展示过去12个月的用户增长趋势"，**When** AI 处理完成，**Then** 画布上出现折线图，AI 自动生成合理的模拟数据。
3. **Given** AI 正在生成图表，**When** 用户等待，**Then** 对话面板显示流式输出的思考过程/进度。

---

### User Story 2 - AI 手绘批注 (Priority: P2)

AI 在生成图表的同时，自动分析数据特征（极值、趋势、异常），并在图表周围生成 Excalidraw 手绘风格的批注（箭头 + 文字标注）。

**Why this priority**: 这是产品与普通 BI 工具的核心差异——"情绪化批注"让数据会说话。

**Independent Test**: 生成图表后，画布上同时出现手绘风格的箭头指向关键数据点，旁边有文字注释。

**Acceptance Scenarios**:

1. **Given** AI 生成了一个柱状图，**When** 数据中存在明显的最大值，**Then** AI 自动用 Excalidraw 手绘箭头指向最高柱子，并标注"峰值：XXX"。
2. **Given** AI 生成了一个折线图，**When** 数据中存在下降趋势，**Then** AI 用手绘圈标记下降区间，并标注分析文字。

---

### User Story 3 - 对话迭代修改 (Priority: P3)

用户可以通过后续对话修改已有的图表，如"把柱状图换成饼图"、"把颜色改成蓝色系"、"加上数据标签"。AI 增量修改画布上的现有内容，而不是重新生成。

**Why this priority**: 迭代修改是 AI 原生产品的关键体验——用户和 AI 协作打磨，而非一次性生成。

**Independent Test**: 对已有图表发出修改指令，图表在原位更新，不影响画布上的其他元素。

**Acceptance Scenarios**:

1. **Given** 画布上已有一个柱状图，**When** 用户输入"换成饼图"，**Then** 柱状图被替换为饼图，数据保持不变。
2. **Given** 画布上有图表和批注，**When** 用户输入"把标题改成Q1销售报告"，**Then** 仅标题更新，其他元素不变。

---

### User Story 4 - CSV 数据上传 (Priority: P4)

用户可以上传 CSV 文件，AI 自动解析数据并推荐合适的图表类型，生成可视化。

**Why this priority**: 真实数据输入是产品从"玩具"到"工具"的关键跨越。

**Independent Test**: 拖入一个 CSV 文件，AI 自动分析并生成图表 + 批注。

**Acceptance Scenarios**:

1. **Given** 用户拖入一个包含日期和数值列的 CSV 文件，**When** AI 解析完成，**Then** AI 推荐图表类型并自动生成可视化，对话面板显示数据摘要。
2. **Given** CSV 文件包含多列数据，**When** AI 解析后，**Then** 用户可以通过对话指定"用第2列做X轴，第4列做Y轴"。

---

### Edge Cases

- 用户输入与数据可视化无关的内容时，AI 应礼貌引导回数据叙事场景
- CSV 文件格式异常（编码错误、缺失值）时，AI 应给出明确的错误提示和修复建议
- 画布上已有多个图表时，用户修改指令应能明确指向目标图表（通过上下文或点击选中）
- AI 生成的 ECharts option 格式错误时，前端应优雅降级显示错误信息而非白屏

## Requirements

### Functional Requirements

- **FR-001**: 系统 MUST 提供左右分栏布局——左侧对话面板，右侧 Excalidraw 画布
- **FR-002**: 系统 MUST 将用户自然语言输入发送给 LLM，获取结构化 JSON 响应（ECharts option + Excalidraw elements）
- **FR-003**: 系统 MUST 在画布上渲染 ECharts 图表实例，支持基本交互（tooltip、hover）
- **FR-004**: 系统 MUST 在画布上渲染 Excalidraw 手绘元素（箭头、文字、圆圈）
- **FR-005**: 系统 MUST 支持对话历史上下文，AI 能理解"把它换成饼图"中的"它"指代什么
- **FR-006**: 系统 MUST 支持 AI 流式响应，对话面板实时显示生成进度
- **FR-007**: 系统 MUST 支持 CSV 文件拖拽上传和解析
- **FR-008**: 系统 MUST 维护画布状态为 JSON 文档，支持 AI 增量修改

### Key Entities

- **Canvas State**: 画布当前所有元素的 JSON 表示（ECharts 实例列表 + Excalidraw 元素列表）
- **Chat Message**: 对话消息（role: user/assistant, content, 关联的 canvas diff）
- **Chart Instance**: 单个 ECharts 图表的配置（id, position, size, echarts option）
- **Annotation**: 单个 Excalidraw 批注元素（id, type, bindTo chartId, excalidraw elements）

## Success Criteria

### Measurable Outcomes

- **SC-001**: 用户输入一句自然语言描述后，3 秒内画布上开始渲染图表
- **SC-002**: 支持至少 5 种基础图表类型（折线、柱状、饼图、散点、面积图）
- **SC-003**: AI 生成的手绘批注至少包含 1 个数据洞察（极值/趋势/异常标注）
- **SC-004**: 对话迭代修改成功率 > 80%（用户发出修改指令后图表正确更新）
- **SC-005**: CSV 文件（< 10MB）上传后 2 秒内完成解析并展示数据摘要

## Assumptions

- MVP 阶段使用 OpenAI GPT-4o 或兼容 API 作为 LLM 后端
- 用户有现代浏览器（Chrome/Edge/Firefox 最新版）
- MVP 不需要用户认证/登录
- MVP 不需要数据持久化（刷新页面后画布状态可丢失）
- Excalidraw 和 ECharts 的集成采用 overlay 方案（ECharts 渲染在 Excalidraw 画布上方的独立 div 中）
