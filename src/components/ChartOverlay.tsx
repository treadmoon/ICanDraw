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

    chartRef.current.setOption(chart.option, true);

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
      }}
    />
  );
}
