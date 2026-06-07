import { boardBoxBounds, resolveBoardPoint } from "../lib/boardGeometry";
import type { BoardItem, BoardPoint, BoardShape, BoardShapeType } from "../types";

const SHAPE_LINE_HIT_WIDTH = 14;
const SHAPE_BOX_HIT_PAD = 4;
const SHAPE_BOX_MIN_HIT = 14;

interface BoardShapesLayerProps {
  canvasWidth: number;
  canvasHeight: number;
  items: BoardItem[];
  shapes: BoardShape[];
  preview: { type: BoardShapeType; start: BoardPoint; end: BoardPoint } | null;
  selectedShapeIds: ReadonlySet<string>;
  className?: string;
  onShapePointerDown: (e: React.PointerEvent, shapeId: string) => void;
  onEndpointPointerDown: (
    e: React.PointerEvent,
    shapeId: string,
    endpoint: "start" | "end"
  ) => void;
}

function ShapeView({
  shape,
  items,
  selected,
  onShapePointerDown,
  onEndpointPointerDown,
}: {
  shape: BoardShape;
  items: BoardItem[];
  selected: boolean;
  onShapePointerDown: (e: React.PointerEvent) => void;
  onEndpointPointerDown: (
    e: React.PointerEvent,
    endpoint: "start" | "end"
  ) => void;
}) {
  const a = resolveBoardPoint(shape.start, items);
  const b = resolveBoardPoint(shape.end, items);
  const stroke = selected ? "var(--accent)" : "var(--text-muted)";
  const strokeW = selected ? 2.5 : 2;

  if (shape.type === "box") {
    const { x, y, width, height } = boardBoxBounds(a, b);
    if (width < 2 && height < 2) return null;
    const hitX = x - SHAPE_BOX_HIT_PAD;
    const hitY = y - SHAPE_BOX_HIT_PAD;
    const hitWidth = Math.max(width + SHAPE_BOX_HIT_PAD * 2, SHAPE_BOX_MIN_HIT);
    const hitHeight = Math.max(height + SHAPE_BOX_HIT_PAD * 2, SHAPE_BOX_MIN_HIT);
    return (
      <g
        className={`board-shape board-shape--box ${selected ? "selected" : ""}`}
        data-shape-id={shape.id}
        onPointerDown={(e) => {
          e.stopPropagation();
          onShapePointerDown(e);
        }}
      >
        <rect
          className="board-shape-hit board-shape-hit--box"
          x={hitX}
          y={hitY}
          width={hitWidth}
          height={hitHeight}
          fill="transparent"
          stroke="transparent"
          strokeWidth={SHAPE_LINE_HIT_WIDTH}
          rx={6}
        />
        <rect
          className="board-shape-visual"
          x={x}
          y={y}
          width={width}
          height={height}
          fill="rgba(99, 102, 241, 0.12)"
          stroke={stroke}
          strokeWidth={strokeW}
          rx={4}
        />
        {selected && (
          <>
            <Handle cx={a.x} cy={a.y} onPointerDown={(e) => onEndpointPointerDown(e, "start")} />
            <Handle cx={b.x} cy={b.y} onPointerDown={(e) => onEndpointPointerDown(e, "end")} />
          </>
        )}
      </g>
    );
  }

  const markerEnd =
    shape.type === "arrow" ? "url(#board-arrowhead)" : undefined;

  return (
    <g
      className={`board-shape board-shape--${shape.type} ${selected ? "selected" : ""}`}
      data-shape-id={shape.id}
      onPointerDown={(e) => {
        e.stopPropagation();
        onShapePointerDown(e);
      }}
    >
      <line
        className="board-shape-hit"
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke="transparent"
        strokeWidth={SHAPE_LINE_HIT_WIDTH}
        strokeLinecap="round"
      />
      <line
        className="board-shape-visual"
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke={stroke}
        strokeWidth={strokeW}
        markerEnd={markerEnd}
      />
      {selected && (
        <>
          <Handle cx={a.x} cy={a.y} onPointerDown={(e) => onEndpointPointerDown(e, "start")} />
          <Handle cx={b.x} cy={b.y} onPointerDown={(e) => onEndpointPointerDown(e, "end")} />
        </>
      )}
    </g>
  );
}

function Handle({
  cx,
  cy,
  onPointerDown,
}: {
  cx: number;
  cy: number;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  return (
    <circle
      className="board-shape-handle"
      cx={cx}
      cy={cy}
      r={7}
      onPointerDown={(e) => {
        e.stopPropagation();
        onPointerDown(e);
      }}
    />
  );
}

export function BoardShapesLayer({
  canvasWidth,
  canvasHeight,
  items,
  shapes,
  preview,
  selectedShapeIds,
  className = "board-shapes-layer",
  onShapePointerDown,
  onEndpointPointerDown,
}: BoardShapesLayerProps) {
  return (
    <svg
      className={className}
      width={canvasWidth}
      height={canvasHeight}
      aria-hidden
    >
      <defs>
        <marker
          id="board-arrowhead"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L10,5 L0,10 Z" fill="var(--text-muted)" />
        </marker>
      </defs>

      {shapes.map((shape) => (
        <ShapeView
          key={shape.id}
          shape={shape}
          items={items}
          selected={selectedShapeIds.has(shape.id)}
          onShapePointerDown={(e) => onShapePointerDown(e, shape.id)}
          onEndpointPointerDown={(e, endpoint) =>
            onEndpointPointerDown(e, shape.id, endpoint)
          }
        />
      ))}

      {preview && (
        <ShapeView
          shape={{
            id: "__preview",
            type: preview.type,
            start: preview.start,
            end: preview.end,
          }}
          items={items}
          selected={false}
          onShapePointerDown={() => undefined}
          onEndpointPointerDown={() => {}}
        />
      )}
    </svg>
  );
}
