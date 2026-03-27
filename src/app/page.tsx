"use client";

import { useState } from "react";
import ChatPanel from "@/components/ChatPanel";
import Canvas from "@/components/Canvas";
import { useI18n } from "@/stores/i18n-store";

export default function Home() {
  const [chatOpen, setChatOpen] = useState(true);
  const t = useI18n((s) => s.t);

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-gray-950">
      {/* 画布区域 — 始终占满剩余空间 */}
      <div className="relative flex-1 min-w-0">
        {/* 展开对话按钮 */}
        {!chatOpen && (
          <button
            onClick={() => setChatOpen(true)}
            className="absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-xl bg-white/90 px-3 py-2 text-sm text-gray-600 shadow-md backdrop-blur-sm border border-gray-200 hover:bg-white hover:shadow-lg transition-all dark:bg-gray-900/90 dark:border-gray-700 dark:text-gray-300"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {t.aiChat}
          </button>
        )}

        <Canvas />
      </div>

      {/* 对话面板 — 可收起，右侧 */}
      <div
        className={`shrink-0 transition-all duration-300 ease-in-out ${
          chatOpen ? "w-[360px]" : "w-0"
        } overflow-hidden`}
      >
        <div className="h-full w-[360px]">
          <ChatPanel onClose={() => setChatOpen(false)} />
        </div>
      </div>
    </div>
  );
}
