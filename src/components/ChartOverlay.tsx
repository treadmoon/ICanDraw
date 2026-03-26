"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { ChartInstance } from "@/types";

export default function ChartOverlay({ chart }: { chart: ChartInstance }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!chartRef.current) {
      chartRef.current = echarts.init(containerRef.current);
    }

    try {
      chartRef.current.setOption(chart.option, true);
    } catch (err) {
      console.error("ECharts setOption failed:", err);
      // Show fallback in the container
      if (containerRef.current) {
        containerRef.current.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#999;font-size:13px;">图表渲染失败</div>`;
      }
      chartRef.current = null;
    }

    return () => {
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, [chart.option]);

  useEffect(() => {
    chartRef.current?.resize();
  }, [chart.width, chart.height]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        left: chart.x,
        top: chart.y,
        width: chart.width,
        height: chart.height,
        zIndex: 10,
        pointerEvents: "auto",
        borderRadius: 8,
        background: "rgba(255,255,255,0.95)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
      }}
    />
  );
}
