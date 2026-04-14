/**
 * Layout Validator & Auto-Fixer
 *
 * Pipeline: AI raw output → validate → detect collisions → fix layout → recalc arrows → clean output
 */

import type { ExcalidrawElementData, Drawing } from "@/types";

// --- Config ---

const VIEWPORT = { minX: 50, minY: 50, maxX: 2400, maxY: 1600 };
const MIN_GAP = 30;
const OVERLAP_THRESHOLD = 0.3;

export interface FixReport {
  phase: "validate" | "detect" | "layout" | "arrows" | "done";
  message: string;
  stats?: { elements: number; overlaps: number; outOfBounds: number; fixed: number };
}

export type OnProgress = (report: FixReport) => void;

interface BBox { x: number; y: number; w: number; h: number }

interface ValidatedElement extends ExcalidrawElementData {
  _bbox: BBox;
  _index: number;
}

// --- Phase 1: Structure Validation ---

function isValidElement(el: ExcalidrawElementData): boolean {
  if (!el.type || typeof el.x !== "number" || typeof el.y !== "number") return false;
  if (isNaN(el.x) || isNaN(el.y)) return false;
  if ((el.type === "arrow" || el.type === "line") && (!el.points || el.points.length < 2)) return false;
  if (el.type === "text" && !el.text) return false;
  return true;
}

function fixElement(el: ExcalidrawElementData): ExcalidrawElementData {
  const fixed = { ...el };
  if (typeof fixed.x !== "number" || isNaN(fixed.x)) fixed.x = 100;
  if (typeof fixed.y !== "number" || isNaN(fixed.y)) fixed.y = 100;
  if (fixed.width !== undefined && (fixed.width <= 0 || isNaN(fixed.width))) fixed.width = 160;
  if (fixed.height !== undefined && (fixed.height <= 0 || isNaN(fixed.height))) fixed.height = 60;
  if ((fixed.type === "arrow" || fixed.type === "line") && (!fixed.points || fixed.points.length < 2)) {
    fixed.points = [[0, 0], [100, 0]];
  }
  return fixed;
}

// --- Phase 2: Collision Detection ---

function getBBox(el: ExcalidrawElementData): BBox {
  if (el.type === "arrow" || el.type === "line") return { x: el.x, y: el.y, w: 0, h: 0 };
  const w = el.width ?? (el.type === "text" ? 80 : 160);
  const h = el.height ?? (el.type === "text" ? 30 : 60);
  return { x: el.x, y: el.y, w, h };
}

function overlaps(a: BBox, b: BBox): boolean {
  if (a.w === 0 || b.w === 0) return false;
  return (
    a.x < b.x + b.w + MIN_GAP && a.x + a.w + MIN_GAP > b.x &&
    a.y < b.y + b.h + MIN_GAP && a.y + a.h + MIN_GAP > b.y
  );
}

function isOutOfViewport(bbox: BBox): boolean {
  return bbox.x < VIEWPORT.minX || bbox.y < VIEWPORT.minY ||
    bbox.x + bbox.w > VIEWPORT.maxX || bbox.y + bbox.h > VIEWPORT.maxY;
}

// --- Phase 3: Layout Fix ---

function gridRelayout(nodes: ValidatedElement[]): void {
  if (nodes.length === 0) return;
  const cols = Math.min(4, Math.ceil(Math.sqrt(nodes.length)));
  const maxW = Math.max(...nodes.map((n) => n._bbox.w), 160);
  const maxH = Math.max(...nodes.map((n) => n._bbox.h), 60);
  const gapX = maxW + MIN_GAP * 2;
  const gapY = maxH + MIN_GAP * 2;

  nodes.forEach((node, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    node.x = VIEWPORT.minX + col * gapX;
    node.y = VIEWPORT.minY + row * gapY;
    node._bbox.x = node.x;
    node._bbox.y = node.y;
  });
}

