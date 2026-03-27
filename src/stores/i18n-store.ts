import { create } from "zustand";

const dict = {
  zh: {
    appTitle: "ICanDraw",
    appSubtitle: "AI 数据叙事画布",
    aiChat: "AI 对话",
    collapsePanel: "收起面板",
    describeChart: "描述你想要的图表或图形",
    aiHelp: "AI 帮你生成到画布上",
    trySuggestions: "试试这些：",
    generating: "生成中...",
    inputPlaceholder: "描述图表、流程图、思维导图...",
    csvDrop: "拖拽 CSV 文件到这里",
    csvRelease: "松开以上传",
    csvTooBig: "CSV 文件过大，请上传 10MB 以内的文件",
    canvasLoading: "画布加载中...",
    canvasLoadFail: "画布加载失败",
    chartNotFound: "图表未找到",
    chartRenderFail: "图表渲染失败",
    refresh: "刷新页面",
    parseError: "AI 返回了无法解析的数据，请重试",
    networkError: "网络连接失败，请检查网络后重试",
    requestFail: "请求失败",
    serviceError: "服务异常",
    generated: "已生成",
    suggestion1: "画一个2024年Q1-Q4的销售趋势折线图",
    suggestion2: "画一个请假审批流程图",
    suggestion3: "对比五个城市的人口柱状图",
    csvPrompt: (rowCount: number, colInfo: string, preview: string) =>
      `我上传了一个 CSV 文件（${rowCount} 行），列信息：${colInfo}。前3行预览：${preview}。请帮我选择合适的图表类型并生成可视化。`,
  },
  en: {
    appTitle: "ICanDraw",
    appSubtitle: "AI Data Storytelling Canvas",
    aiChat: "AI Chat",
    collapsePanel: "Collapse panel",
    describeChart: "Describe a chart or diagram",
    aiHelp: "AI generates it on the canvas",
    trySuggestions: "Try these:",
    generating: "Generating...",
    inputPlaceholder: "Describe a chart, flowchart, mind map...",
    csvDrop: "Drop a CSV file here",
    csvRelease: "Release to upload",
    csvTooBig: "CSV file too large, please upload under 10MB",
    canvasLoading: "Loading canvas...",
    canvasLoadFail: "Canvas failed to load",
    chartNotFound: "Chart not found",
    chartRenderFail: "Chart render failed",
    refresh: "Refresh page",
    parseError: "AI returned unparseable data, please retry",
    networkError: "Network error, please check your connection",
    requestFail: "Request failed",
    serviceError: "Service error",
    generated: "Generated",
    suggestion1: "Draw a Q1-Q4 2024 sales trend line chart",
    suggestion2: "Draw a leave approval flowchart",
    suggestion3: "Compare population across five cities with a bar chart",
    csvPrompt: (rowCount: number, colInfo: string, preview: string) =>
      `I uploaded a CSV file (${rowCount} rows). Columns: ${colInfo}. First 3 rows: ${preview}. Please choose an appropriate chart type and generate a visualization.`,
  },
} as const;

export type Locale = keyof typeof dict;
type Dict = { [K in keyof typeof dict.zh]: (typeof dict.zh)[K] extends (...args: infer A) => string ? (...args: A) => string : string };

interface I18nStore {
  locale: Locale;
  t: Dict;
  setLocale: (l: Locale) => void;
}

export const useI18n = create<I18nStore>((set) => ({
  locale: "zh",
  t: dict.zh as Dict,
  setLocale: (l) => set({ locale: l, t: dict[l] as Dict }),
}));
