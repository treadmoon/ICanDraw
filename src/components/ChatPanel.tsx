"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChatStore } from "@/stores/chat-store";
import { useCanvasStore } from "@/stores/canvas-store";
import ChatMessageBubble from "./ChatMessage";
import CsvUpload from "./CsvUpload";
import { generateId } from "@/lib/canvas-utils";
import type { AIResponse } from "@/types";

function isValidAIResponse(data: unknown): data is AIResponse {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return Array.isArray(d.charts) && Array.isArray(d.annotations) && typeof d.summary === "string";
}

const SUGGESTIONS = [
  "画一个2024年Q1-Q4的销售趋势折线图",
  "用饼图展示市场份额分布",
  "对比五个城市的人口柱状图",
];

export default function ChatPanel({ onClose }: { onClose?: () => void }) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { messages, isLoading, addMessage, setLoading } = useChatStore();
  const applyAIResponse = useCanvasStore((s) => s.applyAIResponse);

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
        const { charts, annotations } = useCanvasStore.getState();
        const context = useChatStore.getState().buildContext({ charts, annotations });
        context.push({ role: "user", content: text.trim() });

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: context }),
          signal: controller.signal,
        });

        const data = await res.json();

        if (!res.ok) {
          addMessage({ id: generateId(), role: "assistant", content: `⚠️ ${data.error ?? `服务异常 (${res.status})`}`, canvasDiff: null });
          return;
        }

        if (!isValidAIResponse(data)) {
          addMessage({ id: generateId(), role: "assistant", content: "⚠️ AI 返回了无法解析的数据，请重试", canvasDiff: null });
          return;
        }

        applyAIResponse(data.charts, data.annotations);
        addMessage({ id: generateId(), role: "assistant", content: data.summary, canvasDiff: data });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const isNetwork = err instanceof TypeError && err.message.includes("fetch");
        addMessage({
          id: generateId(),
          role: "assistant",
          content: isNetwork ? "⚠️ 网络连接失败，请检查网络后重试" : `⚠️ 请求失败：${err instanceof Error ? err.message : "未知错误"}`,
          canvasDiff: null,
        });
      } finally {
        setLoading(false);
      }
    },
    [isLoading, addMessage, setLoading, applyAIResponse]
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
          <h1 className="text-base font-semibold tracking-tight">ICanDraw</h1>
          <p className="text-[11px] text-gray-400">AI 数据叙事画布</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
            title="收起面板"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 19l-7-7 7-7" />
              <path d="M18 19l-7-7 7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="mb-6 text-center">
              <div className="mb-3 text-4xl">🎨</div>
              <p className="text-sm text-gray-500">描述你想要的图表</p>
              <p className="text-sm text-gray-500">AI 帮你生成到画布上</p>
            </div>
            {/* 快捷建议 */}
            <div className="w-full space-y-2">
              <p className="text-[11px] text-gray-400 px-1">试试这些：</p>
              {SUGGESTIONS.map((s) => (
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
              生成中...
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
            placeholder="描述你想要的图表..."
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
