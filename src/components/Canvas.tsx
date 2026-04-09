"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useCanvasStore } from "@/stores/canvas-store";
import { useI18n } from "@/stores/i18n-store";
import EChartEmbeddable from "./EChartEmbeddable";
import type { ExcalidrawElementData, SourceLocation } from "@/types";

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
      w = Math.max(1, Math.max(...xs) - Math.min(...xs));
      h = Math.max(1, Math.max(...ys) - Math.min(...ys));
    }

    const base: Record<string, unknown> = {
      id: `${AI_PREFIX}${groupId}-${i}`,
      type: excType,
      x: el.x,
      y: el.y,
      width: Math.max(50, w),
      height: Math.max(30, h),
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

    // Preserve source tracing information for learning
    if (el.sourceLocation) {
      base.sourceLocation = el.sourceLocation;
    }
    if (el.apiRoute) {
      base.apiRoute = el.apiRoute;
    }
    if (el.flowDescription) {
      base.flowDescription = el.flowDescription;
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
  // Tooltip state for source tracing
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    sourceLocation?: SourceLocation;
    apiRoute?: string;
    flowDescription?: string;
    label?: string;
  }>({ visible: false, x: 0, y: 0 });

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

  // Handle pointer move for source tracing tooltip
  // Uses scene coordinates from Excalidraw elements for hit testing
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!apiRef.current) return;

    const elements = apiRef.current.getSceneElements();
    if (!elements || elements.length === 0) return;

    // Get canvas bounding rect to convert viewport coords to scene coords
    // Note: This is an approximation. Excalidraw doesn't expose public transform API.
    const canvasRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const sceneX = e.clientX - canvasRect.left;
    const sceneY = e.clientY - canvasRect.top;

    // Find AI element under pointer using scene coordinates
    for (const el of elements) {
      if (el.id.startsWith(AI_PREFIX)) {
        const elX = el.x;
        const elY = el.y;
        const elW = el.width || 100;
        const elH = el.height || 40;

        if (sceneX >= elX && sceneX <= elX + elW &&
            sceneY >= elY && sceneY <= elY + elH) {
          // Found element under pointer
          if (el.sourceLocation || el.apiRoute || el.flowDescription || el.text) {
            // Clamp tooltip position to stay within viewport
            const TOOLTIP_OFFSET = 10;
            const TOOLTIP_WIDTH = 300;
            const TOOLTIP_HEIGHT = 200;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const tooltipX = Math.min(e.clientX + TOOLTIP_OFFSET, viewportWidth - TOOLTIP_WIDTH);
            const tooltipY = Math.min(e.clientY + TOOLTIP_OFFSET, viewportHeight - TOOLTIP_HEIGHT);
            setTooltip({
              visible: true,
              x: tooltipX,
              y: tooltipY,
              sourceLocation: el.sourceLocation,
              apiRoute: el.apiRoute,
              flowDescription: el.flowDescription || (el.text ? `节点: ${el.text}` : undefined),
              label: el.label || el.text,
            });
            return;
          }
        }
      }
    }
    setTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev));
  }, []);

  // Hide tooltip on pointer leave
  const handlePointerLeave = useCallback(() => {
    setTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev));
  }, []);

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
    <div
      className="relative h-full w-full overflow-hidden"
      onPointerLeave={handlePointerLeave}
    >
      <div className="absolute inset-0 z-0">
        <ExcalidrawComp
          excalidrawAPI={onExcalidrawAPI}
          validateEmbeddable={validateEmbeddable}
          renderEmbeddable={renderEmbeddable}
          onPointerMove={handlePointerMove}
        />
      </div>
      {/* Source tracing tooltip */}
      {tooltip.visible && (
        <div
          className="fixed z-50 max-w-xs rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-lg"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.label && (
            <div className="mb-2 font-semibold text-gray-800">{tooltip.label}</div>
          )}
          {tooltip.sourceLocation && (
            <div className="space-y-1 text-gray-600">
              <div className="flex items-center gap-1">
                <span className="text-gray-400">📁</span>
                <span className="font-mono">{tooltip.sourceLocation.file}</span>
              </div>
              {tooltip.sourceLocation.function && (
                <div className="flex items-center gap-1">
                  <span className="text-gray-400">ƒ</span>
                  <span className="font-mono">{tooltip.sourceLocation.function}</span>
                </div>
              )}
              {tooltip.sourceLocation.line && (
                <div className="flex items-center gap-1">
                  <span className="text-gray-400">#</span>
                  <span className="font-mono">Line {tooltip.sourceLocation.line}</span>
                </div>
              )}
              {tooltip.sourceLocation.event && (
                <div className="flex items-center gap-1">
                  <span className="text-gray-400">⚡</span>
                  <span className="font-mono">{tooltip.sourceLocation.event} event</span>
                </div>
              )}
            </div>
          )}
          {tooltip.apiRoute && (
            <div className="mt-2 flex items-center gap-1 text-blue-600">
              <span className="text-gray-400">→</span>
              <span className="font-mono font-semibold">{tooltip.apiRoute}</span>
            </div>
          )}
          {tooltip.flowDescription && (
            <div className="mt-2 border-t border-gray-100 pt-2 text-gray-700">
              {tooltip.flowDescription}
            </div>
          )}
        </div>
      )}
      {/* Legend for source tracing */}
      <div className="absolute bottom-3 left-3 z-10 rounded-lg border border-gray-200 bg-white/90 p-2 text-xs shadow-sm">
        <div className="mb-1.5 font-medium text-gray-700">流程图图例</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded" style={{ backgroundColor: "#4dabf7" }} />
            <span className="text-gray-600">界面层 (UI)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded" style={{ backgroundColor: "#ffd43b" }} />
            <span className="text-gray-600">API 层</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded" style={{ backgroundColor: "#b197fc" }} />
            <span className="text-gray-600">处理器 (Handler)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded" style={{ backgroundColor: "#63e6be" }} />
            <span className="text-gray-600">数据层</span>
          </div>
        </div>
        <div className="mt-2 border-t border-gray-100 pt-1.5 text-gray-500">
          悬停查看源码位置
        </div>
      </div>
    </div>
  );
}
