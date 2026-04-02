# 第 6 章：AI 代码实现

> 核心问题：AI 写的代码靠谱吗？出了问题怎么办？

---

## 6.1 前面都是"想"，这一步才是"做"

前五章全部是准备工作：定方向、定底线、定需求、定架构、定任务。到这一步，AI 才真正开始写代码。

Spec-Kit 用 `/speckit.implement` 命令执行实现。AI 按 tasks.md 的顺序，逐个任务生成代码：读任务描述 → 参考 plan.md 架构 → 生成代码 → 标记完成 → 下一个。

## 6.2 AI 生成的 18 个源码文件

最终产出的文件和它们的核心职责：

| 文件 | 行数 | 核心职责 |
|------|------|---------|
| `types/index.ts` | 60 | 7 个类型定义：ChartData, Drawing, Annotation, AIResponse 等 |
| `canvas-store.ts` | 40 | 画布状态：chartOptions 映射、drawings 数组、annotations 数组 |
| `chat-store.ts` | 18 | 对话状态：messages 数组、isLoading 标志 |
| `i18n-store.ts` | 90 | 中英文字典，60+ 个翻译键 |
| `prompts.ts` | 60 | SYSTEM_PROMPT：定义 AI 输出格式、图表规则、图形规则、批注规则 |
| `canvas-utils.ts` | 3 | 一个函数：`generateId()` |
| `route.ts` | 55 | API 端点：校验 → fetch 火山方舟 → 解析 JSON → 返回 |
| `layout.tsx` | 18 | 根布局：字体加载、HTML 结构 |
| `page.tsx` | 40 | 主页面：左画布 + 右对话面板（可收起） |
| `globals.css` | 20 | Tailwind 导入 + Excalidraw 容器修复 |
| `Canvas.tsx` | 200 | 画布核心：Excalidraw 加载、embeddable 渲染、AI 元素同步 |
| `ChatPanel.tsx` | 280 | 对话面板：输入、发送、数据规范化、画布应用 |
| `ChatMessage.tsx` | 20 | 消息气泡：用户/AI/错误三种样式 |
| `EChartEmbeddable.tsx` | 50 | ECharts 嵌入：初始化、更新、ResizeObserver |
| `CsvUpload.tsx` | 60 | CSV 上传：拖拽、Papa Parse 解析、schema 提取 |
| `loading.tsx` | 10 | 页面级 loading spinner |
| `error.tsx` | 20 | 路由级错误边界 |
| `global-error.tsx` | 25 | 全局错误边界（内联样式） |

总计约 1000 行 TypeScript/TSX 代码。

## 6.3 AI 写对了什么

大约 80% 的代码能直接用。AI 做得好的地方：

**1. 类型定义准确**

`types/index.ts` 的 7 个类型定义清晰、完整，后续所有组件都直接使用，没有修改过。AI 擅长从 spec 和 plan 中提取数据模型。

**2. Store 设计简洁**

`canvas-store.ts` 和 `chat-store.ts` 用 Zustand 写得很干净。特别是 `addDrawings` 用 Map 做去重的逻辑：

```typescript
addDrawings: (newDrawings) =>
  set((s) => {
    const map = new Map(s.drawings.map((d) => [d.id, d]));
    for (const d of newDrawings) map.set(d.id, d);
    return { drawings: Array.from(map.values()) };
  }),
```

同 ID 的 drawing 会被新版本覆盖，不同 ID 的会追加。这正是增量更新需要的逻辑。

**3. SYSTEM_PROMPT 结构化**

`prompts.ts` 的提示词写得很有条理：先定义输出格式，再分别说明 charts/drawings/annotations 的规则，最后定义修改规则。AI 写提示词给 AI 看，效果出奇地好。

**4. 错误处理分层**

三层错误边界：`error.tsx`（路由级）→ `global-error.tsx`（全局级，用内联样式因为 CSS 可能也挂了）→ `ChatPanel` 内的网络错误处理。

## 6.4 AI 写错了什么（踩坑记录）

剩下 20% 需要人工修复。这些坑是 AI 编程中最有教学价值的部分：

### 坑 1：Vercel AI SDK 与豆包模型不兼容

**现象**：页面显示 "Invalid JSON response"，API 返回 500。

**原因**：AI 生成的代码用了 Vercel AI SDK 的 `generateObject` 来调用大模型。但豆包是推理模型，返回的 JSON 里多了一个 `reasoning_content` 字段（模型的思考过程），AI SDK 不认识这个字段，直接报错。

**修复**：去掉 AI SDK，改成直接 `fetch` 调用火山方舟 API，自己解析返回数据：

