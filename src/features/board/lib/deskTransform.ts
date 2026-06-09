import type { BoardPoint, BoardShape } from "@/shared/types";

export function translateShapeForDrag(
  shape: BoardShape,
  dx: number,
  dy: number,
  movedItemIds: Set<string>
): Pick<BoardShape, "start" | "end"> {
  const movePoint = (point: BoardPoint): BoardPoint => {
    if (point.attach?.itemId && movedItemIds.has(point.attach.itemId)) {
      return point;
    }
    return { x: point.x + dx, y: point.y + dy };
  };

  return {
    start: movePoint(shape.start),
    end: movePoint(shape.end),
  };
}
