"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChatStore } from "@/stores/chat-store";
import { useCanvasStore } from "@/stores/canvas-store";
import ChatMessageBubble from "./ChatMessage";
import CsvUpload from "./CsvUpload";
import { generateId } from "@/lib/canvas-utils";
import { useI18n } from "@/stores/i18n-store";
import type { AIResponse, ChartData, Annotation, Drawing } from "@/types";

const ECHART_PROTOCOL = "echart://";

function normalizeChart(raw: Record<string, unknown>, index: number): ChartData {
  if (raw.option && typeof raw.option === "object") {
    return {
      id: (raw.id as string) ?? `chart-${index}`,
      x: (raw.x as number) ?? 100 + index * 550,
      y: (raw.y as number) ?? 100,
      width: (raw.width as number) ?? 500,
      height: (raw.height as number) ?? 350,
      option: raw.option as ChartData["option"],
    };
  }
  const data = raw.data as Array<Record<string, unknown>> | undefined;
  const xData = data?.map((d) => String(d.x ?? d.name ?? d.label ?? "")) ?? [];
  const yData = data?.map((d) => Number(d.y ?? d.value ?? 0)) ?? [];
  const chartType = String(raw.type ?? "bar");

  const option: Record<string, unknown> = {
    title: { text: String(raw.title ?? "") },
    tooltip: { trigger: chartType === "pie" ? "item" : "axis" },
    legend: {},
  };

  if (chartType === "pie") {
    option.series = [{ type: "pie", data: data?.map((d) => ({ name: String(d.x ?? d.name ?? ""), value: Number(d.y ?? d.value ?? 0) })) ?? [] }];
  } else {
    option.xAxis = { type: "category", data: xData, name: String(raw.xAxisName ?? "") };
    option.yAxis = { type: "value", name: String(raw.yAxisName ?? "") };
    option.series = [{ type: chartType, data: yData }];
  }

  return {
    id: (raw.id as string) ?? `chart-${index}`,
    x: (raw.x as number) ?? 100 + index * 550,
    y: (raw.y as number) ?? 100,
    width: (raw.width as number) ?? 500,
    height: (raw.height as number) ?? 350,
    option,
  };
}

function normalizeAnnotation(raw: Record<string, unknown>, index: number): Annotation {
  if (Array.isArray(raw.elements) && raw.elements.length > 0) {
    return { id: (raw.id as string) ?? `ann-${index}`, bindTo: raw.bindTo as string | undefined, elements: raw.elements };
  }
  const text = String(raw.text ?? "");
  const pos = (raw.position as Record<string, unknown>) ?? {};
  return {
    id: (raw.id as string) ?? `ann-${index}`,
    bindTo: raw.bindTo as string | undefined,
    elements: text ? [{ type: "text" as const, x: Number(pos.x ?? 0) + 100, y: Number(pos.y ?? 0) - 30, text }] : [],
  };
}

function normalizeResponse(data: Record<string, unknown>): AIResponse | null {
  // Accept response if it has charts OR drawings
  if (!Array.isArray(data.charts) && !Array.isArray(data.drawings)) return null;
  const summary = typeof data.summary === "string" ? data.summary : useI18n.getState().t.generated;
  const charts = Array.isArray(data.charts) ? (data.charts as Record<string, unknown>[]).map(normalizeChart) : [];
  const rawDrawings = Array.isArray(data.drawings) ? (data.drawings as Record<string, unknown>[]) : [];
  const drawings: Drawing[] = rawDrawings.map((d, i) => ({
    id: (d.id as string) ?? `drawing-${i}`,
    elements: Array.isArray(d.elements) ? d.elements : [],
  }));
  const rawAnns = Array.isArray(data.annotations) ? (data.annotations as Record<string, unknown>[]) : [];
  const annotations = rawAnns.map(normalizeAnnotation);
  return { charts, drawings, annotations, summary };
}

/** Insert elements into Excalidraw and store data */
function applyToCanvas(response: AIResponse) {
  const store = useCanvasStore.getState();
  const api = store.excalidrawAPI;

  // Store chart options
  for (const chart of response.charts) {
    store.setChartOption(chart.id, chart.option);
  }

  // Store drawings (rendered via Canvas sync effect)
  if (response.drawings.length > 0) {
    store.addDrawings(response.drawings);
  }

  // Store annotations
  if (response.annotations.length > 0) {
    store.setAnnotations([...store.annotations, ...response.annotations]);
  }

  // Insert ECharts embeddable elements
  if (api && response.charts.length > 0) {
    const existing = api.getSceneElements();
    const newElements = response.charts.map((chart: ChartData) => ({
      type: "embeddable" as const,
      id: `echart-${chart.id}`,
      x: chart.x,
      y: chart.y,
      width: chart.width,
      height: chart.height,
      link: `${ECHART_PROTOCOL}${chart.id}`,
      strokeColor: "#e0e0e0",
      backgroundColor: "transparent",
      fillStyle: "solid" as const,
      strokeWidth: 1,
      strokeStyle: "solid" as const,
      roughness: 0,
      opacity: 100,
      angle: 0,
      seed: Math.floor(Math.random() * 100000),
      version: 1,
      versionNonce: Math.floor(Math.random() * 1000000),
      isDeleted: false,
      boundElements: null,
      locked: false,
      roundness: { type: 3 },
      index: `b${Date.now()}`,
      frameId: null,
      groupIds: [],
    }));

    api.updateScene({ elements: [...existing, ...newElements] });
  }
}

