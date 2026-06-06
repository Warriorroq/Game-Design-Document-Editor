import type {
  BoardGroup,
  BoardItem,
  BoardPoint,
  BoardShape,
  BoardStroke,
  BoardText,
} from "../types";

export interface DeskClipboard {
  items: BoardItem[];
  shapes: BoardShape[];
  texts: BoardText[];
  strokes: BoardStroke[];
  groups: BoardGroup[];
}

export interface DeskSelection {
  itemIds: string[];
  shapeIds: string[];
  textIds: string[];
  strokeIds: string[];
}

const PASTE_OFFSET = 28;

function clonePoint(
  point: BoardPoint,
  idMap: Map<string, string>,
  dx: number,
  dy: number
): BoardPoint {
  const next: BoardPoint = {
    x: point.x + dx,
    y: point.y + dy,
  };
  if (point.attach) {
    const mapped = idMap.get(point.attach.itemId);
    if (mapped) {
      next.attach = { ...point.attach, itemId: mapped };
      return next;
    }
  }
  return next;
}

export function buildDeskClipboard(
  items: BoardItem[],
  shapes: BoardShape[],
  texts: BoardText[],
  strokes: BoardStroke[],
  groups: BoardGroup[],
  selection: DeskSelection
): DeskClipboard | null {
  const itemSet = new Set(selection.itemIds);
  const shapeSet = new Set(selection.shapeIds);
  const textSet = new Set(selection.textIds);
  const strokeSet = new Set(selection.strokeIds);
  if (
    itemSet.size === 0 &&
    shapeSet.size === 0 &&
    textSet.size === 0 &&
    strokeSet.size === 0
  ) {
    return null;
  }

  const clipItems = items.filter((i) => itemSet.has(i.id));
  const clipShapes = shapes.filter((s) => shapeSet.has(s.id));
  const clipTexts = texts.filter((t) => textSet.has(t.id));
  const clipStrokes = strokes.filter((s) => strokeSet.has(s.id));
  const clipGroups = groups
    .map((g) => ({
      ...g,
      memberItemIds: g.memberItemIds.filter((id) => itemSet.has(id)),
      memberShapeIds: g.memberShapeIds.filter((id) => shapeSet.has(id)),
      memberTextIds: g.memberTextIds.filter((id) => textSet.has(id)),
      memberStrokeIds: g.memberStrokeIds.filter((id) => strokeSet.has(id)),
    }))
    .filter(
      (g) =>
        g.memberItemIds.length +
          g.memberShapeIds.length +
          g.memberTextIds.length +
          g.memberStrokeIds.length >=
        2
    );

  return {
    items: clipItems.map((i) => ({ ...i })),
    shapes: clipShapes.map((s) => ({
      ...s,
      start: { ...s.start, attach: s.start.attach ? { ...s.start.attach } : undefined },
      end: { ...s.end, attach: s.end.attach ? { ...s.end.attach } : undefined },
    })),
    texts: clipTexts.map((t) => ({ ...t })),
    strokes: clipStrokes.map((s) => ({
      ...s,
      points: s.points.map((p) => ({ ...p })),
    })),
    groups: clipGroups,
  };
}

export function pasteDeskClipboard(
  clipboard: DeskClipboard,
  origin?: { x: number; y: number }
): {
  items: BoardItem[];
  shapes: BoardShape[];
  texts: BoardText[];
  strokes: BoardStroke[];
  groups: BoardGroup[];
  selection: DeskSelection;
} {
  const idMap = new Map<string, string>();

  let minX = Infinity;
  let minY = Infinity;
  for (const item of clipboard.items) {
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
  }
  for (const shape of clipboard.shapes) {
    minX = Math.min(minX, shape.start.x, shape.end.x);
    minY = Math.min(minY, shape.start.y, shape.end.y);
  }
  for (const text of clipboard.texts) {
    minX = Math.min(minX, text.x);
    minY = Math.min(minY, text.y);
  }
  for (const stroke of clipboard.strokes) {
    for (const p of stroke.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
    }
  }

  const baseX = origin?.x ?? minX + PASTE_OFFSET;
  const baseY = origin?.y ?? minY + PASTE_OFFSET;
  const dx = Number.isFinite(minX) ? baseX - minX : PASTE_OFFSET;
  const dy = Number.isFinite(minY) ? baseY - minY : PASTE_OFFSET;

  const newItems: BoardItem[] = clipboard.items.map((item) => {
    const id = crypto.randomUUID();
    idMap.set(item.id, id);
    return {
      ...item,
      id,
      x: item.x + dx,
      y: item.y + dy,
    };
  });

  const newShapes: BoardShape[] = clipboard.shapes.map((shape) => {
    const id = crypto.randomUUID();
    idMap.set(shape.id, id);
    return {
      ...shape,
      id,
      start: clonePoint(shape.start, idMap, dx, dy),
      end: clonePoint(shape.end, idMap, dx, dy),
    };
  });

  const newTexts: BoardText[] = clipboard.texts.map((text) => {
    const id = crypto.randomUUID();
    idMap.set(text.id, id);
    return {
      ...text,
      id,
      x: text.x + dx,
      y: text.y + dy,
    };
  });

  const newStrokes: BoardStroke[] = clipboard.strokes.map((stroke) => {
    const id = crypto.randomUUID();
    idMap.set(stroke.id, id);
    return {
      ...stroke,
      id,
      points: stroke.points.map((p) => ({
        x: p.x + dx,
        y: p.y + dy,
      })),
    };
  });

  const newGroups: BoardGroup[] = clipboard.groups.map((group) => ({
    id: crypto.randomUUID(),
    memberItemIds: group.memberItemIds
      .map((id) => idMap.get(id))
      .filter((id): id is string => Boolean(id)),
    memberShapeIds: group.memberShapeIds
      .map((id) => idMap.get(id))
      .filter((id): id is string => Boolean(id)),
    memberTextIds: group.memberTextIds
      .map((id) => idMap.get(id))
      .filter((id): id is string => Boolean(id)),
    memberStrokeIds: group.memberStrokeIds
      .map((id) => idMap.get(id))
      .filter((id): id is string => Boolean(id)),
  }));

  return {
    items: newItems,
    shapes: newShapes,
    texts: newTexts,
    strokes: newStrokes,
    groups: newGroups,
    selection: {
      itemIds: newItems.map((i) => i.id),
      shapeIds: newShapes.map((s) => s.id),
      textIds: newTexts.map((t) => t.id),
      strokeIds: newStrokes.map((s) => s.id),
    },
  };
}
