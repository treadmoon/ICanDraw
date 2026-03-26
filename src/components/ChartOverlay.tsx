"use client";

import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";
import type { ChartInstance } from "@/types";

export default function ChartOverlay({ chart }: { chart: ChartInstance }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!chartRef.current) {
      chartRef.current = echarts.init(containerRef.current);
    }

    try {
      chartRef.current.setOption(chart.option, true);
    } catch (err) {
      console.error("ECharts setOption failed:", err);
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
      style={{
        position: "absolute",
        left: chart.x,
        top: chart.y,
        width: chart.width,
        height: chart.height,
        zIndex: 10,
      }}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
    >
      {/* ECharts 容器：非激活时不拦截鼠标事件，让 Excalidraw 可正常交互 */}
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          pointerEvents: active ? "auto" : "none",
          borderRadius: 8,
          background: "rgba(255,255,255,0.95)",
          boxShadow: active
            ? "0 4px 20px rgba(0,0,0,0.12)"
            : "0 2px 12px rgba(0,0,0,0.06)",
          border: active ? "2px solid #3b82f6" : "1px solid rgba(0,0,0,0.06)",
          transition: "box-shadow 0.2s, border 0.2s",
        }}
      />
    </div>
  );
}