export default function ChatPanel({ onClose }: { onClose?: () => void }) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { messages, isLoading, addMessage, setLoading } = useChatStore();
  const { t, locale, setLocale } = useI18n();
  const suggestions = [t.suggestion1, t.suggestion2, t.suggestion3];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      addMessage({ id: generateId(), role: "user", content: text.trim(), canvasDiff: null });
      setInput("");
      setLoading(true);

      try {
        const { chartOptions, annotations } = useCanvasStore.getState();
        const chartSummary = Object.keys(chartOptions).length > 0
          ? Object.keys(chartOptions).map((id) => `Chart "${id}"`).join("; ")
          : "";
        const canvasContext = chartSummary
          ? `[画布上下文] 当前画布有 ${Object.keys(chartOptions).length} 个图表：${chartSummary}。${annotations.length} 个批注。请基于此上下文处理我的下一条指令。`
          : "";

        const context: Array<{ role: string; content: string }> = [];
        for (const m of useChatStore.getState().messages) {
          context.push({ role: m.role, content: m.content });
        }
        if (canvasContext) context.push({ role: "user", content: canvasContext });
        context.push({ role: "user", content: text.trim() });

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: context }),
          signal: controller.signal,
        });

        const data = await res.json();

        if (!res.ok) {
          addMessage({ id: generateId(), role: "assistant", content: `⚠️ ${data.error ?? `${t.serviceError} (${res.status})`}`, canvasDiff: null });
          return;
        }

        const normalized = normalizeResponse(data);
        if (!normalized) {
          addMessage({ id: generateId(), role: "assistant", content: `⚠️ ${t.parseError}`, canvasDiff: null });
          return;
        }

        applyToCanvas(normalized);
        addMessage({ id: generateId(), role: "assistant", content: normalized.summary, canvasDiff: normalized });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const isNetwork = err instanceof TypeError && err.message.includes("fetch");
        addMessage({
          id: generateId(),
          role: "assistant",
          content: isNetwork ? `⚠️ ${t.networkError}` : `⚠️ ${t.requestFail}：${err instanceof Error ? err.message : ""}`,
          canvasDiff: null,
        });
      } finally {
        setLoading(false);
      }
    },
    [isLoading, addMessage, setLoading]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <div>
          <h1 className="text-base font-semibold tracking-tight">{t.appTitle}</h1>
          <p className="text-[11px] text-gray-400">{t.appSubtitle}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
            className="rounded-lg px-2 py-1 text-[11px] text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            {locale === "zh" ? "EN" : "中文"}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
              title={t.collapsePanel}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 19l-7-7 7-7" />
                <path d="M18 19l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="mb-6 text-center">
              <div className="mb-3 text-4xl">🎨</div>
              <p className="text-sm text-gray-500">{t.describeChart}</p>
              <p className="text-sm text-gray-500">{t.aiHelp}</p>
            </div>
            {/* 快捷建议 */}
            <div className="w-full space-y-2">
              <p className="text-[11px] text-gray-400 px-1">{t.trySuggestions}</p>
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={isLoading}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-left text-[13px] text-gray-600 hover:border-blue-300 hover:bg-blue-50 transition-colors dark:border-gray-700 dark:text-gray-400 dark:hover:border-blue-800 dark:hover:bg-blue-950 disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <ChatMessageBubble key={m.id} message={m} />
        ))}
        {isLoading && (
          <div className="flex justify-start mb-3">
            <div className="flex items-center gap-2 rounded-2xl bg-gray-50 px-4 py-2.5 text-sm text-gray-500 dark:bg-gray-800">
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:300ms]" />
              </span>
              {t.generating}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* CSV Upload */}
      <CsvUpload onDataReady={(text) => send(text)} />

      {/* Input */}
      <div className="border-t border-gray-100 p-3 dark:border-gray-800">
        <div className="flex items-end gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 focus-within:border-blue-400 focus-within:bg-white transition-colors dark:border-gray-700 dark:bg-gray-900 dark:focus-within:border-blue-600">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.inputPlaceholder}
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-gray-400"
            disabled={isLoading}
          />
          <button
            onClick={() => send(input)}
            disabled={isLoading || !input.trim()}
            className="shrink-0 rounded-xl bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:opacity-30 transition-opacity"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
