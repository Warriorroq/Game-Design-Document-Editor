import type { BoardAttach, BoardItem, BoardPoint } from "@/shared/types";

export type BoardEdge = BoardAttach["edge"];

const CORNERS: BoardEdge[] = ["nw", "ne", "sw", "se"];

export function pointFromAttach(
  item: BoardItem,
  attach: BoardAttach
): { x: number; y: number } {
  const { x, y, width: w, height: h } = item;
  const t = attach.t ?? 0.5;

  switch (attach.edge) {
    case "n":
      return { x: x + w * t, y };
    case "s":
      return { x: x + w * t, y: y + h };
    case "w":
      return { x, y: y + h * t };
    case "e":
      return { x: x + w, y: y + h * t };
    case "nw":
      return { x, y };
    case "ne":
      return { x: x + w, y };
    case "sw":
      return { x, y: y + h };
    case "se":
      return { x: x + w, y: y + h };
    case "center":
    default:
      return { x: x + w / 2, y: y + h / 2 };
  }
}

export function resolveBoardPoint(
  point: BoardPoint,
  items: BoardItem[]
): { x: number; y: number } {
  if (!point.attach) return { x: point.x, y: point.y };
  const item = items.find((i) => i.id === point.attach!.itemId);
  if (!item) return { x: point.x, y: point.y };
  return pointFromAttach(item, point.attach);
}

interface EdgeHit {
  itemId: string;
  edge: BoardEdge;
  t?: number;
  x: number;
  y: number;
  dist: number;
}

function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { dist: number; t: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return { dist: Math.hypot(px - x1, py - y1), t: 0 };
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return { dist: Math.hypot(px - cx, py - cy), t };
}

function hitsForItem(
  px: number,
  py: number,
  item: BoardItem,
  threshold: number
): EdgeHit[] {
  const { x, y, width: w, height: h } = item;
  const hits: EdgeHit[] = [];

  const addEdge = (
    edge: BoardEdge,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ) => {
    const { dist, t } = distToSegment(px, py, x1, y1, x2, y2);
    if (dist <= threshold) {
      const cx = x1 + t * (x2 - x1);
      const cy = y1 + t * (y2 - y1);
      hits.push({ itemId: item.id, edge, t, x: cx, y: cy, dist });
    }
  };

  addEdge("n", x, y, x + w, y);
  addEdge("s", x, y + h, x + w, y + h);
  addEdge("w", x, y, x, y + h);
  addEdge("e", x + w, y, x + w, y + h);

  for (const edge of CORNERS) {
    const p = pointFromAttach(item, { itemId: item.id, edge });
    const d = Math.hypot(px - p.x, py - p.y);
    if (d <= threshold) {
      hits.push({ itemId: item.id, edge, x: p.x, y: p.y, dist: d });
    }
  }

  const center = pointFromAttach(item, {
    itemId: item.id,
    edge: "center",
  });
  const cd = Math.hypot(px - center.x, py - center.y);
  if (cd <= threshold) {
    hits.push({
      itemId: item.id,
      edge: "center",
      x: center.x,
      y: center.y,
      dist: cd,
    });
  }

  return hits;
}

export function snapBoardPoint(
  x: number,
  y: number,
  items: BoardItem[],
  threshold = 14
): BoardPoint {
  let best: EdgeHit | null = null;

  for (const item of items) {
    for (const hit of hitsForItem(x, y, item, threshold)) {
      if (!best || hit.dist < best.dist) best = hit;
    }
  }

  if (!best) return { x, y };

  const attach: BoardAttach = {
    itemId: best.itemId,
    edge: best.edge,
  };
  if (best.t !== undefined && !CORNERS.includes(best.edge) && best.edge !== "center") {
    attach.t = best.t;
  }

  return { x: best.x, y: best.y, attach };
}

export function boardBoxBounds(
  start: { x: number; y: number },
  end: { x: number; y: number }
) {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  return { x, y, width, height };
}
