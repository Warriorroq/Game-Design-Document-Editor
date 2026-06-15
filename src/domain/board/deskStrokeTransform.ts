import type { BoardStroke } from "@/domain/types";

export function translateStroke(
  stroke: BoardStroke,
  dx: number,
  dy: number
): Pick<BoardStroke, "points"> {
  return {
    points: stroke.points.map((p) => ({
      x: p.x + dx,
      y: p.y + dy,
    })),
  };
}
