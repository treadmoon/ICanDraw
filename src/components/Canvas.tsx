"use client";

import { useRef, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useCanvasStore } from "@/stores/canvas-store";
import ChartOverlay from "./ChartOverlay";
import type { ExcalidrawElementData } from "@/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw),
  { ssr: false }
);

function toExcalidrawElements(elements: ExcalidrawElementData[]): Record<string, unknown>[] {
  return elements.map((el, i) => {
    const base: Record<string, unknown> = {
      id: `exc-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
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
      base.points = el.points ?? [[0, 0], [el.width ?? 100, el.height ?? 0]];
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

  const onExcalidrawAPI = useCallback((api: ExcalidrawImperativeAPI) => {
    apiRef.current = api;
  }, []);

  // Sync annotations to Excalidraw scene
  useEffect(() => {
    const key = JSON.stringify(annotations);
    if (key === prevAnnotationsRef.current || !apiRef.current) return;
    prevAnnotationsRef.current = key;

    const elements = annotations.flatMap((a) => toExcalidrawElements(a.elements));
    if (elements.length > 0) {
      const existing = apiRef.current.getSceneElements();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      apiRef.current.updateScene({ elements: [...existing, ...elements] as any });
    }
  }, [annotations]);

  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0">
        <Excalidraw
          excalidrawAPI={onExcalidrawAPI}
          UIOptions={{ canvasActions: { saveAsImage: false } }}
        />
      </div>
      {charts.map((chart) => (
        <ChartOverlay key={chart.id} chart={chart} />
      ))}
    </div>
  );
}
