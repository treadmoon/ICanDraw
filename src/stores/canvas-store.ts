import { create } from "zustand";
import type { CanvasState, ChartInstance, Annotation } from "@/types";

interface CanvasStore extends CanvasState {
  addChart: (chart: ChartInstance) => void;
  updateChart: (id: string, patch: Partial<ChartInstance>) => void;
  removeChart: (id: string) => void;
  addAnnotation: (annotation: Annotation) => void;
  setAnnotations: (annotations: Annotation[]) => void;
  applyAIResponse: (charts: ChartInstance[], annotations: Annotation[]) => void;
  clear: () => void;
}

export const useCanvasStore = create<CanvasStore>((set) => ({
  charts: [],
  annotations: [],

  addChart: (chart) =>
    set((s) => ({ charts: [...s.charts, chart] })),

  updateChart: (id, patch) =>
    set((s) => ({
      charts: s.charts.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })),

  removeChart: (id) =>
    set((s) => ({
      charts: s.charts.filter((c) => c.id !== id),
      annotations: s.annotations.filter((a) => a.bindTo !== id),
    })),

  addAnnotation: (annotation) =>
    set((s) => ({ annotations: [...s.annotations, annotation] })),

  setAnnotations: (annotations) => set({ annotations }),

  applyAIResponse: (charts, annotations) =>
    set((s) => {
      const chartMap = new Map(s.charts.map((c) => [c.id, c]));
      for (const chart of charts) {
        chartMap.set(chart.id, chart);
      }
      const annotationMap = new Map(s.annotations.map((a) => [a.id, a]));
      for (const ann of annotations) {
        annotationMap.set(ann.id, ann);
      }
      return {
        charts: Array.from(chartMap.values()),
        annotations: Array.from(annotationMap.values()),
      };
    }),

  clear: () => set({ charts: [], annotations: [] }),
}));
