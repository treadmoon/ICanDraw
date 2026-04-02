"use client";

import { useEffect, useRef, useMemo } from "react";
import * as echarts from "echarts";
import { useCanvasStore } from "@/stores/canvas-store";

/** Renders an ECharts instance inside an Excalidraw embeddable element */
export default function EChartEmbeddable({ chartId }: { chartId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const rawOption = useCanvasStore((s) => s.chartOptions[chartId]);

  // Sanitize option: deep-clone via JSON to strip any function references,
  // and remove known dangerous keys that ECharts might eval
  const option = useMemo(() => {
    if (!rawOption) return null;
    try {
      const clean = JSON.parse(JSON.stringify(rawOption));
      // Remove keys that could execute code
      const dangerous = ["formatter", "color", "renderItem", "dispatch"];
      const stripFunctions = (obj: Record<string, unknown>) => {
        for (const key of Object.keys(obj)) {
          if (dangerous.includes(key) && typeof obj[key] === "string" && obj[key].toString().includes("function")) {
            delete obj[key];
          }
          if (obj[key] && typeof obj[key] === "object") {
            stripFunctions(obj[key] as Record<string, unknown>);
          }
        }
      };
      stripFunctions(clean);
      return clean;
    } catch {
      return null;
    }
  }, [rawOption]);

  useEffect(() => {
    if (!containerRef.current) return;
    const raf = requestAnimationFrame(() => {
      if (!containerRef.current) return;
      chartRef.current = echarts.init(containerRef.current);
      if (option) {
        try { chartRef.current.setOption(option, true); } catch (e) { console.error("ECharts init error:", e); }
      }
    });
    return () => { cancelAnimationFrame(raf); chartRef.current?.dispose(); chartRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!chartRef.current || !option) return;
    try { chartRef.current.setOption(option, true); } catch (e) { console.error("ECharts update error:", e); }
  }, [option]);

  // Resize observer to handle Excalidraw resizing the element
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => chartRef.current?.resize());
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  if (!option) {
    return <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontSize: 13 }}></div>;
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        background: "rgba(255,255,255,0.95)",
        borderRadius: 8,
      }}
    />
  );
}
