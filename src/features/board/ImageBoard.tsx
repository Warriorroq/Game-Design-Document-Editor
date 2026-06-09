import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BoardShapesLayer } from "./components/BoardShapesLayer";
import { BoardStrokesLayer } from "./components/BoardStrokesLayer";
import { BoardToolbar } from "./components/BoardToolbar";
import { BoardTextsLayer } from "./components/BoardTextsLayer";
import { DeskContextMenu } from "./components/DeskContextMenu";
import { useBoardSize } from "@/shared/context/BoardSizeContext";
import { useLocale } from "@/shared/context/LocaleContext";
import { useShortcuts } from "@/shared/context/ShortcutsContext";
import { useLinkContext } from "@/features/links/LinkContext";
import {
  buildDeskClipboard,
  pasteDeskClipboard,
  type DeskClipboard,
  type DeskSelection,
} from "@/features/board/lib/deskClipboard";
import {
  applyDeskSelectClick,
  armDragAfterThreshold,
  groupsTouchingSelection,
  isSingleImageSelection,
  selectionCount,
} from "@/features/board/lib/deskGroups";
import {
  boardRectFromPoints,
  selectionFromMarqueeRect,
} from "@/features/board/lib/deskMarquee";
import { translateStroke } from "@/features/board/lib/deskStrokeTransform";
import { translateShapeForDrag } from "@/features/board/lib/deskTransform";
import {
  appendPenPoint,
  DEFAULT_PEN_COLOR,
  DEFAULT_PEN_WIDTH,
  penStrokeLongEnough,
} from "@/features/board/lib/boardPen";
import {
  blobToDataUrl,
  getImageFromClipboard,
  loadImageDimensions,
} from "@/shared/lib/imageUtils";
import {
  boardItemTransform,
  pointerAngleRad,
  rotationDeltaDeg,
  snapRotationAngle,
} from "@/features/board/lib/boardItemTransform";
import { resolveBoardPoint, snapBoardPoint } from "@/features/board/lib/boardGeometry";
import { canReorderDeskLayer } from "@/features/board/lib/deskLayerOrder";
import {
  BOARD_MAX_SCALE,
  constrainBoardViewport,
  fitBoardViewport,
  type BoardViewport,
} from "@/features/board/lib/boardViewport";
import { buildMediaHref, buildTextHref } from "@/features/links/lib/links";
import { HIGHLIGHT_FLASH_MS } from "@/shared/lib/searchHighlight";
import type {
  BoardGroup,
  BoardItem,
  BoardPoint,
  BoardDrawTool,
  BoardShape,
  BoardShapeType,
  BoardStroke,
  BoardText,
} from "@/shared/types";
import "./Board.css";

interface ImageBoardProps {
  projectId: string;
  sectionId: string;
  items: BoardItem[];
  shapes: BoardShape[];
  strokes: BoardStroke[];
  texts: BoardText[];
  groups: BoardGroup[];
  highlightMediaId?: string | null;
  highlightTextId?: string | null;
  onHighlightDone?: () => void;
  onAdd: (item: BoardItem) => void;
  onUpdate: (id: string, patch: Partial<BoardItem>) => void;
  onRemove: (id: string) => void;
  onAddShape: (shape: BoardShape) => void;
  onUpdateShape: (id: string, patch: Partial<BoardShape>) => void;
  onRemoveShape: (id: string) => void;
  onAddStroke: (stroke: BoardStroke) => void;
  onUpdateStroke: (id: string, patch: Partial<BoardStroke>) => void;
  onRemoveStroke: (id: string) => void;
  onAddText: (text: BoardText) => void;
  onUpdateText: (
    id: string,
    patch: Partial<BoardText>,
    options?: { recordHistory?: boolean }
  ) => void;
  onRemoveText: (id: string) => void;
  onAddGroup: (group: BoardGroup) => void;
  onRemoveGroup: (groupId: string) => void;
  onPasteDesk: (payload: {
    items: BoardItem[];
    shapes: BoardShape[];
    texts: BoardText[];
    strokes: BoardStroke[];
    groups: BoardGroup[];
  }) => void;
  onRemoveSelection: (
    itemIds: string[],
    shapeIds: string[],
    textIds: string[],
    strokeIds: string[]
  ) => void;
  onReorderLayer: (
    selection: DeskSelection,
    direction: "forward" | "backward"
  ) => void;
  onBeginTransientEdit?: () => void;
  onEndTransientEdit?: () => void;
  resolveItemSrc: (item: BoardItem) => string;
  deskClipboard: DeskClipboard | null;
  onStoreDeskClipboard: (clip: DeskClipboard | null) => void;
}

const DEFAULT_PLACE = { x: 120, y: 120 };
const PASTE_OFFSET = 28;
const ZOOM_INTENSITY = 0.0012;
const MIN_SHAPE_LEN = 12;
const EMPTY_SELECTION: DeskSelection = {
  itemIds: [],
  shapeIds: [],
  textIds: [],
  strokeIds: [],
};
const DEFAULT_TEXT_WIDTH = 200;

