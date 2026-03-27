"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useCanvasStore } from "@/stores/canvas-store";
import ChartOverlay from "./ChartOverlay";
import type { ExcalidrawElementData } from "@/types";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExcalidrawAPI = any;

export default function Canvas() {
  const { charts, annotations } = useCanvasStore();
  const apiRef = useRef<ExcalidrawAPI | null>(null);
  const prevAnnotationsRef = useRef<string>("");
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [ExcalidrawComp, setExcalidrawComp] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Manually load Excalidraw on mount
  useEffect(() => {
    let cancelled = false;
    console.log("[Canvas] Starting Excalidraw import...");
    const startTime = performance.now();

    import("@excalidraw/excalidraw")
      .then((mod) => {
        console.log("[Canvas] Excalidraw module loaded in", Math.round(performance.now() - startTime), "ms");
        console.log("[Canvas] Module keys:", Object.keys(mod).slice(0, 10));
        console.log("[Canvas] Excalidraw component type:", typeof mod.Excalidraw);
        if (!cancelled) {
          try {
            import("@excalidraw/excalidraw/index.css");
            console.log("[Canvas] CSS import triggered");
          } catch (cssErr) {
            console.warn("[Canvas] CSS import failed:", cssErr);
          }
          setExcalidrawComp(() => mod.Excalidraw);
          setLoading(false);
          console.log("[Canvas] State updated, loading=false");
        } else {
          console.log("[Canvas] Cancelled, skipping state update");
        }
      })
      .catch((err) => {
        console.error("[Canvas] Failed to load Excalidraw:", err);
        console.error("[Canvas] Error name:", err.name, "message:", err.message);
        console.error("[Canvas] Error stack:", err.stack);
        if (!cancelled) {
          setError(`画布加载失败: ${err.message}`);
          setLoading(false);
        }
      });
    return () => {
      console.log("[Canvas] Cleanup, setting cancelled=true");
      cancelled = true;
    };
  }, []);

  const onExcalidrawAPI = useCallback((api: ExcalidrawAPI) => {
    apiRef.current = api;
  }, []);

  // Sync AI annotations
  useEffect(() => {
    const key = JSON.stringify(annotations);
    if (key === prevAnnotationsRef.current || !apiRef.current) return;
    prevAnnotationsRef.current = key;

    try {
      const existing = apiRef.current.getSceneElements();
      const userElements = existing.filter(
        (el: { id: string }) => !el.id.startsWith(AI_ELEMENT_PREFIX)
      );
      const aiElements = annotations.flatMap((a) =>
        toExcalidrawElements(a.elements, a.id)
      );
      apiRef.current.updateScene({
        elements: [...userElements, ...aiElements],
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

  if (loading || !ExcalidrawComp) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        <div className="text-center">
          <div className="mb-2 h-8 w-8 mx-auto animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
          画布加载中...
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0 z-0">
        <ExcalidrawComp excalidrawAPI={onExcalidrawAPI} />
      </div>
      {charts.map((chart) => (
        <ChartOverlay key={chart.id} chart={chart} />
      ))}
    </div>
  );
}
