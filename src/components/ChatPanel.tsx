"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChatStore } from "@/stores/chat-store";
import { useCanvasStore } from "@/stores/canvas-store";
import { useProjectStore } from "@/stores/project-store";
import ChatMessageBubble from "./ChatMessage";
import CsvUpload from "./CsvUpload";
import { generateId } from "@/lib/canvas-utils";
import { useI18n } from "@/stores/i18n-store";
import type { AIResponse, ChartData, Annotation, Drawing, ProjectAnalysis } from "@/types";
import { validateAndFixAll, type OnProgress } from "@/lib/ai/layout-validator";
import { useTaskStore, pipelineRunner } from "@/stores/task-engine";
import { createChatTasks, assembleResponse } from "@/lib/ai/chat-pipeline";
import TaskProgress from "./TaskProgress";

const ECHART_PROTOCOL = "echart://";

// Detect GitHub URL patterns
const GITHUB_URL_REGEX = /(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9]))*\/[a-zA-Z0-9._-]+\/?(?:\.git)?$/;

function isGitHubUrl(text: string): boolean {
  return GITHUB_URL_REGEX.test(text.trim());
}

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

async function normalizeResponse(data: Record<string, unknown>, onProgress?: OnProgress): Promise<AIResponse | null> {
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

  // Auto-fix layout: validate → detect collisions → fix → recalc arrows
  const fixedDrawings = await validateAndFixAll(drawings, onProgress);
  const fixedAnnotations = (await validateAndFixAll(
    annotations.map((a) => ({ id: a.id, elements: a.elements }))
  )).map((fixed, i) => ({ ...annotations[i], elements: fixed.elements }));

  return { charts, drawings: fixedDrawings, annotations: fixedAnnotations, summary };
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

/** Apply drawings from SSE streaming */
function applyDrawingsFromSSE(
  drawings: Array<{ id: string; elements: Array<Record<string, unknown>> }>
) {
  const store = useCanvasStore.getState();

  // Note: convertToExcalidrawElements already applies offsets based on diagram index:
  // - Diagram 0: offset (0, 0)
  // - Diagram 1: offset (800, 0)
  // - Diagram 2: offset (0, 500)
  // - Diagram 3: offset (800, 500)
  // So we just pass through the elements directly without additional offset.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  store.addDrawings(drawings as any);
}

export default function ChatPanel({ onClose }: { onClose?: () => void }) {
  const [input, setInput] = useState("");
  const [fixProgress, setFixProgress] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { messages, isLoading, addMessage, setLoading } = useChatStore();
  const { t, locale, setLocale } = useI18n();
  const suggestions = [t.suggestion1, t.suggestion2, t.suggestion3, t.suggestion4];

  // Subscribe to project store for progress updates
  const projectStatus = useProjectStore((s) => s.status);
  const projectProgress = useProjectStore((s) => s.progress);
  const diagrams = useProjectStore((s) => s.diagrams);

  // Subscribe to task engine
  const taskPipelineStatus = useTaskStore((s) => s.status);
  const taskResults = useTaskStore((s) => s.results);

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

      // Check if this is a GitHub URL - trigger project analysis with SSE
      if (isGitHubUrl(text)) {
        const projectStore = useProjectStore.getState();
        projectStore.reset();
        projectStore.setStatus("analyzing", t.analyzingRepo);

        const repoUrl = text.trim();
        let finalSummary = "";
        let insights: string[] = [];
        let allDrawings: Array<{ id: string; elements: Array<Record<string, unknown>> }> = [];
        let hasStepError = false;
        let hasFatalError = false;
        let receivedDone = false;

        try {
          const res = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ repoUrl }),
            signal: controller.signal,
          });

          if (!res.ok) {
            const data = await res.json();
            projectStore.setError(data.error ?? t.analysisError);
            addMessage({
              id: generateId(),
              role: "assistant",
              content: `⚠️ ${t.analysisError}：${data.error ?? ""}`,
              canvasDiff: null,
            });
            setLoading(false);
            return;
          }

          // Handle SSE stream
          const reader = res.body?.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          if (!reader) {
            throw new Error("无法读取响应流");
          }

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (line.startsWith("event:") || !line.startsWith("data:")) continue;

              const dataMatch = line.match(/^data:\s*(.*)$/);
              if (!dataMatch) continue;

              try {
                const event = JSON.parse(dataMatch[1]);

                switch (event.type) {
                  case "step_start":
                    projectStore.addStep(event.step, event.description);
                    break;

                  case "step_progress":
                    projectStore.updateStepProgress(event.step, event.message);
                    break;

                  case "step_complete":
                    // Step completed
                    break;

                  case "analysis_update":
                    projectStore.completeStep(
                      event.step,
                      event.findings ?? [],
                      event.moduleGraph ?? { nodes: [], edges: [] }
                    );
                    break;

                  case "diagram_start":
                    projectStore.addDiagram({
                      index: event.index,
                      total: event.total,
                      diagramType: event.diagramType,
                      title: event.title,
                      status: "generating",
                    });
                    break;

                  case "diagram_complete":
                    projectStore.completeDiagram(event.index);
                    break;

                  case "diagrams_ready":
                    if (event.drawings) {
                      allDrawings = event.drawings;
                      applyDrawingsFromSSE(event.drawings);
                    }
                    break;

                  case "done":
                    finalSummary = event.summary ?? "";
                    insights = event.insights ?? [];
                    receivedDone = true;
                    projectStore.setDiagramsReady(finalSummary, insights);
                    break;

                  case "error":
                    if (event.step) {
                      hasStepError = true;
                      projectStore.failStep(event.step, event.message);
                    } else {
                      hasFatalError = true;
                      projectStore.setError(event.message);
                    }
                    break;
                }
              } catch {
                // Ignore parse errors for individual events
              }
            }
          }

          // Build final message based on completion state
          if (hasFatalError && allDrawings.length === 0) {
            // Fatal error with no output — already shown via projectStore.setError
          } else if (receivedDone || allDrawings.length > 0) {
            // Completed (possibly partially)
            const insightsText = insights.length > 0 ? `\n\n**发现**:\n${insights.map((i) => `• ${i}`).join("\n")}` : "";
            const warningText = hasStepError ? "\n\n⚠️ 部分分析步骤失败，结果可能不完整。" : "";
            addMessage({
              id: generateId(),
              role: "assistant",
              content: `${finalSummary}${insightsText}\n\n已生成 ${allDrawings.length} 张分析图表到画布上。${warningText}`,
              canvasDiff: null,
            });
          } else if (!receivedDone) {
            // Stream ended without done event — silent interruption
            addMessage({
              id: generateId(),
              role: "assistant",
              content: `⚠️ 分析过程意外中断，未能生成完整结果。请重试。`,
              canvasDiff: null,
            });
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            projectStore.setError("分析已取消");
            return;
          }
          const isNetwork = err instanceof TypeError && err.message.includes("fetch");
          projectStore.setError(isNetwork ? t.networkError : String(err));
          addMessage({
            id: generateId(),
            role: "assistant",
            content: `⚠️ ${t.analysisError}：${isNetwork ? t.networkError : err instanceof Error ? err.message : ""}`,
            canvasDiff: null,
          });
        } finally {
          setLoading(false);
        }
        return;
      }

      try {
        const { chartOptions, annotations } = useCanvasStore.getState();
        const chartSummary = Object.keys(chartOptions).length > 0
          ? Object.keys(chartOptions).map((id) => `Chart "${id}"`).join("; ")
          : "";
        const canvasContext = chartSummary
          ? `[画布上下文] 当前画布有 ${Object.keys(chartOptions).length} 个图表：${chartSummary}。${annotations.length} 个批注。请基于此上下文处理我的下一条指令。`
          : "";

        const history: Array<{ role: string; content: string }> = [];
        for (const m of useChatStore.getState().messages) {
          history.push({ role: m.role, content: m.content });
        }

        // Create task pipeline
        const chatTasks = createChatTasks({
          userMessage: text.trim(),
          history,
          canvasContext,
        });

        // Run pipeline with task engine (handles retries, pause, user intervention)
        await pipelineRunner.run(`chat-${Date.now()}`, chatTasks);

        // Assemble result from completed tasks
        const pipelineResults = useTaskStore.getState().results;
        const pipelineStatus = useTaskStore.getState().status;

        if (pipelineStatus === "done") {
          const normalized = assembleResponse(pipelineResults);
          if (normalized) {
            applyToCanvas(normalized);
            addMessage({ id: generateId(), role: "assistant", content: normalized.summary, canvasDiff: normalized });
          } else {
            addMessage({ id: generateId(), role: "assistant", content: `⚠️ ${t.parseError}`, canvasDiff: null });
          }
        } else if (pipelineStatus === "failed") {
          const failedTask = useTaskStore.getState().tasks.find((t) => t.status === "failed");
          addMessage({
            id: generateId(),
            role: "assistant",
            content: `⚠️ 任务「${failedTask?.name ?? "未知"}」失败：${failedTask?.error ?? "未知错误"}`,
            canvasDiff: null,
          });
        }
        // If paused/waiting_user, don't add message yet — user will resume
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
        setFixProgress("");
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
          <div className="flex flex-col gap-2 justify-start mb-3">
            {/* Task pipeline progress */}
            <TaskProgress />

            {/* Fallback progress message (for GitHub analysis or when no tasks) */}
            {useTaskStore.getState().tasks.length === 0 && (
              <div className="flex items-center gap-2 rounded-2xl bg-gray-50 px-4 py-2.5 text-sm text-gray-500 dark:bg-gray-800">
                <span className="flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:300ms]" />
                </span>
                {fixProgress || projectProgress || t.generating}
              </div>
            )}

            {/* Diagram progress */}
            {diagrams.length > 0 && (
              <div className="flex flex-wrap gap-2 ml-2">
                {diagrams.map((d) => (
                  <div
                    key={d.index}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                      d.status === "done"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : d.status === "generating"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                    }`}
                  >
                    {d.status === "done" ? (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : d.status === "generating" ? (
                      <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-gray-400" />
                    )}
                    <span>{d.title}</span>
                    <span className="text-xs opacity-70">{d.index}/{d.total}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Show task progress when waiting for user decision (pipeline paused) */}
        {!isLoading && taskPipelineStatus === "waiting_user" && <TaskProgress />}
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
