"use client";

import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";
import type { ChartInstance } from "@/types";

export default function ChartOverlay({ chart }: { chart: ChartInstance }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const [active, setActive] = useState(false);
  const [renderError, setRenderError] = useState(false);

  // Init once, dispose on unmount only
  useEffect(() => {
    if (!containerRef.current) return;
    chartRef.current = echarts.init(containerRef.current);
    return () => {
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  // Update option separately
  useEffect(() => {
    if (!chartRef.current) return;
    try {
      chartRef.current.setOption(chart.option, true);
      setRenderError(false);
    } catch (err) {
      console.error("ECharts setOption failed:", err);
      setRenderError(true);
    }
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
        pointerEvents: "none",
      }}
    >
      {/* Hover 感应区：透明，仅用于检测鼠标进入 */}
      <div
        style={{
          position: "absolute",
          inset: -4,
          zIndex: 1,
          pointerEvents: "auto",
        }}
        onMouseEnter={() => setActive(true)}
        onMouseLeave={() => setActive(false)}
      />

      {renderError ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#999",
            fontSize: 13,
            background: "rgba(255,255,255,0.95)",
            borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.06)",
            pointerEvents: "none",
          }}
        >
          图表渲染失败
        </div>
      ) : (
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
            border: active
              ? "2px solid #3b82f6"
              : "1px solid rgba(0,0,0,0.06)",
            transition: "box-shadow 0.2s, border 0.2s",
            position: "relative",
            zIndex: 2,
          }}
        />
      )}
    </div>
  );
}
