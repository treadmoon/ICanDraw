import { create } from "zustand";
import type { ChatMessage, CanvasState } from "@/types";

interface ChatStore {
  messages: ChatMessage[];
  isLoading: boolean;
  addMessage: (msg: ChatMessage) => void;
  setLoading: (v: boolean) => void;
  buildContext: (canvasState: CanvasState) => Array<{ role: string; content: string }>;
  clear: () => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  isLoading: false,

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),

  setLoading: (v) => set({ isLoading: v }),

  buildContext: (canvasState) => {
    const msgs = get().messages;
    const context: Array<{ role: string; content: string }> = [];

    for (const m of msgs) {
      context.push({ role: m.role, content: m.content });
    }

    // Append canvas state as a user-role context message (not system)
    if (canvasState.charts.length > 0) {
      const chartSummary = canvasState.charts
        .map((c) => `Chart "${c.id}": position=(${c.x},${c.y}), size=${c.width}x${c.height}`)
        .join("; ");
      context.push({
        role: "user",
        content: `[画布上下文] 当前画布有 ${canvasState.charts.length} 个图表：${chartSummary}。${canvasState.annotations.length} 个批注。请基于此上下文处理我的下一条指令。`,
      });
    }

    return context;
  },

  clear: () => set({ messages: [] }),
}));
