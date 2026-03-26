"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { useCanvasStore } from "@/stores/canvas-store";
import ChartOverlay from "./ChartOverlay";
import type { ExcalidrawElementData } from "@/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        <div className="text-center">
          <div className="mb-2 h-8 w-8 mx-auto animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
          画布加载中...
        </div>
      </div>
    ),
  }
);

// Track AI-generated element IDs to replace (not accumulate) on update
const AI_ELEMENT_PREFIX = "ai-ann-";

function toExcalidrawElements(
  elements: ExcalidrawElementData[],
  annotationId: string
): Record<string, unknown>[] {
  return elements.map((el, i) => {
    const base: Record<string, unknown> = {
      id: `${AI_ELEMENT_PREFIX}${annotationId}-${i}`,
      type: el.type,
      x: el.x,
      y: el.y,
      width: el.width ?? 100,
      height: el.height ?? 40,
      strokeColor: el.strokeColor ?? "#1e1e1e",
      backgroundColor: "transparent",
      fillStyle: "hachure",
      strokeWidth: 2,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      angle: 0,
      seed: Math.floor(Math.random() * 100000),
      version: 1,
      versionNonce: Math.floor(Math.random() * 1000000),
      isDeleted: false,
      boundElements: null,
      link: null,
      locked: false,
      roundness: null,
      index: `a${i}`,
      frameId: null,
      groupIds: [],
    };

    if (el.type === "text") {
      base.text = el.text ?? "";
      base.fontSize = 16;
      base.fontFamily = 1;
      base.textAlign = "left";
      base.verticalAlign = "top";
      base.originalText = el.text ?? "";
      base.autoResize = true;
      base.lineHeight = 1.25;
      base.containerId = null;
    }

    if (el.type === "arrow") {
      base.points = el.points ?? [
        [0, 0],
        [el.width ?? 100, el.height ?? 0],
      ];
      base.startArrowhead = null;
      base.endArrowhead = "arrow";
      base.startBinding = null;
      base.endBinding = null;
      base.lastCommittedPoint = null;
    }

    return base;
  });
}

export default function Canvas() {
  const { charts, annotations } = useCanvasStore();
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const prevAnnotationsRef = useRef<string>("");
  const [error, setError] = useState<string | null>(null);

  const onExcalidrawAPI = useCallback((api: ExcalidrawImperativeAPI) => {
    apiRef.current = api;
  }, []);

  // Sync AI annotations: replace old AI elements, preserve user-drawn elements
  useEffect(() => {
    const key = JSON.stringify(annotations);
    if (key === prevAnnotationsRef.current || !apiRef.current) return;
    prevAnnotationsRef.current = key;

    try {
      const existing = apiRef.current.getSceneElements();
      // Keep only user-drawn elements (not AI-generated)
      const userElements = existing.filter(
        (el) => !el.id.startsWith(AI_ELEMENT_PREFIX)
      );
      // Build new AI elements
      const aiElements = annotations.flatMap((a) =>
        toExcalidrawElements(a.elements, a.id)
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      apiRef.current.updateScene({
        elements: [...userElements, ...aiElements] as any,
      });
    } catch (err) {
      console.error("Failed to update Excalidraw scene:", err);
      setError("批注渲染失败，请刷新页面重试");
    }
  }, [annotations]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-red-500">
        <div className="text-center">
          <p className="mb-2 text-2xl">⚠️</p>
          <p>{error}</p>
          <button
            onClick={() => {
              setError(null);
              window.location.reload();
            }}
            className="mt-3 rounded-lg bg-blue-600 px-4 py-1.5 text-white text-xs hover:bg-blue-700"
          >
            刷新页面
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0 z-0">
        <Excalidraw excalidrawAPI={onExcalidrawAPI} />
      </div>
      {charts.map((chart) => (
        <ChartOverlay key={chart.id} chart={chart} />
      ))}
    </div>
  );
}
