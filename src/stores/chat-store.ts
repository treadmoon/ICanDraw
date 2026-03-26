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

    // Append current canvas state summary as system context
    if (canvasState.charts.length > 0) {
      const chartSummary = canvasState.charts
        .map((c) => `Chart "${c.id}": type=${(c.option as Record<string, unknown>).series ? "has series" : "unknown"}, position=(${c.x},${c.y})`)
        .join("; ");
      context.push({
        role: "system",
        content: `Current canvas state: ${chartSummary}. ${canvasState.annotations.length} annotations present.`,
      });
    }

    return context;
  },

  clear: () => set({ messages: [] }),
}));