```typescript
const res = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
  body: JSON.stringify({ model: process.env.ARK_MODEL_ID, messages: [...] }),
});
const data = await res.json();
const content = data.choices?.[0]?.message?.content ?? "";
const parsed = JSON.parse(content);
```

**教训**：AI 倾向于使用流行的 SDK，但 SDK 不一定兼容你的具体场景。使用非主流模型时，直接 fetch 更可控。

### 坑 2：图表不能拖动

**现象**：图表显示在画布上，但用户不能拖拽、缩放、旋转。

**原因**：最初 AI 把 ECharts 做成了"浮在画布上方的 div"（ChartOverlay 方案）。这个 div 不是 Excalidraw 画布的一部分，所以 Excalidraw 的交互机制管不到它。

**修复**：发现 Excalidraw 支持 `embeddable` 元素类型，可以在里面渲染自定义内容。改为：

1. 插入 `type: "embeddable"` 元素，`link` 设为 `echart://chartId`
2. Canvas.tsx 的 `validateEmbeddable` 接受 `echart://` 协议
3. `renderEmbeddable` 回调渲染 `<EChartEmbeddable>` 组件

**教训**：AI 不了解库的最新特性。Excalidraw 的 embeddable API 是较新的功能，AI 的训练数据里可能没有。遇到这种情况需要人去查文档。

### 坑 3：流程图箭头对不上

**现象**：AI 画的流程图，箭头经常对不上节点。

**原因**：AI 返回的箭头元素只有 `points` 数组（如 `[[0,0],[0,60]]`），没有 `width` 和 `height`。代码里用了默认值 100×40，但实际箭头路径和这个尺寸不一致，Excalidraw 渲染时就错位了。

**修复**：从 `points` 数组自动计算实际尺寸：

```typescript
if (isLinear && el.points && el.points.length >= 2) {
  const xs = pts.map(p => p[0]);
  const ys = pts.map(p => p[1]);
  w = Math.max(...xs) - Math.min(...xs);
  h = Math.max(...ys) - Math.min(...ys);
}
```

**教训**：AI 返回的数据结构不可信。任何从 AI 拿到的数据，都要做规范化处理。

### 坑 4：AI 返回格式不一致

**现象**：有时 AI 返回标准格式 `{ option: {...} }`，有时返回简化格式 `{ type: "bar", data: [...] }`。

**修复**：在 `ChatPanel.tsx` 里写了 `normalizeChart` 和 `normalizeAnnotation` 函数，兼容多种格式：

```typescript
function normalizeChart(raw, index): ChartData {
  if (raw.option && typeof raw.option === "object") {
    return { /* 标准格式，直接用 */ };
  }
  // 简化格式，手动构建 ECharts option
  const option = { title: {...}, xAxis: {...}, series: [...] };
  return { id, x, y, width, height, option };
}
```

**教训**：不要假设 AI 每次都返回相同格式。即使 SYSTEM_PROMPT 写得很明确，AI 也会"创造性地"返回不同结构。防御性编程是必须的。

## 6.5 代码 Review 的重点

AI 生成的代码 Review 重点不是代码风格（AI 写的风格通常很统一），而是：

| Review 维度 | 检查什么 | 本项目的例子 |
|------------|---------|-------------|
| 对照 spec.md | 是否满足 Given/When/Then 验收标准 | 输入文字后画布是否出现图表？ |
| 对照 constitution.md | 是否违反原则 | 有没有把用户 CSV 数据发到服务器？ |
| 对照 plan.md | 实现方式是否和设计一致 | 是否用了 embeddable 而非 overlay？ |
| 边界情况 | 是否处理了异常输入 | AI 返回非 JSON 时是否优雅降级？ |
| 依赖兼容性 | 用的 API 是否真实存在 | Excalidraw 0.18 是否支持 embeddable？ |

## 6.6 教学要点

1. **AI 写的代码约 80% 能直接用**，但剩下 20% 可能藏着很深的坑。
2. **AI 擅长**：类型定义、状态管理、CRUD 逻辑、提示词编写、错误边界。
3. **AI 不擅长**：第三方库的兼容性判断、最新 API 的使用、数据格式的防御性处理。
4. **每一段 AI 生成的代码都要 Review**。"看起来很专业"不等于"没有问题"。
5. **踩坑记录要写进文档**。同样的坑不踩两次，这是团队知识积累的核心。

## 6.7 动手练习

拿你的第一个任务（第 5 章练习中拆出的），让 AI 生成代码。然后：

1. 对照你的 spec 验收：Given/When/Then 是否满足？
2. 对照你的宪法检查：有没有违反原则？
3. 找出至少一个 AI 可能犯错的地方（边界情况、依赖兼容性等）

---

> 下一章：[第 7 章 — 迭代与文档维护](./07-iterate.md)
