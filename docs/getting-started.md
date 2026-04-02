# ICanDraw 新手上手指南

> 目标：让你在 15 分钟内把项目跑起来，理解代码结构，能开始改东西。

---

## 一、环境准备

### 前置要求

- Node.js >= 18
- pnpm（`npm install -g pnpm`）
- 火山方舟 API Key（见下方申请方式）

### 申请火山方舟 API Key

1. 注册 [火山方舟](https://www.volcengine.com/product/ark)
2. 进入控制台 → 模型推理 → 创建推理接入点
3. 选择模型：推荐 `doubao-1-5-pro-256k-250115`（豆包推理模型）
4. 创建后获得两个值：
   - API Key：形如 `783f3553-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - 接入点 ID：形如 `ep-20260326122118-nhx6n`

### 启动项目

```bash
# 1. 安装依赖
pnpm install

# 2. 配置环境变量
cp .env.example .env.local
```

编辑 `.env.local`，填入你的值：

```bash
# 火山方舟 API Key
ARK_API_KEY=你的API Key
# 火山方舟模型 ID（接入点 ID 或模型名称）
ARK_MODEL_ID=你的接入点ID
```

```bash
# 3. 启动开发服务器
pnpm dev
```

打开 http://localhost:3000，在右侧对话框输入"画一个柱状图"，如果画布上出现图表，说明一切正常。

### 可用的 npm 脚本

| 命令 | 作用 |
|------|------|
| `pnpm dev` | 启动开发服务器（默认 3000 端口，绑定 0.0.0.0） |
| `pnpm build` | 生产构建 |
| `pnpm start` | 启动生产服务器 |
| `pnpm lint` | ESLint 检查 |

---

## 二、技术栈

| 技术 | 版本 | 用途 | 为什么选它 |
|------|------|------|-----------|
| Next.js | 16 | App Router 前端框架 | 文件系统路由 + API Routes，前后端一体 |
| React | 19 | UI 库 | Next.js 默认 |
| TypeScript | 5 | 类型安全 | strict 模式，所有文件都有类型 |
| Excalidraw | 0.18 | 手绘风格画布 | 支持拖拽/缩放/旋转/embeddable 自定义元素 |
| ECharts | 6 | 数据图表渲染 | 图表类型丰富，配置式 API 适合 AI 生成 |
| Zustand | 5 | 状态管理 | 轻量，无 Provider，直接 hook 调用 |
| Tailwind CSS | 4 | 样式 | 原子化 CSS，不需要写 CSS 文件 |
| Papa Parse | 5 | CSV 解析 | 浏览器端解析，不需要服务端 |
| 火山方舟 API | - | LLM 后端 | 豆包模型，直接 fetch 调用 |

注意：项目**没有**使用 Vercel AI SDK（`ai` 和 `@ai-sdk/openai` 在 package.json 里但实际未使用）。原因是豆包推理模型返回的 `reasoning_content` 字段与 ai-sdk 不兼容，所以改为直接 `fetch` 调用火山方舟 API。

---

## 三、项目结构

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # 根布局：字体加载、HTML 结构
│   ├── page.tsx                  # 主页面：左画布 + 右对话面板
│   ├── globals.css               # 全局样式：Tailwind + Excalidraw 修复
│   ├── loading.tsx               # 页面级加载状态
│   ├── error.tsx                 # 路由级错误边界
│   ├── global-error.tsx          # 全局错误边界（连 layout 崩了也能兜住）
│   └── api/
│       └── chat/
│           └── route.ts          # AI 对话 API 端点
│
├── components/
│   ├── Canvas.tsx                # 画布核心组件
│   ├── ChatPanel.tsx             # 对话面板（最复杂的组件）
│   ├── ChatMessage.tsx           # 单条消息气泡
│   ├── EChartEmbeddable.tsx      # ECharts 嵌入渲染器
│   └── CsvUpload.tsx             # CSV 拖拽上传
│
├── stores/
│   ├── canvas-store.ts           # 画布状态
│   ├── chat-store.ts             # 对话状态
│   └── i18n-store.ts             # 国际化
│
├── lib/
│   ├── ai/
│   │   └── prompts.ts            # AI 系统提示词
│   └── canvas-utils.ts           # 工具函数
│
└── types/
    └── index.ts                  # 共享类型定义
```

---

## 四、核心数据流（从用户输入到画布渲染）

这是理解整个项目最重要的部分。一次完整的交互流程如下：

```
用户在 ChatPanel 输入 "画一个销售趋势折线图"
  │
  ▼
ChatPanel.send() 构建消息上下文
  │  - 收集历史对话消息
  │  - 如果画布上已有图表，附加画布上下文描述
  │  - 发送 POST /api/chat
  │
  ▼
route.ts 处理请求
  │  - 校验 API Key 和消息
  │  - 拼接 SYSTEM_PROMPT（定义 AI 输出格式）
  │  - fetch 火山方舟 API
  │  - 解析返回的 JSON（处理可能的 markdown 代码块包裹）
  │  - 返回解析后的 JSON
  │
  ▼
ChatPanel 收到响应
  │  - normalizeResponse() 规范化数据
  │    ├── normalizeChart(): 兼容两种图表格式（完整 option / 简化 data 数组）
  │    ├── normalizeAnnotation(): 兼容两种批注格式（elements 数组 / 简化 text+position）
  │    └── drawings: 直接透传
  │  - applyToCanvas() 写入画布
  │
  ▼
applyToCanvas() 分三路处理
  │
  ├── 图表 (charts)
  │   ├── canvas-store.setChartOption(id, option)  → 存储 ECharts 配置
  │   └── excalidrawAPI.updateScene()              → 插入 embeddable 元素（link="echart://chartId"）
  │
  ├── 图形 (drawings)
  │   └── canvas-store.addDrawings()               → 存储到 store
  │       └── Canvas.tsx useEffect 监听 → toExcalidrawElements() → excalidrawAPI.updateScene()
  │
  └── 批注 (annotations)
      └── canvas-store.setAnnotations()            → 存储到 store
          └── Canvas.tsx useEffect 监听 → toExcalidrawElements() → excalidrawAPI.updateScene()
```

### 为什么图表和图形/批注的渲染路径不同？

- **图表**（ECharts）需要在 Excalidraw 的 `embeddable` 元素内渲染一个完整的 ECharts 实例，所以用 `echart://` 协议链接 + `renderEmbeddable` 回调
- **图形和批注**（矩形、箭头、文字等）是 Excalidraw 原生元素，直接转换成 Excalidraw 的元素格式插入场景

---

## 五、每个文件详解

### 5.1 `types/index.ts` — 共享类型定义

所有组件和 store 共用的类型。理解这些类型就理解了数据模型：

| 类型 | 含义 | 关键字段 |
|------|------|---------|
| `ChartData` | 一个 ECharts 图表 | `id`, `x/y/width/height`（画布位置和尺寸）, `option`（完整的 ECharts 配置对象） |
| `Drawing` | 一组 Excalidraw 图形（如一个完整的流程图） | `id`, `elements`（ExcalidrawElementData 数组） |
| `Annotation` | 一组批注标记（如箭头+文字指向图表关键数据） | `id`, `bindTo?`（关联的图表 ID）, `elements` |
| `ExcalidrawElementData` | 单个图形元素 | `type`（arrow/text/ellipse/rectangle/diamond/line）, `x/y`, `text?`, `strokeColor?`, `points?`（箭头/线条的路径） |
| `AIResponse` | AI 一次回复的完整数据 | `charts[]`, `drawings[]`, `annotations[]`, `summary`（文字摘要） |
| `ChatMessage` | 一条对话消息 | `role`（user/assistant）, `content`, `canvasDiff?`（这条消息产生的画布变更） |
| `CsvSchema` | CSV 文件的结构描述 | `columns[]`（列名、类型、统计值）, `rowCount`, `preview`（前 3 行） |

### 5.2 `stores/canvas-store.ts` — 画布状态

用 Zustand 管理画布上的所有数据：

| 状态 | 类型 | 含义 |
|------|------|------|
| `chartOptions` | `Record<string, EChartsOption>` | 图表 ID → ECharts 配置的映射 |
| `drawings` | `Drawing[]` | 所有 AI 生成的图形 |
| `annotations` | `Annotation[]` | 所有批注 |
| `excalidrawAPI` | `any` | Excalidraw 实例引用，用于直接操作画布 |

关键方法：
- `setChartOption(id, option)` — 新增或更新一个图表
- `addDrawings(drawings)` — 新增图形，同 ID 的会被覆盖（用 Map 去重）
- `removeChart(id)` — 删除图表，同时删除绑定的批注
- `clear()` — 清空所有数据

### 5.3 `stores/chat-store.ts` — 对话状态

极简的对话状态管理：

| 状态 | 含义 |
|------|------|
| `messages` | 对话消息数组 |
| `isLoading` | 是否正在等待 AI 回复 |

### 5.4 `stores/i18n-store.ts` — 国际化

内置中英文字典，通过 `useI18n` hook 使用：

```tsx
const t = useI18n((s) => s.t);
// t.appTitle → "ICanDraw"
// t.generating → "生成中..." 或 "Generating..."
```

切换语言：`setLocale("en")` / `setLocale("zh")`

特殊：`csvPrompt` 是一个函数，接收参数生成 CSV 上传后的提示文本。

### 5.5 `app/api/chat/route.ts` — AI 对话 API

Next.js API Route，处理 `/api/chat` POST 请求。

**请求格式**：`{ messages: [{ role: "user"|"assistant", content: "..." }] }`

**处理流程**：
1. 校验 `ARK_API_KEY` 环境变量（未配置返回 503）
2. 校验消息数组（空消息 400，超过 50 条 400）
3. 过滤掉 system 角色的消息
4. 拼接 `SYSTEM_PROMPT` 作为 system 消息，附加 "必须只返回 JSON" 的强调
5. `fetch` 调用 `https://ark.cn-beijing.volces.com/api/v3/chat/completions`
6. 从响应中提取 `choices[0].message.content`
7. 处理可能的 markdown 代码块包裹（` ```json ... ``` `）
8. `JSON.parse` 后返回

**错误处理**：401（Key 无效）、429（限流）、其他状态码、JSON 解析失败

### 5.6 `lib/ai/prompts.ts` — AI 系统提示词

这个文件**决定了 AI 的全部行为**。`SYSTEM_PROMPT` 告诉 AI：

1. **输出格式**：必须返回 `{ charts, drawings, annotations, summary }` 的 JSON
2. **charts vs drawings 的使用场景**：
   - charts → 数据可视化（趋势、对比、分布）
   - drawings → 结构化图形（流程图、组织架构、思维导图）
3. **Chart 格式**：每个 chart 包含完整的 ECharts option，默认位置 x=100,y=100，尺寸 500x350
4. **Drawing 格式**：支持 6 种元素类型（rectangle, diamond, ellipse, text, arrow, line），定义了布局规则、间距、配色方案
5. **流程图专用规则**：开始/结束用 ellipse，步骤用 rectangle，判断用 diamond，配色方案
6. **思维导图专用规则**：中心主题用大矩形，分支向外辐射
7. **批注规则**：至少一个批注指向关键数据，用颜色区分（红色警告、绿色正面、蓝色中性）
8. **修改规则**：保持相同 ID 原位更新，只改用户要求的部分

### 5.7 `components/ChatPanel.tsx` — 对话面板（最复杂的组件）

这是整个应用的"大脑"，负责：

**数据规范化**（处理 AI 返回格式不一致的问题）：

`normalizeChart()` 兼容两种格式：
- 标准格式：`{ id, x, y, width, height, option: { 完整ECharts配置 } }`
- 简化格式：`{ type: "bar", data: [{x, y}], title, xAxisName, yAxisName }` → 自动转换为完整 option

`normalizeAnnotation()` 兼容两种格式：
- 标准格式：`{ id, elements: [...] }`
- 简化格式：`{ text, position: {x, y} }` → 自动转换为 text 元素

`normalizeResponse()` 整体校验：必须有 charts 或 drawings 数组，否则返回 null（触发错误提示）

**画布上下文构建**（支持对话修改已有图表）：

当画布上已有图表时，`send()` 会在消息列表中插入一条画布上下文：
```
[画布上下文] 当前画布有 2 个图表：Chart "chart-0"; Chart "chart-1"。1 个批注。请基于此上下文处理我的下一条指令。
```
这样 AI 就知道画布上有什么，可以做增量修改。

**UI 结构**：
- 顶部：标题 + 语言切换按钮 + 收起按钮
- 中间：消息列表（空状态显示 3 个快捷建议）
- 底部：CSV 上传区 + 输入框

**交互细节**：
- Enter 发送，Shift+Enter 换行
- 发送时自动 abort 上一个未完成的请求
- 加载中显示三个跳动的蓝色圆点
- 错误消息用琥珀色背景区分

### 5.8 `components/Canvas.tsx` — 画布核心组件

**职责**：加载 Excalidraw、同步 AI 生成的图形/批注到画布。

**Excalidraw 加载**：动态 import（`import("@excalidraw/excalidraw")`），因为 Excalidraw 不支持 SSR。加载中显示 spinner，失败显示错误+刷新按钮。

**ECharts 嵌入机制**：
- `validateEmbeddable`：告诉 Excalidraw 接受 `echart://` 协议的链接
- `renderEmbeddable`：当 Excalidraw 渲染 embeddable 元素时，解析 `echart://chartId`，返回 `<EChartEmbeddable chartId={chartId} />`

**AI 元素同步**（`useEffect` 监听 drawings + annotations）：
1. 获取当前场景中的所有元素
2. 过滤出用户手动创建的元素（ID 不以 `ai-el-` 开头的）
3. 将 drawings 和 annotations 通过 `toExcalidrawElements()` 转换为 Excalidraw 格式
4. 合并后更新场景：`[用户元素, AI图形元素, AI批注元素]`

**`toExcalidrawElements()` 转换逻辑**：
- 为每个元素生成 Excalidraw 需要的完整属性（seed, version, roundness 等）
- 箭头/线条：从 `points` 数组自动计算 width/height（修复 AI 返回数据不含尺寸的问题）
- 带文字的形状（如流程图节点）：自动生成居中的 text 元素叠加在形状上，根据中英文字符宽度计算位置

### 5.9 `components/EChartEmbeddable.tsx` — ECharts 嵌入渲染器

在 Excalidraw 的 embeddable 元素内渲染 ECharts 图表实例。

- 从 `canvas-store` 读取 `chartOptions[chartId]`
- 用 `echarts.init()` 初始化，`setOption()` 渲染
- `ResizeObserver` 监听容器尺寸变化，自动 `resize()`（用户在 Excalidraw 中缩放元素时触发）
- 组件卸载时 `dispose()` 释放资源

### 5.10 `components/CsvUpload.tsx` — CSV 上传

拖拽区域，支持拖入 CSV 文件：

1. 校验文件大小（上限 10MB）
2. Papa Parse 在浏览器端解析（不发送原始数据到服务器）
3. `analyzeCsv()` 分析每列的类型和统计值：
   - 超过 50% 的值能转为数字 → `number` 类型，计算 min/max/mean
   - 否则 → `string` 类型
4. 生成提示文本（包含行数、列信息、前 3 行预览），调用 `onDataReady` 发送给 AI

### 5.11 其他文件

| 文件 | 说明 |
|------|------|
| `components/ChatMessage.tsx` | 消息气泡，用户消息蓝色靠右，AI 消息灰色靠左，错误消息琥珀色 |
| `app/layout.tsx` | 根布局，加载 Geist 字体，设置页面标题 |
| `app/globals.css` | Tailwind 导入 + Excalidraw 容器撑满修复 + 隐藏欢迎屏 |
| `app/loading.tsx` | 页面级 loading spinner |
| `app/error.tsx` | 路由级错误边界，显示重试按钮 |
| `app/global-error.tsx` | 全局错误边界（内联样式，因为此时 CSS 可能也挂了） |
| `lib/canvas-utils.ts` | 只有一个函数 `generateId()`，用 `crypto.randomUUID()` |


---

## 六、关键设计决策和踩坑记录

新手必须知道这些，否则会踩同样的坑：

### 6.1 为什么不用 Vercel AI SDK？

项目 `package.json` 里有 `ai` 和 `@ai-sdk/openai`，但 `route.ts` 里没有用它们，而是直接 `fetch`。

原因：豆包是推理模型，返回的 JSON 里有一个 `reasoning_content` 字段（模型的思考过程）。Vercel AI SDK 不认识这个字段，会报 `Invalid JSON response` 错误。

教训：使用非 OpenAI 兼容模型时，不要依赖第三方 SDK 的解析逻辑，直接 fetch 更可控。

### 6.2 ECharts 为什么用 Excalidraw embeddable 而不是 overlay？

最初的方案是把 ECharts 图表做成绝对定位的 div 浮在 Excalidraw 上方（overlay）。问题是：用户不能拖动、缩放、旋转图表，因为它不是画布的一部分。

现在的方案：利用 Excalidraw 的 `embeddable` 元素类型，在里面渲染 ECharts。这样拖拽/缩放/旋转全部由 Excalidraw 原生处理。

实现方式：
- 插入一个 `type: "embeddable"` 的元素，`link` 设为 `echart://chartId`
- Canvas.tsx 的 `validateEmbeddable` 接受 `echart://` 协议
- Canvas.tsx 的 `renderEmbeddable` 根据 chartId 渲染 `<EChartEmbeddable>`

### 6.3 箭头的 width/height 必须从 points 计算

AI 返回的箭头元素只有 `points` 数组（如 `[[0,0],[0,60]]`），没有 `width` 和 `height`。如果用默认值（100x40），Excalidraw 渲染时箭头会错位。

修复：`toExcalidrawElements()` 里对 arrow/line 类型，从 points 数组计算实际的 width 和 height：
```ts
const xs = pts.map(p => p[0]);
const ys = pts.map(p => p[1]);
w = Math.max(...xs) - Math.min(...xs);
h = Math.max(...ys) - Math.min(...ys);
```

### 6.4 AI 返回的数据格式不可信

AI 不一定严格按照 SYSTEM_PROMPT 定义的格式返回。`ChatPanel.tsx` 里的 `normalizeChart` 和 `normalizeAnnotation` 就是为了兼容各种"不标准"的返回格式。

规则：**任何从 AI 拿到的数据，都要做规范化处理后再使用**。新增数据类型时，一定要写对应的 normalize 函数。

### 6.5 Excalidraw 不支持 SSR

Excalidraw 依赖浏览器 API，不能在服务端渲染。Canvas.tsx 用动态 import 加载：
```ts
import("@excalidraw/excalidraw").then((mod) => {
  setExcalidrawComp(() => mod.Excalidraw);
});
```

如果你在其他组件里需要用 Excalidraw 的 API，也必须用动态 import 或确保在 `"use client"` 组件中。

### 6.6 AI 元素和用户元素的区分

Canvas.tsx 用 ID 前缀区分：
- `ai-el-` 开头 → AI 生成的元素（每次 AI 回复时会重新生成）
- 其他 → 用户手动在画布上画的元素（不会被 AI 覆盖）

同步时先过滤出用户元素，再拼接 AI 元素，确保用户手绘的内容不会丢失。

---

## 七、常见开发场景

### 想让 AI 支持新的图表类型

1. 修改 `src/lib/ai/prompts.ts` 的 `SYSTEM_PROMPT`，在 Chart Format 部分添加说明
2. 不需要改其他代码——ECharts 本身支持的图表类型，只要 AI 返回正确的 option 就能渲染

### 想让 AI 支持新的图形类型

1. 修改 `src/types/index.ts` 的 `ExcalidrawElementData.type`，添加新类型
2. 修改 `src/lib/ai/prompts.ts`，在 Drawing Format 部分添加新元素的说明
3. 修改 `src/components/Canvas.tsx` 的 `toExcalidrawElements()`，添加新类型的转换逻辑

### 想修改 UI 布局

主页面布局在 `src/app/page.tsx`：左侧画布（flex-1 占满）+ 右侧对话面板（固定 360px 宽，可收起）。

### 想添加新语言

在 `src/stores/i18n-store.ts` 的 `dict` 对象中添加新的语言键值对，然后在 `Locale` 类型中添加对应的键。

### 想换一个 LLM 模型

1. 修改 `.env.local` 中的 `ARK_MODEL_ID`
2. 如果换的不是火山方舟的模型，需要修改 `src/app/api/chat/route.ts` 中的 API 地址和认证方式
3. 注意：不同模型对 JSON 输出的遵从度不同，可能需要调整 `normalizeResponse` 的兼容逻辑

### 想调试 AI 返回的数据

1. 打开浏览器 DevTools → Network 面板
2. 找到 `/api/chat` 请求
3. 查看 Response：这就是 AI 返回的原始 JSON
4. 对比 `types/index.ts` 中的类型定义，看哪些字段缺失或格式不对
5. 如果需要，在 `ChatPanel.tsx` 的 `normalizeResponse` 中添加兼容逻辑

---

## 八、常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 页面显示"未配置 API Key" | `.env.local` 不存在或 `ARK_API_KEY` 为空 | `cp .env.example .env.local` 并填入真实值 |
| "API Key 无效" | Key 过期或填错了 | 去火山方舟控制台重新获取 |
| "请求过于频繁" | 触发了火山方舟的限流 | 等几秒再试 |
| AI 返回但画布没反应 | AI 返回的 JSON 不含 charts 也不含 drawings | 看 Network 面板的 response，检查 SYSTEM_PROMPT 是否被正确发送 |
| "AI 返回了无法解析的数据" | `normalizeResponse` 返回 null | AI 返回的 JSON 结构不符合预期，需要看原始数据调整 normalize 逻辑 |
| 图表能显示但不能拖动 | Excalidraw 版本不兼容或 embeddable 未正确注册 | 确认 `@excalidraw/excalidraw` 版本为 0.18.x |
| 流程图箭头错位 | AI 返回的箭头坐标有误 | 检查 Canvas.tsx 中 `toExcalidrawElements` 的 points → width/height 计算 |
| 用户手绘的内容消失了 | AI 元素同步时覆盖了用户元素 | 检查 Canvas.tsx 的 useEffect 是否正确过滤了 `ai-el-` 前缀 |
| `pnpm dev` 报端口占用 | 3000 端口被其他进程占用 | `pnpm dev -- --port 3001` |
| Excalidraw 加载失败 | 网络问题或包版本冲突 | 检查 `pnpm install` 是否成功，看控制台报错 |
| 构建报 TypeScript 错误 | 类型不匹配 | `pnpm lint` 查看具体错误 |

---

## 九、决策日志自动记录

项目配置了 Kiro CLI 的 stop hook，每次 AI 回复后自动检测是否包含技术决策，有的话追加到 `docs/decision-log.md`。

相关文件：
- `.kiro/hooks/log-decisions.sh` — hook 脚本
- `.kiro/agents/default.json` — 注册 hook 的 agent 配置

匹配的关键词：改了/换成/删除/新增/重写/修复/因为...所以（中英文均支持）

你不需要手动维护决策日志，但建议定期看一下 `docs/decision-log.md`，了解最近做了哪些技术决策。

---

## 十、进一步阅读

按需查阅，不需要全部读完：

| 文档 | 什么时候看 |
|------|-----------|
| `docs/development-process.md` | 想了解项目从零到一的完整 Spec-Kit 流程（7 个阶段详解） |
| `docs/internal-sharing.md` | 想了解 AI 编程方法论、团队协作实践、长期记忆架构 |
| `specs/001-canvas-mvp/spec.md` | 想了解完整的用户故事和 Given/When/Then 验收标准 |
| `specs/001-canvas-mvp/plan.md` | 想了解技术架构设计的完整推导过程 |
| `specs/001-canvas-mvp/tasks.md` | 想了解 31 个开发任务的拆解和完成状态 |
| `.specify/memory/constitution.md` | 想了解项目的 6 条核心原则（所有设计决策的底线） |
| `docs/decision-log.md` | 查看 AI 对话中自动记录的技术决策历史 |
