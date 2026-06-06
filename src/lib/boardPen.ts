import { BOARD_TEXT_COLORS } from "./boardTextColors";

export const DEFAULT_PEN_COLOR = "#e8eaf0";
export const DEFAULT_PEN_WIDTH = 4;

export const BOARD_PEN_COLORS = BOARD_TEXT_COLORS;

export const BOARD_PEN_WIDTHS = [2, 4, 8, 12] as const;

export type BoardPenWidth = (typeof BOARD_PEN_WIDTHS)[number];

export interface PenPoint {
  x: number;
  y: number;
}

const MIN_POINT_DIST = 2;

export function appendPenPoint(points: PenPoint[], next: PenPoint): PenPoint[] {
  const last = points[points.length - 1];
  if (!last) return [next];
  if (Math.hypot(next.x - last.x, next.y - last.y) < MIN_POINT_DIST) {
    return points;
  }
  return [...points, next];
}

export function penStrokePath(points: PenPoint[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x} ${p.y} L ${p.x + 0.01} ${p.y}`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}

export function penStrokeLongEnough(points: PenPoint[]): boolean {
  if (points.length >= 2) return true;
  return points.length === 1;
}
