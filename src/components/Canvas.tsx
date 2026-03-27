"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useCanvasStore } from "@/stores/canvas-store";
import { useI18n } from "@/stores/i18n-store";
import EChartEmbeddable from "./EChartEmbeddable";
import type { ExcalidrawElementData } from "@/types";

const ECHART_PROTOCOL = "echart://";
const AI_PREFIX = "ai-el-";

function toExcalidrawElements(
  elements: ExcalidrawElementData[],
  groupId: string
): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];

  elements.forEach((el, i) => {
    const excType = el.type === "diamond" ? "diamond" : el.type;
    const isLinear = excType === "arrow" || excType === "line";

    // For arrows/lines, derive width/height from points
    let w = el.width ?? 100;
    let h = el.height ?? 40;
    if (isLinear && el.points && el.points.length >= 2) {
      const pts = el.points;
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      w = Math.max(...xs) - Math.min(...xs);
      h = Math.max(...ys) - Math.min(...ys);
    }

    const base: Record<string, unknown> = {
      id: `${AI_PREFIX}${groupId}-${i}`,
      type: excType,
      x: el.x,
      y: el.y,
      width: w,
      height: h,
      strokeColor: el.strokeColor ?? "#1e1e1e",
      backgroundColor: el.backgroundColor ?? "transparent",
      fillStyle: el.backgroundColor ? "solid" : "hachure",
      strokeWidth: 2,
      strokeStyle: "solid",
      roughness: 0,
      opacity: 100,
      angle: 0,
      seed: Math.floor(Math.random() * 100000),
      version: 1,
      versionNonce: Math.floor(Math.random() * 1000000),
      isDeleted: false,
      boundElements: null,
      link: null,
      locked: false,
      roundness: excType === "diamond" ? null : { type: 3 },
      index: `a${i}`,
      frameId: null,
      groupIds: [],
    };

    if (excType === "text") {
      base.text = el.text ?? "";
      base.fontSize = 16;
      base.fontFamily = 1;
      base.textAlign = "center";
      base.verticalAlign = "middle";
      base.originalText = el.text ?? "";
      base.autoResize = true;
      base.lineHeight = 1.25;
      base.containerId = null;
    }

    if (isLinear) {
      base.points = el.points ?? [[0, 0], [w, h]];
      base.startBinding = null;
      base.endBinding = null;
      base.lastCommittedPoint = null;
      if (excType === "arrow") {
        base.startArrowhead = null;
        base.endArrowhead = "arrow";
      }
    }

    results.push(base);

    // Auto-generate centered text label for shape elements with text
    if (el.text && !isLinear && excType !== "text") {
      const shapeW = el.width ?? 100;
      const shapeH = el.height ?? 40;
      const fontSize = 14;
      // Estimate: CJK chars ~1em wide, latin ~0.6em
      const hasCJK = /[\u4e00-\u9fff]/.test(el.text);
      const charW = hasCJK ? fontSize : fontSize * 0.6;
      const textW = el.text.length * charW;
      const textH = fontSize * 1.25;
      results.push({
        id: `${AI_PREFIX}${groupId}-${i}-label`,
        type: "text",
        x: el.x + (shapeW - textW) / 2,
        y: el.y + (shapeH - textH) / 2,
        width: textW,
        height: textH,
        text: el.text,
        originalText: el.text,
        fontSize,
        fontFamily: 1,
        textAlign: "center",
        verticalAlign: "middle",
        autoResize: true,
        lineHeight: 1.25,
        containerId: null,
        strokeColor: "#1e1e1e",
        backgroundColor: "transparent",
        fillStyle: "hachure",
        strokeWidth: 0,
        strokeStyle: "solid",
        roughness: 0,
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
        index: `a${i}t`,
        frameId: null,
        groupIds: [],
      });
    }
  });

  return results;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExcalidrawAPI = any;

export default function Canvas() {
  const annotations = useCanvasStore((s) => s.annotations);
  const drawings = useCanvasStore((s) => s.drawings);
  const setExcalidrawAPI = useCanvasStore((s) => s.setExcalidrawAPI);
  const t = useI18n((s) => s.t);
  const apiRef = useRef<ExcalidrawAPI | null>(null);
  const prevAIRef = useRef<string>("");
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [ExcalidrawComp, setExcalidrawComp] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    import("@excalidraw/excalidraw")
      .then((mod) => {
        if (!cancelled) {
          try { import("@excalidraw/excalidraw/index.css"); } catch {}
          setExcalidrawComp(() => mod.Excalidraw);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) { setError(`${t.canvasLoadFail}: ${err.message}`); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, []);

  const onExcalidrawAPI = useCallback((api: ExcalidrawAPI) => {
    apiRef.current = api;
    setExcalidrawAPI(api);
  }, [setExcalidrawAPI]);

  // Accept echart:// links as valid embeddable
  const validateEmbeddable = useCallback((link: string) => {
    return link.startsWith(ECHART_PROTOCOL);
  }, []);

  // Render ECharts inside embeddable elements
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderEmbeddable = useCallback((element: any) => {
    const link: string = element.link ?? "";
    if (!link.startsWith(ECHART_PROTOCOL)) return null;
    const chartId = link.slice(ECHART_PROTOCOL.length);
    return <EChartEmbeddable chartId={chartId} />;
  }, []);

  // Sync AI drawings + annotations to Excalidraw
  useEffect(() => {
    const key = JSON.stringify({ drawings, annotations });
    if (key === prevAIRef.current || !apiRef.current) return;
    prevAIRef.current = key;

    try {
      const existing = apiRef.current.getSceneElements();
      const userElements = existing.filter(
        (el: { id: string }) => !el.id.startsWith(AI_PREFIX)
      );
      const drawingElements = drawings.flatMap((d) =>
        toExcalidrawElements(d.elements, d.id)
      );
      const annElements = annotations.flatMap((a) =>
        toExcalidrawElements(a.elements, a.id)
      );
      apiRef.current.updateScene({ elements: [...userElements, ...drawingElements, ...annElements] });
    } catch (err) {
      console.error("Failed to update Excalidraw scene:", err);
    }
  }, [drawings, annotations]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-red-500">
        <div className="text-center">
          <p className="mb-2 text-2xl">⚠️</p>
          <p>{error}</p>
          <button onClick={() => { setError(null); window.location.reload(); }} className="mt-3 rounded-lg bg-blue-600 px-4 py-1.5 text-white text-xs hover:bg-blue-700">{t.refresh}</button>
        </div>
      </div>
    );
  }

  if (loading || !ExcalidrawComp) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        <div className="text-center">
          <div className="mb-2 h-8 w-8 mx-auto animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
          {t.canvasLoading}
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 z-0">
        <ExcalidrawComp
          excalidrawAPI={onExcalidrawAPI}
          validateEmbeddable={validateEmbeddable}
          renderEmbeddable={renderEmbeddable}
        />
      </div>
    </div>
  );
}
