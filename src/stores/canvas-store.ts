import { create } from "zustand";
import type { EChartsOption } from "echarts";
import type { Annotation, Drawing } from "@/types";

interface CanvasStore {
  chartOptions: Record<string, EChartsOption>;
  drawings: Drawing[];
  annotations: Annotation[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  excalidrawAPI: any | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setExcalidrawAPI: (api: any) => void;
  setChartOption: (id: string, option: EChartsOption) => void;
  removeChart: (id: string) => void;
  addDrawings: (drawings: Drawing[]) => void;
  setAnnotations: (annotations: Annotation[]) => void;
  clear: () => void;
}

export const useCanvasStore = create<CanvasStore>((set) => ({
  chartOptions: {},
  drawings: [],
  annotations: [],
  excalidrawAPI: null,

  setExcalidrawAPI: (api) => set({ excalidrawAPI: api }),

  setChartOption: (id, option) =>
    set((s) => ({ chartOptions: { ...s.chartOptions, [id]: option } })),

  removeChart: (id) =>
    set((s) => {
      const { [id]: _, ...rest } = s.chartOptions;
      return { chartOptions: rest, annotations: s.annotations.filter((a) => a.bindTo !== id) };
    }),

  addDrawings: (newDrawings) =>
    set((s) => {
      const map = new Map(s.drawings.map((d) => [d.id, d]));
      for (const d of newDrawings) map.set(d.id, d);
      return { drawings: Array.from(map.values()) };
    }),

  setAnnotations: (annotations) => set({ annotations }),

  clear: () => set({ chartOptions: {}, drawings: [], annotations: [] }),
}));