function pushApart(nodes: ValidatedElement[], maxIterations = 20): void {
  for (let iter = 0; iter < maxIterations; iter++) {
    let moved = false;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]._bbox;
        const b = nodes[j]._bbox;
        if (!overlaps(a, b)) continue;
        moved = true;
        const overlapX = (a.x + a.w + MIN_GAP) - b.x;
        const overlapY = (a.y + a.h + MIN_GAP) - b.y;
        if (overlapX < overlapY) {
          nodes[j].x += overlapX;
          nodes[j]._bbox.x = nodes[j].x;
        } else {
          nodes[j].y += overlapY;
          nodes[j]._bbox.y = nodes[j].y;
        }
      }
    }
    if (!moved) break;
  }
  // Clamp back into viewport after pushing apart
  for (const node of nodes) {
    node.x = Math.max(VIEWPORT.minX, Math.min(node.x, VIEWPORT.maxX - node._bbox.w));
    node.y = Math.max(VIEWPORT.minY, Math.min(node.y, VIEWPORT.maxY - node._bbox.h));
    node._bbox.x = node.x;
    node._bbox.y = node.y;
  }
}

// --- Phase 4: Arrow Recalculation ---

type Side = "top" | "bottom" | "left" | "right";

function getAnchor(bbox: BBox, side: Side): [number, number] {
  switch (side) {
    case "top": return [bbox.x + bbox.w / 2, bbox.y];
    case "bottom": return [bbox.x + bbox.w / 2, bbox.y + bbox.h];
    case "left": return [bbox.x, bbox.y + bbox.h / 2];
    case "right": return [bbox.x + bbox.w, bbox.y + bbox.h / 2];
  }
}

function bestSides(from: BBox, to: BBox): [Side, Side] {
  const dx = (to.x + to.w / 2) - (from.x + from.w / 2);
  const dy = (to.y + to.h / 2) - (from.y + from.h / 2);
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? ["right", "left"] : ["left", "right"];
  return dy > 0 ? ["bottom", "top"] : ["top", "bottom"];
}

function recalcArrow(arrow: ExcalidrawElementData, nodeMap: Map<string, BBox>): ExcalidrawElementData {
  const pts = arrow.points ?? [[0, 0], [100, 0]];
  const startAbs: [number, number] = [arrow.x + pts[0][0], arrow.y + pts[0][1]];
  const endAbs: [number, number] = [arrow.x + pts[pts.length - 1][0], arrow.y + pts[pts.length - 1][1]];

  let fromNode: BBox | null = null;
  let toNode: BBox | null = null;
  let minStartDist = Infinity;
  let minEndDist = Infinity;

  for (const bbox of nodeMap.values()) {
    if (bbox.w === 0) continue;
    const cx = bbox.x + bbox.w / 2;
    const cy = bbox.y + bbox.h / 2;
    const dStart = Math.hypot(startAbs[0] - cx, startAbs[1] - cy);
    const dEnd = Math.hypot(endAbs[0] - cx, endAbs[1] - cy);
    if (dStart < minStartDist) { minStartDist = dStart; fromNode = bbox; }
    if (dEnd < minEndDist) { minEndDist = dEnd; toNode = bbox; }
  }

  if (!fromNode || !toNode || fromNode === toNode) return arrow;

  // Guard against zero-length arrows when nodes overlap at same position
  const [fromSide, toSide] = bestSides(fromNode, toNode);
  const [fx, fy] = getAnchor(fromNode, fromSide);
  const [tx, ty] = getAnchor(toNode, toSide);
  if (fx === tx && fy === ty) return arrow;

  return { ...arrow, x: fx, y: fy, points: [[0, 0], [tx - fx, ty - fy]] };
}

/** Yield to browser so React can re-render between phases */
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

// --- Main Pipeline ---