function isShapeTool(tool: BoardDrawTool): tool is BoardShapeType {
  return tool !== "pen";
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function shapeLongEnough(
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

export function ImageBoard({
  projectId,
  sectionId,
  items,
  shapes,
  strokes,
  texts,
  groups,
  highlightMediaId,
  highlightTextId,
  onHighlightDone,
  onAdd,
  onUpdate,
  onRemove,
  onAddShape,
  onUpdateShape,
  onRemoveShape: _onRemoveShape,
  onAddStroke,
  onUpdateStroke,
  onRemoveStroke: _onRemoveStroke,
  onAddText,
  onUpdateText,
  onRemoveText,
  onAddGroup,
  onRemoveGroup,
  onPasteDesk,
  onRemoveSelection,
  onReorderLayer,
  onBeginTransientEdit,
  onEndTransientEdit,
  resolveItemSrc,
  deskClipboard,
  onStoreDeskClipboard,
}: ImageBoardProps) {
  const { t } = useLocale();
  const { width: canvasWidth, height: canvasHeight } = useBoardSize();
  const { matches: shortcutMatches } = useShortcuts();
  const { openContextMenu } = useLinkContext();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const surfaceSizeRef = useRef({ w: 0, h: 0 });
  const pasteCount = useRef(0);
  const cursorRef = useRef({ x: DEFAULT_PLACE.x, y: DEFAULT_PLACE.y });
  const panSession = useRef<{
    startX: number;
    startY: number;
    origPanX: number;
    origPanY: number;
    moved: boolean;
    button: number;
  } | null>(null);
  const marqueeSession = useRef<{
    startWorld: BoardPoint;
    shiftKey: boolean;
    moved: boolean;
  } | null>(null);
  const drawSession = useRef<{
    type: BoardShapeType;
    start: BoardPoint;
  } | null>(null);
  const penSession = useRef<{ points: BoardPoint[] } | null>(null);
  const spaceHeld = useRef(false);

  const [selection, setSelection] = useState<DeskSelection>(EMPTY_SELECTION);
  const [activeTool, setActiveTool] = useState<BoardDrawTool | null>(null);
  const [penColor, setPenColor] = useState(DEFAULT_PEN_COLOR);
  const [penWidth, setPenWidth] = useState(DEFAULT_PEN_WIDTH);
  const [penPreview, setPenPreview] = useState<{
    points: BoardPoint[];
    color: string;
    width: number;
  } | null>(null);
  const [drawPreview, setDrawPreview] = useState<{
    type: BoardShapeType;
    start: BoardPoint;
    end: BoardPoint;
  } | null>(null);
  const [marqueePreview, setMarqueePreview] = useState<{
    start: BoardPoint;
    end: BoardPoint;
  } | null>(null);
  const [deskMenu, setDeskMenu] = useState<{ x: number; y: number } | null>(
    null
  );
  const [pasteHint, setPasteHint] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<BoardViewport>({
    scale: 1,
    panX: 0,
    panY: 0,
  });

  const selectedShapeIds = useMemo(
    () => new Set(selection.shapeIds),
    [selection.shapeIds]
  );
  const selectedItemSet = useMemo(
    () => new Set(selection.itemIds),
    [selection.itemIds]
  );
  const selectedTextIds = useMemo(
    () => new Set(selection.textIds),
    [selection.textIds]
  );
  const selectedStrokeIds = useMemo(
    () => new Set(selection.strokeIds),
    [selection.strokeIds]
  );
  const boxShapes = useMemo(
    () => shapes.filter((shape) => shape.type === "box"),
    [shapes]
  );
  const lineShapes = useMemo(
    () => shapes.filter((shape) => shape.type !== "box"),
    [shapes]
  );
  const boxDrawPreview = drawPreview?.type === "box" ? drawPreview : null;
  const lineDrawPreview =
    drawPreview && drawPreview.type !== "box" ? drawPreview : null;
  const selectionSize = selectionCount(selection);
  const penMode = activeTool === "pen";
  const isDrawing = activeTool !== null;

  const setPenMode = useCallback((enabled: boolean) => {
    if (!enabled) {
      penSession.current = null;
      setPenPreview(null);
    }
    drawSession.current = null;
    setDrawPreview(null);
    setActiveTool(enabled ? "pen" : null);
  }, []);

  const canGroup = selectionSize >= 2;
  const canUngroup = groupsTouchingSelection(groups, selection).length > 0;
  const canCopy = selectionSize > 0;
  const canPasteDesk = Boolean(deskClipboard);

  const clearSelection = useCallback(() => {
    setSelection(EMPTY_SELECTION);
  }, []);

  const isSelectionLocked = useMemo(() => {
    const itemMap = new Map(items.map((i) => [i.id, i] as const));
    const shapeMap = new Map(shapes.map((s) => [s.id, s] as const));
    const textMap = new Map(texts.map((t) => [t.id, t] as const));
    const strokeMap = new Map(strokes.map((s) => [s.id, s] as const));
    return {
      item: (id: string) => Boolean(itemMap.get(id)?.locked),
      shape: (id: string) => Boolean(shapeMap.get(id)?.locked),
      text: (id: string) => Boolean(textMap.get(id)?.locked),
      stroke: (id: string) => Boolean(strokeMap.get(id)?.locked),
    };
  }, [items, shapes, texts, strokes]);

  const selectionLockSummary = useMemo(() => {
    const selectedIds = [
      ...selection.itemIds.map((id) => ({ kind: "item" as const, id })),
      ...selection.shapeIds.map((id) => ({ kind: "shape" as const, id })),
      ...selection.textIds.map((id) => ({ kind: "text" as const, id })),
      ...selection.strokeIds.map((id) => ({ kind: "stroke" as const, id })),
    ];
    const total = selectedIds.length;
    const locked = selectedIds.filter(({ kind, id }) => isSelectionLocked[kind](id)).length;
    return { total, locked, unlocked: total - locked };
  }, [selection, isSelectionLocked]);

  const isDeskFocused = useCallback(() => {
    const el = surfaceRef.current;
    if (!el) return false;
    return el === document.activeElement || el.contains(document.activeElement);
  }, []);

  const copyDesk = useCallback(() => {
    const clip = buildDeskClipboard(
      items,
      shapes,
      texts,
      strokes,
      groups,
      selection
    );
    if (!clip) return;
    onStoreDeskClipboard(clip);
    // Replace any stale image in the system clipboard so paste prefers desk content.
    void navigator.clipboard.writeText("").catch(() => {});
  }, [items, shapes, texts, strokes, groups, selection, onStoreDeskClipboard]);

  const pasteDesk = useCallback(() => {
    if (!deskClipboard) return;
    const result = pasteDeskClipboard(deskClipboard, cursorRef.current);
    onPasteDesk({
      items: result.items,
      shapes: result.shapes,
      texts: result.texts,
      strokes: result.strokes,
      groups: result.groups,
    });
    setSelection(result.selection);
    surfaceRef.current?.focus();
  }, [deskClipboard, onPasteDesk]);

  const groupSelection = useCallback(() => {
    if (selectionSize < 2) return;
    onAddGroup({
      id: crypto.randomUUID(),
      memberItemIds: [...selection.itemIds],
      memberShapeIds: [...selection.shapeIds],
      memberTextIds: [...selection.textIds],
      memberStrokeIds: [...selection.strokeIds],
    });
  }, [onAddGroup, selection, selectionSize]);

  const ungroupSelection = useCallback(() => {
    for (const group of groupsTouchingSelection(groups, selection)) {
      onRemoveGroup(group.id);
    }
  }, [groups, selection, onRemoveGroup]);

  const applyTextColor = useCallback(
    (textIds: string[], color: string) => {
      for (const id of textIds) {
        onUpdateText(id, { color }, { recordHistory: true });
      }
    },
    [onUpdateText]
  );

  const applyTextStyle = useCallback(
    (
      textIds: string[],
      patch: Pick<BoardText, "bold" | "italic" | "strikethrough">
    ) => {
      for (const id of textIds) {
        onUpdateText(id, patch, { recordHistory: true });
      }
    },
    [onUpdateText]
  );

  const deleteSelection = useCallback(() => {
    if (selectionSize === 0) return;
    const itemIds = selection.itemIds.filter((id) => !isSelectionLocked.item(id));
    const shapeIds = selection.shapeIds.filter((id) => !isSelectionLocked.shape(id));
    const textIds = selection.textIds.filter((id) => !isSelectionLocked.text(id));
    const strokeIds = selection.strokeIds.filter((id) => !isSelectionLocked.stroke(id));
    if (
      itemIds.length === 0 &&
      shapeIds.length === 0 &&
      textIds.length === 0 &&
      strokeIds.length === 0
    ) {
      return;
    }
    onRemoveSelection(itemIds, shapeIds, textIds, strokeIds);
    setSelection({
      itemIds: selection.itemIds.filter((id) => isSelectionLocked.item(id)),
      shapeIds: selection.shapeIds.filter((id) => isSelectionLocked.shape(id)),
      textIds: selection.textIds.filter((id) => isSelectionLocked.text(id)),
      strokeIds: selection.strokeIds.filter((id) => isSelectionLocked.stroke(id)),
    });
  }, [
    onRemoveSelection,
    selection,
    selectionSize,
    isSelectionLocked,
  ]);

  const lockSelection = useCallback(() => {
    for (const id of selection.itemIds) onUpdate(id, { locked: true });
    for (const id of selection.shapeIds) onUpdateShape(id, { locked: true });
    for (const id of selection.textIds) onUpdateText(id, { locked: true }, { recordHistory: true });
    for (const id of selection.strokeIds) onUpdateStroke(id, { locked: true });
  }, [selection, onUpdate, onUpdateShape, onUpdateText, onUpdateStroke]);

  const unlockSelection = useCallback(() => {
    for (const id of selection.itemIds) onUpdate(id, { locked: false });
    for (const id of selection.shapeIds) onUpdateShape(id, { locked: false });
    for (const id of selection.textIds) onUpdateText(id, { locked: false }, { recordHistory: true });
    for (const id of selection.strokeIds) onUpdateStroke(id, { locked: false });
  }, [selection, onUpdate, onUpdateShape, onUpdateText, onUpdateStroke]);

  const deskLayerState = useMemo(
    () => ({ items, shapes, texts, strokes }),
    [items, shapes, texts, strokes]
  );

  const singleImageSelection = useMemo(
    () => (isSingleImageSelection(selection) ? selection.itemIds[0]! : null),
    [selection]
  );

  const singleImageLayerSelection = useMemo(
    (): DeskSelection =>
      singleImageSelection
        ? {
            itemIds: [singleImageSelection],
            shapeIds: [],
            textIds: [],
            strokeIds: [],
          }
        : EMPTY_SELECTION,
    [singleImageSelection]
  );

  const canBringForward = useMemo(
    () =>
      singleImageSelection !== null &&
      canReorderDeskLayer(deskLayerState, singleImageLayerSelection, "forward"),
    [deskLayerState, singleImageLayerSelection, singleImageSelection]
  );

  const canSendBackward = useMemo(
    () =>
      singleImageSelection !== null &&
      canReorderDeskLayer(deskLayerState, singleImageLayerSelection, "backward"),
    [deskLayerState, singleImageLayerSelection, singleImageSelection]
  );

  const canFlipImages = useMemo(() => {
    if (!singleImageSelection) return false;
    return !isSelectionLocked.item(singleImageSelection);
  }, [isSelectionLocked, singleImageSelection]);

  const bringSelectionForward = useCallback(() => {
    if (!canBringForward || !singleImageSelection) return;
    onReorderLayer(singleImageLayerSelection, "forward");
  }, [
    canBringForward,
    onReorderLayer,
    singleImageLayerSelection,
    singleImageSelection,
  ]);

  const sendSelectionBackward = useCallback(() => {
    if (!canSendBackward || !singleImageSelection) return;
    onReorderLayer(singleImageLayerSelection, "backward");
  }, [
    canSendBackward,
    onReorderLayer,
    singleImageLayerSelection,
    singleImageSelection,
  ]);

  const flipSelectionHorizontal = useCallback(() => {
    if (!singleImageSelection || isSelectionLocked.item(singleImageSelection)) return;
    const item = items.find((i) => i.id === singleImageSelection);
    if (!item) return;
    onUpdate(singleImageSelection, { flipH: !item.flipH });
  }, [items, isSelectionLocked, onUpdate, singleImageSelection]);

  const flipSelectionVertical = useCallback(() => {
    if (!singleImageSelection || isSelectionLocked.item(singleImageSelection)) return;
    const item = items.find((i) => i.id === singleImageSelection);
    if (!item) return;
    onUpdate(singleImageSelection, { flipV: !item.flipV });
  }, [items, isSelectionLocked, onUpdate, singleImageSelection]);

  const openDeskObjectMenu = useCallback(
    (clientX: number, clientY: number, nextSelection: DeskSelection, copyHref?: string) => {
      setSelection(nextSelection);
      openContextMenu({
        x: clientX,
        y: clientY,
        copyHref,
        actions: [
          {
            id: "desk.copy",
            label: t("menu.copy"),
            onClick: copyDesk,
            disabled: selectionCount(nextSelection) === 0,
          },
          {
            id: "desk.lock",
            label: t("desk.lock"),
            onClick: lockSelection,
            disabled:
              selectionCount(nextSelection) === 0 || selectionLockSummary.unlocked === 0,
          },
          {
            id: "desk.unlock",
            label: t("desk.unlock"),
            onClick: unlockSelection,
            disabled:
              selectionCount(nextSelection) === 0 || selectionLockSummary.locked === 0,
          },
          ...(isSingleImageSelection(nextSelection)
            ? [
                {
                  id: "desk.bringForward",
                  label: t("desk.bringForward"),
                  onClick: bringSelectionForward,
                  disabled: !canReorderDeskLayer(
                    deskLayerState,
                    {
                      itemIds: [nextSelection.itemIds[0]!],
                      shapeIds: [],
                      textIds: [],
                      strokeIds: [],
                    },
                    "forward"
                  ),
                },
                {
                  id: "desk.sendBackward",
                  label: t("desk.sendBackward"),
                  onClick: sendSelectionBackward,
                  disabled: !canReorderDeskLayer(
                    deskLayerState,
                    {
                      itemIds: [nextSelection.itemIds[0]!],
                      shapeIds: [],
                      textIds: [],
                      strokeIds: [],
                    },
                    "backward"
                  ),
                },
                {
                  id: "desk.flipHorizontal",
                  label: t("desk.flipHorizontal"),
                  onClick: flipSelectionHorizontal,
                  disabled: isSelectionLocked.item(nextSelection.itemIds[0]!),
                },
                {
                  id: "desk.flipVertical",
                  label: t("desk.flipVertical"),
                  onClick: flipSelectionVertical,
                  disabled: isSelectionLocked.item(nextSelection.itemIds[0]!),
                },
              ]
            : []),
        ],
      });
    },
    [
      bringSelectionForward,
      copyDesk,
      deskLayerState,
      flipSelectionHorizontal,
      flipSelectionVertical,
      isSelectionLocked,
      lockSelection,
      openContextMenu,
      selectionLockSummary.locked,
      selectionLockSummary.unlocked,
      sendSelectionBackward,
      t,
      unlockSelection,
    ]
  );

  const applyViewport = useCallback(
    (updater: (v: BoardViewport) => BoardViewport) => {
      setViewport((v) => {
        const next = updater(v);
        const { w, h } = surfaceSizeRef.current;
        return constrainBoardViewport(next, w, h, canvasWidth, canvasHeight);
      });
    },
    [canvasWidth, canvasHeight]
  );

  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = surfaceRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - viewport.panX) / viewport.scale,
        y: (clientY - rect.top - viewport.panY) / viewport.scale,
      };
    },
    [viewport.panX, viewport.panY, viewport.scale]
  );

  useEffect(() => {
    if (!highlightMediaId) return;
    const item = items.find((i) => i.id === highlightMediaId);
    if (!item) {
      onHighlightDone?.();
      return;
    }

    setSelection({ itemIds: [item.id], shapeIds: [], textIds: [], strokeIds: [] });
    const { w, h } = surfaceSizeRef.current;
    if (w > 0 && h > 0) {
      setViewport((v) => {
        const scale = v.scale;
        const cx = item.x + item.width / 2;
        const cy = item.y + item.height / 2;
        return constrainBoardViewport(
          {
            scale,
            panX: w / 2 - cx * scale,
            panY: h / 2 - cy * scale,
          },
          w,
          h,
          canvasWidth,
          canvasHeight
        );
      });
    }

    const timer = window.setTimeout(() => onHighlightDone?.(), HIGHLIGHT_FLASH_MS);
    return () => clearTimeout(timer);
  }, [highlightMediaId, items, onHighlightDone, canvasWidth, canvasHeight]);

  useEffect(() => {
    if (!highlightTextId) return;
    const text = texts.find((t) => t.id === highlightTextId);
    if (!text) {
      onHighlightDone?.();
      return;
    }

    setSelection({ itemIds: [], shapeIds: [], textIds: [text.id], strokeIds: [] });
    const { w, h } = surfaceSizeRef.current;
    if (w > 0 && h > 0) {
      setViewport((v) => {
        const scale = v.scale;
        const cx = text.x + text.width / 2;
        const cy = text.y + 24;
        return constrainBoardViewport(
          {
            scale,
            panX: w / 2 - cx * scale,
            panY: h / 2 - cy * scale,
          },
          w,
          h,
          canvasWidth,
          canvasHeight
        );
      });
    }

    const timer = window.setTimeout(() => onHighlightDone?.(), HIGHLIGHT_FLASH_MS);
    return () => clearTimeout(timer);
  }, [highlightTextId, texts, onHighlightDone, canvasWidth, canvasHeight]);

  const nextPastePosition = useCallback(() => {
    const base = cursorRef.current;
    const n = pasteCount.current++;
    return {
      x: base.x + (n % 6) * PASTE_OFFSET,
      y: base.y + Math.floor(n / 6) * PASTE_OFFSET,
    };
  }, []);

  const placeImage = useCallback(
    async (blob: Blob, at?: { x: number; y: number }) => {
      const src = await blobToDataUrl(blob);
      const dims = await loadImageDimensions(src);
      const pos = at ?? nextPastePosition();
      const maxW = 420;
      const scale = Math.min(1, maxW / dims.width);
      const width = Math.round(dims.width * scale);
      const height = Math.round(dims.height * scale);
      const id = crypto.randomUUID();

      onAdd({
        id,
        src,
        x: Math.max(0, Math.min(pos.x, canvasWidth - width)),
        y: Math.max(0, Math.min(pos.y, canvasHeight - height)),
        width,
        height,
      });
      setSelection({ itemIds: [id], shapeIds: [], textIds: [], strokeIds: [] });
      setPasteHint(false);
    },
    [canvasWidth, canvasHeight, nextPastePosition, onAdd]
  );

  const handlePaste = useCallback(
    async (e: ClipboardEvent) => {
      const blob = getImageFromClipboard(e.clipboardData!);
      if (blob) {
        e.preventDefault();
        await placeImage(blob);
        return;
      }
      if (isDeskFocused() && deskClipboard) {
        e.preventDefault();
        pasteDesk();
      }
    },
    [deskClipboard, isDeskFocused, pasteDesk, placeImage]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      const file = [...e.dataTransfer.files].find((f) =>
        f.type.startsWith("image/")
      );
      if (!file) return;
      const world = screenToWorld(e.clientX, e.clientY);
      await placeImage(file, { x: world.x - 40, y: world.y - 40 });
    },
    [placeImage, screenToWorld]
  );

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const rect = surfaceRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      applyViewport((v) => {
        const worldX = (mouseX - v.panX) / v.scale;
        const worldY = (mouseY - v.panY) / v.scale;
        const factor = Math.exp(-e.deltaY * ZOOM_INTENSITY);
        const { w, h } = surfaceSizeRef.current;
        const minScale =
          w > 0 && h > 0
            ? Math.max(w / canvasWidth, h / canvasHeight)
            : 0.15;
        const nextScale = clamp(v.scale * factor, minScale, BOARD_MAX_SCALE);

        return {
          scale: nextScale,
          panX: mouseX - worldX * nextScale,
          panY: mouseY - worldY * nextScale,
        };
      });
    },
    [applyViewport, canvasWidth, canvasHeight]
  );

  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;

    const syncSize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      surfaceSizeRef.current = { w, h };
      setViewport((v) =>
        constrainBoardViewport(v, w, h, canvasWidth, canvasHeight)
      );
    };

    syncSize();
    const observer = new ResizeObserver(syncSize);
    observer.observe(el);
    el.addEventListener("paste", handlePaste);
    el.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      observer.disconnect();
      el.removeEventListener("paste", handlePaste);
      el.removeEventListener("wheel", handleWheel);
    };
  }, [handlePaste, handleWheel, canvasWidth, canvasHeight]);

  useEffect(() => {
    const el = surfaceRef.current;
    if (!el || el.clientWidth <= 0) return;
    setViewport(
      fitBoardViewport(
        el.clientWidth,
        el.clientHeight,
        canvasWidth,
        canvasHeight
      )
    );
    clearSelection();
  }, [projectId, sectionId, canvasWidth, canvasHeight, clearSelection]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const target = e.target as HTMLElement;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const mod = e.ctrlKey || e.metaKey;
      const desk = isDeskFocused();

      if (shortcutMatches("desk.copy", e) && desk && selectionSize > 0) {
        e.preventDefault();
        copyDesk();
        return;
      }

      if (mod && e.shiftKey && e.key === "g" && desk && canUngroup) {
        e.preventDefault();
        ungroupSelection();
        return;
      }

      if (mod && e.key === "g" && desk && selectionSize >= 2) {
        e.preventDefault();
        groupSelection();
        return;
      }

      if (e.key === " " && !mod && desk) {
        e.preventDefault();
        spaceHeld.current = true;
        return;
      }

      if (shortcutMatches("desk.cancel", e)) {
        if (editingTextId) {
          setEditingTextId(null);
          return;
        }
        penSession.current = null;
        setPenPreview(null);
        setActiveTool(null);
        setDrawPreview(null);
        drawSession.current = null;
        marqueeSession.current = null;
        setMarqueePreview(null);
        setDeskMenu(null);
        clearSelection();
        return;
      }

      if (shortcutMatches("desk.delete", e) && desk && selectionSize > 0) {
        e.preventDefault();
        deleteSelection();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") spaceHeld.current = false;
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [
    canUngroup,
    clearSelection,
    copyDesk,
    deleteSelection,
    shortcutMatches,
    groupSelection,
    isDeskFocused,
    selectionSize,
    ungroupSelection,
    editingTextId,
  ]);

  const commitDraw = useCallback(
    (end: BoardPoint) => {
      const session = drawSession.current;
      if (!session) return;
      if (shapeLongEnough(session.start, end, items, session.type)) {
        const id = crypto.randomUUID();
        onAddShape({
          id,
          type: session.type,
          start: session.start,
          end,
        });
        setSelection({ itemIds: [], shapeIds: [id], textIds: [], strokeIds: [] });
      }
      drawSession.current = null;
      setDrawPreview(null);
      setActiveTool(null);
    },
    [items, onAddShape]
  );

  const commitPen = useCallback(() => {
    const session = penSession.current;
    if (!session || !penStrokeLongEnough(session.points)) {
      penSession.current = null;
      setPenPreview(null);
      return;
    }
    const id = crypto.randomUUID();
    onAddStroke({
      id,
      points: session.points,
      color: penColor,
      width: penWidth,
    });
    penSession.current = null;
    setPenPreview(null);
  }, [onAddStroke, penColor, penWidth]);

  const finishTransientEdit = useCallback(() => {
    onEndTransientEdit?.();
  }, [onEndTransientEdit]);

  const startMultiDrag = (
    e: React.PointerEvent,
    activeSelection: DeskSelection
  ) => {
    const hasUnlocked =
      activeSelection.itemIds.some((id) => !isSelectionLocked.item(id)) ||
      activeSelection.shapeIds.some((id) => !isSelectionLocked.shape(id)) ||
      activeSelection.textIds.some((id) => !isSelectionLocked.text(id)) ||
      activeSelection.strokeIds.some((id) => !isSelectionLocked.stroke(id));
    if (!hasUnlocked) return;
    e.preventDefault();
    e.stopPropagation();
    onBeginTransientEdit?.();
    const scale = viewport.scale;
    const startX = e.clientX;
    const startY = e.clientY;
    const movedItems = new Set(
      activeSelection.itemIds.filter((id) => !isSelectionLocked.item(id))
    );

    const itemOrigins = activeSelection.itemIds
      .filter((id) => !isSelectionLocked.item(id))
      .map((id) => items.find((i) => i.id === id))
      .filter((i): i is BoardItem => Boolean(i))
      .map((i) => ({ ...i }));

    const shapeOrigins = activeSelection.shapeIds
      .filter((id) => !isSelectionLocked.shape(id))
      .map((id) => shapes.find((s) => s.id === id))
      .filter((s): s is BoardShape => Boolean(s));

    const textOrigins = activeSelection.textIds
      .filter((id) => !isSelectionLocked.text(id))
      .map((id) => texts.find((t) => t.id === id))
      .filter((t): t is BoardText => Boolean(t))
      .map((t) => ({ ...t }));

    const strokeOrigins = activeSelection.strokeIds
      .filter((id) => !isSelectionLocked.stroke(id))
      .map((id) => strokes.find((s) => s.id === id))
      .filter((s): s is BoardStroke => Boolean(s))
      .map((s) => ({ ...s }));

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      for (const orig of itemOrigins) {
        onUpdate(orig.id, {
          x: Math.max(0, orig.x + dx),
          y: Math.max(0, orig.y + dy),
        });
      }
      for (const orig of shapeOrigins) {
        onUpdateShape(orig.id, translateShapeForDrag(orig, dx, dy, movedItems));
      }
      for (const orig of textOrigins) {
        onUpdateText(orig.id, {
          x: Math.max(0, orig.x + dx),
          y: Math.max(0, orig.y + dy),
        });
      }
      for (const orig of strokeOrigins) {
        onUpdateStroke(orig.id, translateStroke(orig, dx, dy));
      }
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      finishTransientEdit();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const commitTextContent = useCallback(
    (textId: string, raw: string) => {
      const content = raw.trim();
      if (!content) {
        onRemoveText(textId);
        setSelection((prev) => ({
          ...prev,
          textIds: prev.textIds.filter((id) => id !== textId),
        }));
        return;
      }
      onUpdateText(textId, { content }, { recordHistory: true });
    },
    [onRemoveText, onUpdateText]
  );

  const addTextAtCursor = useCallback(() => {
    const id = crypto.randomUUID();
    const pos = cursorRef.current;
    onAddText({
      id,
      content: "Text",
      x: Math.max(0, pos.x),
      y: Math.max(0, pos.y),
      width: DEFAULT_TEXT_WIDTH,
    });
    setSelection({ itemIds: [], shapeIds: [], textIds: [id], strokeIds: [] });
    setEditingTextId(id);
    surfaceRef.current?.focus();
  }, [onAddText]);

  const startTextDrag = (
    e: React.PointerEvent,
    text: BoardText,
    activeSelection: DeskSelection
  ) => {
    if (selectionCount(activeSelection) > 1) {
      startMultiDrag(e, activeSelection);
      return;
    }

    onBeginTransientEdit?.();
    const scale = viewport.scale;
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = { ...text };

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      onUpdateText(text.id, {
        x: Math.max(0, orig.x + dx),
        y: Math.max(0, orig.y + dy),
      });
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      finishTransientEdit();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleTextPointerDown = (
    e: React.PointerEvent,
    text: BoardText
  ) => {
    if (text.locked) return;
    if (isDrawing && e.button === 0) return;
    e.stopPropagation();
    e.preventDefault();
    if (editingTextId === text.id) return;

    const next = applyDeskSelectClick(
      "text",
      text.id,
      e.shiftKey,
      selection,
      groups
    );
    setSelection(next);
    armDragAfterThreshold(e, () => startTextDrag(e, text, next));
  };

  const startItemDrag = (
    e: React.PointerEvent,
    item: BoardItem,
    mode: "move" | "resize",
    activeSelection: DeskSelection
  ) => {
    if (item.locked) return;
    if (
      mode === "move" &&
      selectionCount(activeSelection) > 1
    ) {
      startMultiDrag(e, activeSelection);
      return;
    }

    onBeginTransientEdit?.();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startY = e.clientY;
    const orig = { ...item };
    const scale = viewport.scale;

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      if (mode === "move") {
        onUpdate(item.id, {
          x: Math.max(0, orig.x + dx),
          y: Math.max(0, orig.y + dy),
        });
      } else {
        onUpdate(item.id, {
          width: Math.max(80, orig.width + dx),
          height: Math.max(60, orig.height + dy),
        });
      }
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      finishTransientEdit();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const startShapeBodyDrag = (
    e: React.PointerEvent,
    shapeId: string,
    activeSelection: DeskSelection
  ) => {
    const lockedShape = shapes.find((s) => s.id === shapeId)?.locked;
    if (lockedShape) return;
    if (selectionCount(activeSelection) > 1) {
      startMultiDrag(e, activeSelection);
      return;
    }

    const shape = shapes.find((s) => s.id === shapeId);
    if (!shape) return;

    onBeginTransientEdit?.();
    const scale = viewport.scale;
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = { ...shape };
    const movedItems = new Set<string>();

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      onUpdateShape(shapeId, translateShapeForDrag(orig, dx, dy, movedItems));
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      finishTransientEdit();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const startItemRotate = (e: React.PointerEvent, item: BoardItem) => {
    if (item.locked) return;
    if (isDrawing && e.button === 0) return;
    e.stopPropagation();
    e.preventDefault();
    onBeginTransientEdit?.();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const centerX = item.x + item.width / 2;
    const centerY = item.y + item.height / 2;
    const origRotation = item.rotation ?? 0;
    const startWorld = screenToWorld(e.clientX, e.clientY);
    const startRad = pointerAngleRad(
      centerX,
      centerY,
      startWorld.x,
      startWorld.y
    );

    const rotationAt = (clientX: number, clientY: number) => {
      const world = screenToWorld(clientX, clientY);
      const currentRad = pointerAngleRad(centerX, centerY, world.x, world.y);
      return origRotation + rotationDeltaDeg(startRad, currentRad);
    };

    const onMove = (ev: PointerEvent) => {
      onUpdate(item.id, { rotation: rotationAt(ev.clientX, ev.clientY) });
    };

    const onUp = (ev: PointerEvent) => {
      onUpdate(item.id, {
        rotation: snapRotationAngle(rotationAt(ev.clientX, ev.clientY)),
      });
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      finishTransientEdit();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleItemPointerDown = (
    e: React.PointerEvent,
    item: BoardItem,
    mode: "move" | "resize"
  ) => {
    if (item.locked) return;
    if (isDrawing && e.button === 0) return;
    e.stopPropagation();
    e.preventDefault();

    const next = applyDeskSelectClick(
      "item",
      item.id,
      e.shiftKey,
      selection,
      groups
    );
    setSelection(next);

    const startDrag = () => {
      if (selectionCount(next) > 1 && mode === "move") {
        startMultiDrag(e, next);
        return;
      }
      startItemDrag(e, item, mode, next);
    };

    if (e.shiftKey && mode === "move") {
      armDragAfterThreshold(e, startDrag);
      return;
    }

    startDrag();
  };

  const handleShapePointerDown = (
    e: React.PointerEvent,
    shapeId: string
  ) => {
    const lockedShape = shapes.find((s) => s.id === shapeId)?.locked;
    if (lockedShape) return;
    if (isDrawing && e.button === 0) return;
    e.stopPropagation();
    e.preventDefault();

    const next = applyDeskSelectClick(
      "shape",
      shapeId,
      e.shiftKey,
      selection,
      groups
    );
    setSelection(next);

    const startDrag = () => {
      if (selectionCount(next) > 1) {
        startMultiDrag(e, next);
        return;
      }
      startShapeBodyDrag(e, shapeId, next);
    };

    if (e.shiftKey) {
      armDragAfterThreshold(e, startDrag);
      return;
    }

    startDrag();
  };

  const startStrokeDrag = (
    e: React.PointerEvent,
    strokeId: string,
    activeSelection: DeskSelection
  ) => {
    const lockedStroke = strokes.find((s) => s.id === strokeId)?.locked;
    if (lockedStroke) return;
    if (selectionCount(activeSelection) > 1) {
      startMultiDrag(e, activeSelection);
      return;
    }

    const stroke = strokes.find((s) => s.id === strokeId);
    if (!stroke) return;

    onBeginTransientEdit?.();
    const scale = viewport.scale;
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = { ...stroke };

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      onUpdateStroke(strokeId, translateStroke(orig, dx, dy));
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      finishTransientEdit();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleStrokePointerDown = (
    e: React.PointerEvent,
    strokeId: string
  ) => {
    const lockedStroke = strokes.find((s) => s.id === strokeId)?.locked;
    if (lockedStroke) return;
    if (isDrawing && e.button === 0) return;
    e.stopPropagation();
    e.preventDefault();

    const next = applyDeskSelectClick(
      "stroke",
      strokeId,
      e.shiftKey,
      selection,
      groups
    );
    setSelection(next);

    const startDrag = () => startStrokeDrag(e, strokeId, next);

    if (e.shiftKey) {
      armDragAfterThreshold(e, startDrag);
      return;
    }

    startDrag();
  };

  const startEndpointDrag = (
    e: React.PointerEvent,
    shapeId: string,
    endpoint: "start" | "end"
  ) => {
    const lockedShape = shapes.find((s) => s.id === shapeId)?.locked;
    if (lockedShape) return;
    if (isDrawing && e.button === 0) return;
    e.preventDefault();
    e.stopPropagation();
    setSelection({ itemIds: [], shapeIds: [shapeId], textIds: [], strokeIds: [] });

    const shape = shapes.find((s) => s.id === shapeId);
    if (!shape) return;

    onBeginTransientEdit?.();

    const onMove = (ev: PointerEvent) => {
      const world = screenToWorld(ev.clientX, ev.clientY);
      const point = snapBoardPoint(world.x, world.y, items);
      onUpdateShape(shapeId, { [endpoint]: point });
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      finishTransientEdit();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const showDeskMenuAt = useCallback((clientX: number, clientY: number) => {
    setDeskMenu({ x: clientX, y: clientY });
    penSession.current = null;
    setPenPreview(null);
    setDrawPreview(null);
    drawSession.current = null;
    marqueeSession.current = null;
    setMarqueePreview(null);
  }, []);

  const showDeskMenuForSelection = useCallback(
    (clientX: number, clientY: number, nextSelection?: DeskSelection) => {
      if (nextSelection) setSelection(nextSelection);
      showDeskMenuAt(clientX, clientY);
    },
    [showDeskMenuAt]
  );

  const handleSurfaceContextMenu = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const shapeEl = target.closest(".board-shape") as SVGGElement | null;
    const strokeEl = target.closest(".board-stroke") as SVGGElement | null;

    if (shapeEl?.dataset.shapeId) {
      e.preventDefault();
      e.stopPropagation();
      const shapeId = shapeEl.dataset.shapeId;
      const next =
        selection.shapeIds.includes(shapeId) && selectionCount(selection) > 0
          ? selection
          : { itemIds: [], shapeIds: [shapeId], textIds: [], strokeIds: [] };
      showDeskMenuForSelection(e.clientX, e.clientY, next);
      return;
    }

    if (strokeEl?.dataset.strokeId) {
      e.preventDefault();
      e.stopPropagation();
      const strokeId = strokeEl.dataset.strokeId;
      const next =
        selection.strokeIds.includes(strokeId) && selectionCount(selection) > 0
          ? selection
          : { itemIds: [], shapeIds: [], textIds: [], strokeIds: [strokeId] };
      showDeskMenuForSelection(e.clientX, e.clientY, next);
      return;
    }

    if (
      target.closest(".board-item") ||
      target.closest(".board-shape-handle") ||
      target.closest(".board-text")
    ) {
      return;
    }
    e.preventDefault();
  };

  const isPanBlocker = (target: HTMLElement) =>
    Boolean(
      target.closest(".board-item") ||
        target.closest(".board-shape-handle") ||
        target.closest(".board-text") ||
        target.closest(".board-stroke") ||
        target.closest(".board-item-rotate") ||
        target.closest(".board-item-resize")
    );

  const startPanSession = (e: React.PointerEvent) => {
    panSession.current = {
      startX: e.clientX,
      startY: e.clientY,
      origPanX: viewport.panX,
      origPanY: viewport.panY,
      moved: false,
      button: e.button,
    };
    surfaceRef.current?.setPointerCapture(e.pointerId);
  };

  const tryStartDrawing = useCallback(
    (e: React.PointerEvent): boolean => {
      if (!isDrawing) return false;
      const target = e.target as HTMLElement;
      if (!target.closest(".board-canvas")) return false;

      if (activeTool === "pen") {
        e.preventDefault();
        const world = screenToWorld(e.clientX, e.clientY);
        const start = { x: world.x, y: world.y };
        penSession.current = { points: [start] };
        setPenPreview({ points: [start], color: penColor, width: penWidth });
        clearSelection();
        surfaceRef.current?.setPointerCapture(e.pointerId);
        return true;
      }

      if (activeTool && isShapeTool(activeTool)) {
        e.preventDefault();
        const world = screenToWorld(e.clientX, e.clientY);
        const start = snapBoardPoint(world.x, world.y, items);
        drawSession.current = { type: activeTool, start };
        setDrawPreview({ type: activeTool, start, end: start });
        clearSelection();
        surfaceRef.current?.setPointerCapture(e.pointerId);
        return true;
      }

      return false;
    },
    [
      isDrawing,
      activeTool,
      screenToWorld,
      penColor,
      penWidth,
      clearSelection,
      items,
    ]
  );

  const onSurfacePointerDownCapture = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (tryStartDrawing(e)) {
      e.stopPropagation();
    }
  };

  const onSurfacePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    const onCanvas = Boolean(target.closest(".board-canvas"));

    if (
      e.button === 1 ||
      (e.button === 0 && spaceHeld.current && onCanvas)
    ) {
      e.preventDefault();
      startPanSession(e);
      return;
    }

    if (e.button === 2 && !isPanBlocker(target)) {
      e.preventDefault();
      startPanSession(e);
      return;
    }

    if (e.button !== 0) return;

    if (isDrawing) return;

    if (
      target.closest(".board-item") ||
      target.closest(".board-shape-handle") ||
      target.closest(".board-text") ||
      target.closest(".board-stroke")
    ) {
      return;
    }

    if (!onCanvas) return;

    const world = screenToWorld(e.clientX, e.clientY);
    marqueeSession.current = {
      startWorld: world,
      shiftKey: e.shiftKey,
      moved: false,
    };
    setMarqueePreview({ start: world, end: world });
    surfaceRef.current?.setPointerCapture(e.pointerId);
  };

  const onSurfacePointerMove = (e: React.PointerEvent) => {
    const world = screenToWorld(e.clientX, e.clientY);
    cursorRef.current = world;

    if (marqueeSession.current) {
      const session = marqueeSession.current;
      const dx = world.x - session.startWorld.x;
      const dy = world.y - session.startWorld.y;
      if (Math.abs(dx) > 3 / viewport.scale || Math.abs(dy) > 3 / viewport.scale) {
        session.moved = true;
      }
      setMarqueePreview({ start: session.startWorld, end: world });
      return;
    }

    if (penSession.current) {
      const point = { x: world.x, y: world.y };
      const nextPoints = appendPenPoint(penSession.current.points, point);
      if (nextPoints.length !== penSession.current.points.length) {
        penSession.current.points = nextPoints;
        setPenPreview({
          points: nextPoints,
          color: penColor,
          width: penWidth,
        });
      }
      return;
    }

    if (drawSession.current) {
      const end = snapBoardPoint(world.x, world.y, items);
      setDrawPreview({
        type: drawSession.current.type,
        start: drawSession.current.start,
        end,
      });
      return;
    }

    const session = panSession.current;
    if (!session) return;

    const dx = e.clientX - session.startX;
    const dy = e.clientY - session.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) session.moved = true;

    applyViewport((v) => ({
      ...v,
      panX: session.origPanX + dx,
      panY: session.origPanY + dy,
    }));
  };

  const onSurfacePointerUp = (e: React.PointerEvent) => {
    if (penSession.current) {
      commitPen();
      return;
    }

    if (drawSession.current) {
      const world = screenToWorld(e.clientX, e.clientY);
      const end = snapBoardPoint(world.x, world.y, items);
      commitDraw(end);
      return;
    }

    if (marqueeSession.current) {
      const session = marqueeSession.current;
      if (!session.moved && !editingTextId && !session.shiftKey) {
        clearSelection();
      } else if (session.moved && marqueePreview) {
        const rect = boardRectFromPoints(marqueePreview.start, marqueePreview.end);
        if (rect.width >= 2 || rect.height >= 2) {
          setSelection(
            selectionFromMarqueeRect(
              rect,
              items,
              shapes,
              texts,
              strokes,
              groups,
              session.shiftKey,
              selection
            )
          );
        } else if (!session.shiftKey) {
          clearSelection();
        }
      }
      marqueeSession.current = null;
      setMarqueePreview(null);
      return;
    }

    const pan = panSession.current;
    if (pan) {
      if (pan.button === 2 && !pan.moved) {
        showDeskMenuAt(pan.startX, pan.startY);
      } else if (!pan.moved && !editingTextId && pan.button === 0) {
        clearSelection();
      }
      panSession.current = null;
      return;
    }
  };

  const zoomPercent = Math.round(viewport.scale * 100);

  return (
    <div className="board-panel board-panel--embedded">
      <header className="board-header">
        <div>
          <h2 className="board-title">{t("desk.title")}</h2>
        </div>
        <div className="board-meta">
          <span className="board-zoom">{zoomPercent}%</span>
          <span>{t("desk.images", { count: items.length })}</span>
          <span>{t("desk.shapes", { count: shapes.length })}</span>
          <span>{t("desk.labels", { count: texts.length })}</span>
          {canGroup && (
            <button
              type="button"
              className="btn btn-ghost board-group-action"
              onClick={groupSelection}
            >
              {t("desk.group")}
            </button>
          )}
          {canUngroup && (
            <button
              type="button"
              className="btn btn-ghost board-group-action"
              onClick={ungroupSelection}
            >
              {t("desk.ungroup")}
            </button>
          )}
          {selectionSize > 0 && (
            <button
              type="button"
              className="btn btn-ghost board-delete"
              onClick={deleteSelection}
            >
              {t("desk.removeSelected")}
            </button>
          )}
        </div>
      </header>

      <div
        ref={surfaceRef}
        className={`board-surface ${pasteHint ? "paste-ready" : ""} ${isDrawing ? "board-surface--draw" : ""}`}
        tabIndex={0}
        onFocus={() => setPasteHint(true)}
        onBlur={() => setPasteHint(false)}
        onPointerDownCapture={onSurfacePointerDownCapture}
        onPointerDown={onSurfacePointerDown}
        onPointerMove={onSurfacePointerMove}
        onPointerUp={onSurfacePointerUp}
        onPointerLeave={onSurfacePointerUp}
        onContextMenu={handleSurfaceContextMenu}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <div
          className="board-viewport"
          style={{
            transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.scale})`,
          }}
        >
          <div
            className="board-canvas"
            style={{
              width: canvasWidth,
              height: canvasHeight,
            }}
            onContextMenu={handleSurfaceContextMenu}
          >
            {items.length === 0 &&
              shapes.length === 0 &&
              strokes.length === 0 &&
              texts.length === 0 &&
              !drawPreview &&
              !penPreview && (
              <div className="board-empty">
                <p>{t("desk.empty")}</p>
              </div>
            )}
            <BoardShapesLayer
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              items={items}
              shapes={boxShapes}
              preview={boxDrawPreview}
              selectedShapeIds={selectedShapeIds}
              className="board-boxes-layer"
              onShapePointerDown={handleShapePointerDown}
              onEndpointPointerDown={startEndpointDrag}
            />
            {items.map((item) => (
              <div
                key={item.id}
                className={`board-item ${item.locked ? "locked" : ""} ${selectedItemSet.has(item.id) ? "selected" : ""} ${singleImageSelection === item.id ? "board-item--image-tools" : ""} ${highlightMediaId === item.id ? "board-item--link-target" : ""}`}
                style={{
                  left: item.x,
                  top: item.y,
                  width: item.width,
                  height: item.height,
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const next =
                    selection.itemIds.includes(item.id) && selectionCount(selection) > 0
                      ? selection
                      : { itemIds: [item.id], shapeIds: [], textIds: [], strokeIds: [] };
                  openDeskObjectMenu(e.clientX, e.clientY, next, buildMediaHref(sectionId, item.id));
                }}
              >
                <div
                  className="board-item-drag"
                  onPointerDown={(e) => handleItemPointerDown(e, item, "move")}
                />
                <div
                  className="board-item-body"
                  style={{ transform: boardItemTransform(item) }}
                >
                  <div className="board-item-frame" aria-hidden />
                  <div className="board-item-visual">
                    <img src={resolveItemSrc(item)} alt="" draggable={false} />
                  </div>
                  <div className="board-item-handles">
                    <button
                      type="button"
                      className="board-item-remove"
                      disabled={item.locked}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (item.locked) return;
                        onRemove(item.id);
                        setSelection((prev) => ({
                          itemIds: prev.itemIds.filter((id) => id !== item.id),
                          shapeIds: prev.shapeIds,
                          textIds: prev.textIds,
                          strokeIds: prev.strokeIds,
                        }));
                      }}
                      aria-label="Remove image"
                    >
                      ×
                    </button>
                    <div
                      className="board-item-resize"
                      onPointerDown={(e) => handleItemPointerDown(e, item, "resize")}
                    />
                    {singleImageSelection === item.id && !item.locked && (
                      <div
                        className="board-item-rotate"
                        title={t("desk.rotate")}
                        aria-label={t("desk.rotate")}
                        onPointerDown={(e) => startItemRotate(e, item)}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
            <BoardShapesLayer
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              items={items}
              shapes={lineShapes}
              preview={lineDrawPreview}
              selectedShapeIds={selectedShapeIds}
              onShapePointerDown={handleShapePointerDown}
              onEndpointPointerDown={startEndpointDrag}
            />
            <BoardTextsLayer
              texts={texts}
              selectedTextIds={selectedTextIds}
              editingTextId={editingTextId}
              highlightTextId={highlightTextId}
              onTextPointerDown={handleTextPointerDown}
              onTextContextMenu={(e, text) => {
                const next =
                  selection.textIds.includes(text.id) && selectionCount(selection) > 0
                    ? selection
                    : { itemIds: [], shapeIds: [], textIds: [text.id], strokeIds: [] };
                openDeskObjectMenu(e.clientX, e.clientY, next, buildTextHref(sectionId, text.id));
              }}
              onTextDoubleClick={(textId) => {
                const text = texts.find((t) => t.id === textId);
                if (text?.locked) return;
                setSelection({ itemIds: [], shapeIds: [], textIds: [textId], strokeIds: [] });
                setEditingTextId(textId);
              }}
              onTextCommit={commitTextContent}
              onEditEnd={() => setEditingTextId(null)}
            />
            <BoardStrokesLayer
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              strokes={strokes}
              preview={penPreview}
              selectedStrokeIds={selectedStrokeIds}
              onStrokePointerDown={handleStrokePointerDown}
            />
            {marqueePreview && (
              <div
                className="board-marquee"
                style={{
                  left: Math.min(marqueePreview.start.x, marqueePreview.end.x),
                  top: Math.min(marqueePreview.start.y, marqueePreview.end.y),
                  width: Math.abs(marqueePreview.end.x - marqueePreview.start.x),
                  height: Math.abs(marqueePreview.end.y - marqueePreview.start.y),
                }}
              />
            )}
          </div>
        </div>
      </div>

      {deskMenu && (
        <DeskContextMenu
          x={deskMenu.x}
          y={deskMenu.y}
          canGroup={canGroup}
          canUngroup={canUngroup}
          canCopy={canCopy}
          canPaste={canPasteDesk}
          canLock={selectionSize > 0 && selectionLockSummary.unlocked > 0}
          canUnlock={selectionSize > 0 && selectionLockSummary.locked > 0}
          canBringForward={canBringForward}
          canSendBackward={canSendBackward}
          canFlipHorizontal={canFlipImages}
          canFlipVertical={canFlipImages}
          onClose={() => setDeskMenu(null)}
          onPick={(type) => {
            penSession.current = null;
            setPenPreview(null);
            setActiveTool(type);
            setDeskMenu(null);
            surfaceRef.current?.focus();
          }}
          onAddText={() => {
            addTextAtCursor();
            setDeskMenu(null);
          }}
          onGroup={() => {
            groupSelection();
            setDeskMenu(null);
          }}
          onUngroup={() => {
            ungroupSelection();
            setDeskMenu(null);
          }}
          onCopy={() => {
            copyDesk();
            setDeskMenu(null);
          }}
          onPaste={() => {
            pasteDesk();
            setDeskMenu(null);
          }}
          onLock={() => {
            lockSelection();
            setDeskMenu(null);
          }}
          onUnlock={() => {
            unlockSelection();
            setDeskMenu(null);
          }}
          onBringForward={() => {
            bringSelectionForward();
            setDeskMenu(null);
          }}
          onSendBackward={() => {
            sendSelectionBackward();
            setDeskMenu(null);
          }}
          onFlipHorizontal={() => {
            flipSelectionHorizontal();
            setDeskMenu(null);
          }}
          onFlipVertical={() => {
            flipSelectionVertical();
            setDeskMenu(null);
          }}
        />
      )}

      <BoardToolbar
        penMode={penMode}
        onPenModeChange={setPenMode}
        penColor={penColor}
        penWidth={penWidth}
        onPenColorChange={setPenColor}
        onPenWidthChange={(w) => setPenWidth(w)}
        selectedTextIds={selection.textIds}
        texts={texts}
        onTextColorChange={applyTextColor}
        onTextStyleChange={applyTextStyle}
      />
    </div>
  );
}
