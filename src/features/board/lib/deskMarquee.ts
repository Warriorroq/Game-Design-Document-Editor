import { boardBoxBounds, resolveBoardPoint } from "@/features/board/lib/boardGeometry";
import type { DeskSelection } from "@/features/board/lib/deskClipboard";
import {
  mergeSelections,
  selectionFromGroup,
} from "@/features/board/lib/deskGroups";
import type {
  BoardGroup,
  BoardItem,
  BoardPoint,
  BoardShape,
  BoardStroke,
  BoardText,
} from "@/shared/types";

export interface BoardRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function boardRectFromPoints(
  start: BoardPoint,
  end: BoardPoint
): BoardRect {
  return boardBoxBounds(start, end);
}

function rectsIntersect(a: BoardRect, b: BoardRect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function itemRect(item: BoardItem): BoardRect {
  return { x: item.x, y: item.y, width: item.width, height: item.height };
}

function textRect(text: BoardText): BoardRect {
  const fontSize = text.fontSize ?? 14;
  const lineHeight = fontSize * 1.35;
  const lines = Math.max(1, text.content.split("\n").length);
  const padding = 8;
  return {
    x: text.x,
    y: text.y,
    width: text.width,
    height: Math.max(lineHeight, lines * lineHeight) + padding,
  };
}

function shapeRect(shape: BoardShape, items: BoardItem[]): BoardRect {
  const a = resolveBoardPoint(shape.start, items);
  const b = resolveBoardPoint(shape.end, items);
  if (shape.type === "box") {
    return boardBoxBounds(a, b);
  }
  const pad = 4;
  return boardBoxBounds(
    { x: a.x - pad, y: a.y - pad },
    { x: b.x + pad, y: b.y + pad }
  );
}

function strokeRect(stroke: BoardStroke): BoardRect {
  if (stroke.points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const pad = stroke.width / 2 + 2;
  let minX = stroke.points[0].x;
  let minY = stroke.points[0].y;
  let maxX = stroke.points[0].x;
  let maxY = stroke.points[0].y;
  for (const p of stroke.points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return {
    x: minX - pad,
    y: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  };
}

function expandSelectionWithGroups(
  raw: DeskSelection,
  groups: BoardGroup[]
): DeskSelection {
  let result: DeskSelection = {
    itemIds: [...raw.itemIds],
    shapeIds: [...raw.shapeIds],
    textIds: [...raw.textIds],
    strokeIds: [...raw.strokeIds],
  };

  for (const group of groups) {
    const itemSet = new Set(result.itemIds);
    const shapeSet = new Set(result.shapeIds);
    const textSet = new Set(result.textIds);
    const strokeSet = new Set(result.strokeIds);
    const touches =
      group.memberItemIds.some((id) => itemSet.has(id)) ||
      group.memberShapeIds.some((id) => shapeSet.has(id)) ||
      group.memberTextIds.some((id) => textSet.has(id)) ||
      group.memberStrokeIds.some((id) => strokeSet.has(id));
    if (touches) {
      result = mergeSelections(result, selectionFromGroup(group));
    }
  }

  return result;
}

export function selectionFromMarqueeRect(
  rect: BoardRect,
  items: BoardItem[],
  shapes: BoardShape[],
  texts: BoardText[],
  strokes: BoardStroke[],
  groups: BoardGroup[],
  shiftKey: boolean,
  prev: DeskSelection
): DeskSelection {
  const raw: DeskSelection = {
    itemIds: items
      .filter((item) => rectsIntersect(rect, itemRect(item)))
      .map((item) => item.id),
    shapeIds: shapes
      .filter((shape) => rectsIntersect(rect, shapeRect(shape, items)))
      .map((shape) => shape.id),
    textIds: texts
      .filter((text) => rectsIntersect(rect, textRect(text)))
      .map((text) => text.id),
    strokeIds: strokes
      .filter((stroke) => rectsIntersect(rect, strokeRect(stroke)))
      .map((stroke) => stroke.id),
  };

  const expanded = expandSelectionWithGroups(raw, groups);
  return shiftKey ? mergeSelections(prev, expanded) : expanded;
}