export async function validateAndFixDrawing(drawing: Drawing, onProgress?: OnProgress): Promise<Drawing> {
  if (!drawing.elements || drawing.elements.length === 0) return drawing;

  // Phase 1: validate
  let invalidCount = 0;
  const elements = drawing.elements.map((el) => {
    if (isValidElement(el)) return { ...el };
    invalidCount++;
    return fixElement(el);
  });

  onProgress?.({
    phase: "validate",
    message: invalidCount > 0
      ? `校验完成，修复了 ${invalidCount} 个异常元素`
      : `校验通过，${elements.length} 个元素结构正常`,
  });
  if (onProgress) await tick();

  // Separate nodes vs arrows
  const nodes: ValidatedElement[] = [];
  const arrows: ExcalidrawElementData[] = [];
  elements.forEach((el, i) => {
    if (el.type === "arrow" || el.type === "line") arrows.push(el);
    else nodes.push({ ...el, _bbox: getBBox(el), _index: i });
  });

  // Phase 2: detect
  let overlapCount = 0;
  let oobCount = 0;
  for (let i = 0; i < nodes.length; i++) {
    if (isOutOfViewport(nodes[i]._bbox)) oobCount++;
    for (let j = i + 1; j < nodes.length; j++) {
      if (overlaps(nodes[i]._bbox, nodes[j]._bbox)) overlapCount++;
    }
  }

  onProgress?.({
    phase: "detect",
    message: overlapCount === 0 && oobCount === 0
      ? "布局检测通过，无重叠和越界"
      : `发现 ${overlapCount} 处重叠，${oobCount} 个元素越界`,
    stats: { elements: nodes.length, overlaps: overlapCount, outOfBounds: oobCount, fixed: 0 },
  });
  if (onProgress) await tick();

  // Phase 3: fix layout
  const totalPairs = nodes.length * (nodes.length - 1) / 2 || 1;
  const overlapRatio = overlapCount / totalPairs;
  let fixMethod = "none";

  if (nodes.length > 1) {
    if (overlapRatio > OVERLAP_THRESHOLD || oobCount > nodes.length * 0.5) {
      gridRelayout(nodes);
      fixMethod = "full-relayout";
    } else if (overlapCount > 0 || oobCount > 0) {
      for (const node of nodes) {
        if (isOutOfViewport(node._bbox)) {
          node.x = Math.max(VIEWPORT.minX, Math.min(node.x, VIEWPORT.maxX - node._bbox.w));
          node.y = Math.max(VIEWPORT.minY, Math.min(node.y, VIEWPORT.maxY - node._bbox.h));
          node._bbox.x = node.x;
          node._bbox.y = node.y;
        }
      }
      pushApart(nodes);
      fixMethod = "incremental";
    }
  }

  onProgress?.({
    phase: "layout",
    message: fixMethod === "none"
      ? "布局无需修复"
      : fixMethod === "full-relayout"
        ? `重叠严重，已重新排列 ${nodes.length} 个元素`
        : `已微调 ${overlapCount + oobCount} 个元素位置`,
    stats: { elements: nodes.length, overlaps: overlapCount, outOfBounds: oobCount, fixed: overlapCount + oobCount },
  });
  if (onProgress) await tick();

  // Phase 4: recalc arrows
  const nodeMap = new Map<string, BBox>();
  for (const n of nodes) nodeMap.set(`${n._index}`, n._bbox);
  const fixedArrows = arrows.map((a) => recalcArrow(a, nodeMap));

  onProgress?.({
    phase: "arrows",
    message: arrows.length > 0 ? `已重算 ${arrows.length} 条连线` : "无连线需要修复",
  });

  const fixedNodes: ExcalidrawElementData[] = nodes.map(({ _bbox, _index, ...rest }) => rest);

  onProgress?.({
    phase: "done",
    message: "自查修复完成",
    stats: { elements: elements.length, overlaps: overlapCount, outOfBounds: oobCount, fixed: overlapCount + oobCount + invalidCount },
  });

  return { ...drawing, elements: [...fixedNodes, ...fixedArrows] };
}

export async function validateAndFixAll(drawings: Drawing[], onProgress?: OnProgress): Promise<Drawing[]> {
  const results: Drawing[] = [];
  for (let i = 0; i < drawings.length; i++) {
    const wrappedProgress: OnProgress | undefined = onProgress
      ? (report) => onProgress({ ...report, message: drawings.length > 1 ? `[图${i + 1}/${drawings.length}] ${report.message}` : report.message })
      : undefined;
    results.push(await validateAndFixDrawing(drawings[i], wrappedProgress));
  }
  return results;
}
