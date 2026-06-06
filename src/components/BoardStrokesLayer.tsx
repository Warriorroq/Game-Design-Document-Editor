import { penStrokePath } from "../lib/boardPen";
import type { BoardStroke } from "../types";

interface BoardStrokesLayerProps {
  canvasWidth: number;
  canvasHeight: number;
  strokes: BoardStroke[];
  preview: {
    points: { x: number; y: number }[];
    color: string;
    width: number;
  } | null;
  selectedStrokeIds: ReadonlySet<string>;
  onStrokePointerDown: (e: React.PointerEvent, strokeId: string) => void;
}

function StrokePath({
  points,
  color,
  width,
  selected,
  strokeId,
  onPointerDown,
}: {
  points: { x: number; y: number }[];
  color: string;
  width: number;
  selected: boolean;
  strokeId: string;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const d = penStrokePath(points);
  if (!d) return null;

  const hitWidth = Math.max(width + 10, 14);

  return (
    <g
      className={`board-stroke ${selected ? "selected" : ""}`}
      data-stroke-id={strokeId}
      onPointerDown={(e) => {
        e.stopPropagation();
        onPointerDown(e);
      }}
    >
      <path
        className="board-stroke-hit"
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={hitWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className="board-stroke-line"
        d={d}
        fill="none"
        stroke={selected ? "var(--accent)" : color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

export function BoardStrokesLayer({
  canvasWidth,
  canvasHeight,
  strokes,
  preview,
  selectedStrokeIds,
  onStrokePointerDown,
}: BoardStrokesLayerProps) {
  return (
    <svg
      className="board-strokes-layer"
      width={canvasWidth}
      height={canvasHeight}
      aria-hidden
    >
      {strokes.map((stroke) => (
        <StrokePath
          key={stroke.id}
          strokeId={stroke.id}
          points={stroke.points}
          color={stroke.color}
          width={stroke.width}
          selected={selectedStrokeIds.has(stroke.id)}
          onPointerDown={(e) => onStrokePointerDown(e, stroke.id)}
        />
      ))}
      {preview && preview.points.length > 0 && (
        <path
          className="board-stroke-line board-stroke-line--preview"
          d={penStrokePath(preview.points)}
          fill="none"
          stroke={preview.color}
          strokeWidth={preview.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      )}
    </svg>
  );
}
