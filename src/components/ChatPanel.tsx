"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChatStore } from "@/stores/chat-store";
import { useCanvasStore } from "@/stores/canvas-store";
import ChatMessageBubble from "./ChatMessage";
import CsvUpload from "./CsvUpload";
import { generateId } from "@/lib/canvas-utils";
import type { AIResponse } from "@/types";

export default function ChatPanel() {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { messages, isLoading, addMessage, setLoading, buildContext } = useChatStore();
  const { charts, annotations, applyAIResponse } = useCanvasStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg = {
        id: generateId(),
        role: "user" as const,
        content: text.trim(),
        canvasDiff: null,
      };
      addMessage(userMsg);
      setInput("");
      setLoading(true);

      try {
        const context = buildContext({ charts, annotations });
        context.push({ role: "user", content: text.trim() });

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: context }),
        });

        const data = await res.json();

        if (!res.ok) {
          const errMsg = data.error ?? `服务异常 (${res.status})`;
          addMessage({
            id: generateId(),
            role: "assistant",
            content: `⚠️ ${errMsg}`,
            canvasDiff: null,
          });
          return;
        }

        const aiData = data as AIResponse;
        applyAIResponse(aiData.charts, aiData.annotations);
        addMessage({
          id: generateId(),
          role: "assistant",
          content: aiData.summary,
          canvasDiff: aiData,
        });
      } catch (err) {
        const isNetwork =
          err instanceof TypeError && err.message.includes("fetch");
        addMessage({
          id: generateId(),
          role: "assistant",
          content: isNetwork
            ? "⚠️ 网络连接失败，请检查网络后重试"
            : `⚠️ 请求失败：${err instanceof Error ? err.message : "未知错误"}`,
          canvasDiff: null,
        });
      } finally {
        setLoading(false);
      }
    },
    [isLoading, addMessage, setLoading, buildContext, charts, annotations, applyAIResponse]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div className="flex h-full flex-col border-r border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h1 className="text-lg font-semibold">ICanDraw</h1>
        <p className="text-xs text-gray-500">AI 数据叙事画布</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-center text-sm text-gray-400">
            <div>
              <p className="mb-2 text-2xl">🎨</p>
              <p>输入描述，AI 帮你生成图表</p>
              <p className="mt-1 text-xs">
                例如：&quot;画一个2024年Q1-Q4的销售趋势折线图&quot;
              </p>
            </div>
          </div>
        )}
        {messages.map((m) => (
          <ChatMessageBubble key={m.id} message={m} />
        ))}
        {isLoading && (
          <div className="flex justify-start mb-3">
            <div className="flex items-center gap-2 rounded-2xl bg-gray-100 px-4 py-2.5 text-sm text-gray-500 dark:bg-gray-800">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
              AI 正在生成图表...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* CSV Upload */}
      <CsvUpload onDataReady={(text) => send(text)} />

      {/* Input */}
      <div className="border-t border-gray-200 p-3 dark:border-gray-700">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="描述你想要的图表..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800"
            disabled={isLoading}
          />
          <button
            onClick={() => send(input)}
            disabled={isLoading || !input.trim()}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
