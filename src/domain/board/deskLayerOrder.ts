import type { DeskSelection } from "@/domain/board/deskClipboard";
import type { BoardShape, BoardStroke, BoardText, BoardItem } from "@/domain/types";

type Direction = "forward" | "backward";

function reorderWithinSubset<T extends { id: string }>(
  arr: T[],
  id: string,
  predicate: (item: T) => boolean,
  direction: Direction
): T[] {
  const subset = arr.filter(predicate);
  const idx = subset.findIndex((item) => item.id === id);
  if (idx < 0) return arr;
  const swapIdx = direction === "forward" ? idx + 1 : idx - 1;
  if (swapIdx < 0 || swapIdx >= subset.length) return arr;

  const nextSubset = [...subset];
  [nextSubset[idx], nextSubset[swapIdx]] = [nextSubset[swapIdx], nextSubset[idx]];

  let subsetIdx = 0;
  return arr.map((item) => (predicate(item) ? nextSubset[subsetIdx++]! : item));
}

function reorderSelection<T extends { id: string }>(
  arr: T[],
  ids: string[],
  predicate: (item: T) => boolean,
  direction: Direction
): T[] {
  const idSet = new Set(ids);
  const orderedIds = arr
    .filter((item) => predicate(item) && idSet.has(item.id))
    .map((item) => item.id);

  let result = arr;
  if (direction === "forward") {
    for (let i = orderedIds.length - 1; i >= 0; i--) {
      result = reorderWithinSubset(result, orderedIds[i]!, predicate, direction);
    }
  } else {
    for (const id of orderedIds) {
      result = reorderWithinSubset(result, id, predicate, direction);
    }
  }
  return result;
}

function canMoveInSubset<T extends { id: string }>(
  arr: T[],
  ids: string[],
  predicate: (item: T) => boolean,
  direction: Direction
): boolean {
  const idSet = new Set(ids);
  const subset = arr.filter(predicate);
  const indices = subset
    .map((item, i) => (idSet.has(item.id) ? i : -1))
    .filter((i) => i >= 0);
  if (indices.length === 0) return false;
  const min = Math.min(...indices);
  const max = Math.max(...indices);
  return direction === "forward" ? max < subset.length - 1 : min > 0;
}

export interface DeskLayerState {
  items: BoardItem[];
  shapes: BoardShape[];
  texts: BoardText[];
  strokes: BoardStroke[];
}

export function reorderDeskLayer(
  state: DeskLayerState,
  selection: DeskSelection,
  direction: Direction
): DeskLayerState {
  let { items, shapes, texts, strokes } = state;

  if (selection.itemIds.length > 0) {
    items = reorderSelection(items, selection.itemIds, () => true, direction);
  }

  if (selection.shapeIds.length > 0) {
    const shapeMap = new Map(shapes.map((s) => [s.id, s] as const));
    const boxIds = selection.shapeIds.filter((id) => shapeMap.get(id)?.type === "box");
    const lineIds = selection.shapeIds.filter((id) => shapeMap.get(id)?.type !== "box");
    if (boxIds.length > 0) {
      shapes = reorderSelection(shapes, boxIds, (sh) => sh.type === "box", direction);
    }
    if (lineIds.length > 0) {
      shapes = reorderSelection(
        shapes,
        lineIds,
        (sh) => sh.type !== "box",
        direction
      );
    }
  }

  if (selection.textIds.length > 0) {
    texts = reorderSelection(texts, selection.textIds, () => true, direction);
  }

  if (selection.strokeIds.length > 0) {
    strokes = reorderSelection(strokes, selection.strokeIds, () => true, direction);
  }

  return { items, shapes, texts, strokes };
}

export function canReorderDeskLayer(
  state: DeskLayerState,
  selection: DeskSelection,
  direction: Direction
): boolean {
  const { items, shapes, texts, strokes } = state;
  const shapeMap = new Map(shapes.map((s) => [s.id, s] as const));
  const boxIds = selection.shapeIds.filter((id) => shapeMap.get(id)?.type === "box");
  const lineIds = selection.shapeIds.filter((id) => shapeMap.get(id)?.type !== "box");

  return (
    (selection.itemIds.length > 0 &&
      canMoveInSubset(items, selection.itemIds, () => true, direction)) ||
    (boxIds.length > 0 &&
      canMoveInSubset(shapes, boxIds, (sh) => sh.type === "box", direction)) ||
    (lineIds.length > 0 &&
      canMoveInSubset(shapes, lineIds, (sh) => sh.type !== "box", direction)) ||
    (selection.textIds.length > 0 &&
      canMoveInSubset(texts, selection.textIds, () => true, direction)) ||
    (selection.strokeIds.length > 0 &&
      canMoveInSubset(strokes, selection.strokeIds, () => true, direction))
  );
}
