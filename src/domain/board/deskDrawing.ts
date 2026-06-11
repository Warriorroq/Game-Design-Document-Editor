import { resolveBoardPoint } from "@/domain/board/boardGeometry";
import type { BoardDrawTool, BoardItem, BoardPoint, BoardShapeType } from "@/domain/types";

export const DEFAULT_PLACE = { x: 120, y: 120 };
export const PASTE_OFFSET = 28;
export const ZOOM_INTENSITY = 0.0012;
export const MIN_SHAPE_LEN = 12;
export const DEFAULT_TEXT_WIDTH = 200;

export function isShapeTool(tool: BoardDrawTool): tool is BoardShapeType {
  return tool !== "pen";
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function shapeLongEnough(
  start: BoardPoint,
  end: BoardPoint,
  boardItems: BoardItem[],
  type: BoardShapeType
) {
  const a = resolveBoardPoint(start, boardItems);
  const b = resolveBoardPoint(end, boardItems);
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  if (type === "box") return dx >= MIN_SHAPE_LEN && dy >= MIN_SHAPE_LEN;
  return Math.hypot(b.x - a.x, b.y - a.y) >= MIN_SHAPE_LEN;
}
