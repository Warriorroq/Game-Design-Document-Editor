import type { BoardGroup } from "../types";
import type { DeskSelection } from "./deskClipboard";

export function findGroupForItem(
  groups: BoardGroup[],
  itemId: string
): BoardGroup | undefined {
  return groups.find((g) => g.memberItemIds.includes(itemId));
}

export function findGroupForShape(
  groups: BoardGroup[],
  shapeId: string
): BoardGroup | undefined {
  return groups.find((g) => g.memberShapeIds.includes(shapeId));
}

export function findGroupForText(
  groups: BoardGroup[],
  textId: string
): BoardGroup | undefined {
  return groups.find((g) => g.memberTextIds.includes(textId));
}

export function findGroupForStroke(
  groups: BoardGroup[],
  strokeId: string
): BoardGroup | undefined {
  return groups.find((g) => g.memberStrokeIds.includes(strokeId));
}

export function groupMemberIds(group: BoardGroup): string[] {
  return [
    ...group.memberItemIds,
    ...group.memberShapeIds,
    ...group.memberTextIds,
    ...group.memberStrokeIds,
  ];
}

export function selectionFromGroup(group: BoardGroup): DeskSelection {
  return {
    itemIds: [...group.memberItemIds],
    shapeIds: [...group.memberShapeIds],
    textIds: [...group.memberTextIds],
    strokeIds: [...group.memberStrokeIds],
  };
}

export function mergeSelections(a: DeskSelection, b: DeskSelection): DeskSelection {
  return {
    itemIds: [...new Set([...a.itemIds, ...b.itemIds])],
    shapeIds: [...new Set([...a.shapeIds, ...b.shapeIds])],
    textIds: [...new Set([...a.textIds, ...b.textIds])],
    strokeIds: [...new Set([...a.strokeIds, ...b.strokeIds])],
  };
}

export function removeMembersFromGroups(
  groups: BoardGroup[],
  itemIds: string[],
  shapeIds: string[],
  textIds: string[] = [],
  strokeIds: string[] = []
): BoardGroup[] {
  const itemSet = new Set(itemIds);
  const shapeSet = new Set(shapeIds);
  const textSet = new Set(textIds);
  const strokeSet = new Set(strokeIds);

  return groups
    .map((g) => ({
      ...g,
      memberItemIds: g.memberItemIds.filter((id) => !itemSet.has(id)),
      memberShapeIds: g.memberShapeIds.filter((id) => !shapeSet.has(id)),
      memberTextIds: g.memberTextIds.filter((id) => !textSet.has(id)),
      memberStrokeIds: g.memberStrokeIds.filter((id) => !strokeSet.has(id)),
    }))
    .filter(
      (g) =>
        g.memberItemIds.length +
          g.memberShapeIds.length +
          g.memberTextIds.length +
          g.memberStrokeIds.length >=
        2
    );
}

export function groupsTouchingSelection(
  groups: BoardGroup[],
  selection: DeskSelection
): BoardGroup[] {
  const itemSet = new Set(selection.itemIds);
  const shapeSet = new Set(selection.shapeIds);
  const textSet = new Set(selection.textIds);
  const strokeSet = new Set(selection.strokeIds);
  return groups.filter(
    (g) =>
      g.memberItemIds.some((id) => itemSet.has(id)) ||
      g.memberShapeIds.some((id) => shapeSet.has(id)) ||
      g.memberTextIds.some((id) => textSet.has(id)) ||
      g.memberStrokeIds.some((id) => strokeSet.has(id))
  );
}

export function selectionCount(selection: DeskSelection): number {
  return (
    selection.itemIds.length +
    selection.shapeIds.length +
    selection.textIds.length +
    selection.strokeIds.length
  );
}

/** Exactly one board image selected, nothing else. */
export function isSingleImageSelection(selection: DeskSelection): boolean {
  return (
    selection.itemIds.length === 1 &&
    selection.shapeIds.length === 0 &&
    selection.textIds.length === 0 &&
    selection.strokeIds.length === 0
  );
}

export function applyDeskSelectClick(
  kind: "item" | "shape" | "text" | "stroke",
  id: string,
  shiftKey: boolean,
  prev: DeskSelection,
  groups: BoardGroup[]
): DeskSelection {
  if (shiftKey) {
    if (kind === "item") {
      const itemIds = new Set(prev.itemIds);
      if (itemIds.has(id)) itemIds.delete(id);
      else itemIds.add(id);
      return {
        itemIds: [...itemIds],
        shapeIds: [...prev.shapeIds],
        textIds: [...prev.textIds],
        strokeIds: [...prev.strokeIds],
      };
    }
    if (kind === "shape") {
      const shapeIds = new Set(prev.shapeIds);
      if (shapeIds.has(id)) shapeIds.delete(id);
      else shapeIds.add(id);
      return {
        itemIds: [...prev.itemIds],
        shapeIds: [...shapeIds],
        textIds: [...prev.textIds],
        strokeIds: [...prev.strokeIds],
      };
    }
    if (kind === "text") {
      const textIds = new Set(prev.textIds);
      if (textIds.has(id)) textIds.delete(id);
      else textIds.add(id);
      return {
        itemIds: [...prev.itemIds],
        shapeIds: [...prev.shapeIds],
        textIds: [...textIds],
        strokeIds: [...prev.strokeIds],
      };
    }
    const strokeIds = new Set(prev.strokeIds);
    if (strokeIds.has(id)) strokeIds.delete(id);
    else strokeIds.add(id);
    return {
      itemIds: [...prev.itemIds],
      shapeIds: [...prev.shapeIds],
      textIds: [...prev.textIds],
      strokeIds: [...strokeIds],
    };
  }

  const alreadySelected =
    (kind === "item" && prev.itemIds.includes(id)) ||
    (kind === "shape" && prev.shapeIds.includes(id)) ||
    (kind === "text" && prev.textIds.includes(id)) ||
    (kind === "stroke" && prev.strokeIds.includes(id));
  if (alreadySelected && selectionCount(prev) > 1) {
    return prev;
  }

  if (kind === "item") {
    const group = findGroupForItem(groups, id);
    if (group) return selectionFromGroup(group);
    return { itemIds: [id], shapeIds: [], textIds: [], strokeIds: [] };
  }

  if (kind === "shape") {
    const group = findGroupForShape(groups, id);
    if (group) return selectionFromGroup(group);
    return { itemIds: [], shapeIds: [id], textIds: [], strokeIds: [] };
  }

  if (kind === "text") {
    const group = findGroupForText(groups, id);
    if (group) return selectionFromGroup(group);
    return { itemIds: [], shapeIds: [], textIds: [id], strokeIds: [] };
  }

  const group = findGroupForStroke(groups, id);
  if (group) return selectionFromGroup(group);
  return { itemIds: [], shapeIds: [], textIds: [], strokeIds: [id] };
}

const DRAG_THRESHOLD_PX = 4;

/** Run onDrag only after the pointer moves past a click threshold. */
export function armDragAfterThreshold(
  e: React.PointerEvent | PointerEvent,
  onDrag: () => void,
  threshold = DRAG_THRESHOLD_PX
) {
  const startX = e.clientX;
  const startY = e.clientY;

  const onMove = (ev: PointerEvent) => {
    if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < threshold) return;
    cleanup();
    onDrag();
  };

  const onUp = () => cleanup();

  const cleanup = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}
