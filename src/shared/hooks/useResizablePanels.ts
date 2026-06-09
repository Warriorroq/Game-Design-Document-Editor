import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampBoardWidth,
  loadBoardPanelWidth,
  PANEL_MIN_BOARD,
  saveBoardPanelHidden,
  STORAGE_BOARD_HIDDEN,
  STORAGE_BOARD_WIDTH,
  STORAGE_EDITOR_HIDDEN,
  STORAGE_EDITOR_WIDTH,
} from "@/shared/lib/panelLayout";

const SPLITTER_SIZE = 6;
const COLLAPSED_SPLITTER = 10;
const MIN_EDITOR = 280;
const MIN_BOARD = PANEL_MIN_BOARD;
const COLLAPSE_AT = 72;
const DEFAULT_EDITOR_RATIO = 0.55;

type DragTarget = "editor" | "board";

interface PanelState {
  editorWidth: number;
  boardWidth: number;
  editorHidden: boolean;
  boardHidden: boolean;
}

function loadBool(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function loadNum(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function persist(state: PanelState) {
  try {
    localStorage.setItem(STORAGE_EDITOR_HIDDEN, state.editorHidden ? "1" : "0");
    localStorage.setItem(STORAGE_BOARD_HIDDEN, state.boardHidden ? "1" : "0");
    if (!state.editorHidden) {
      localStorage.setItem(STORAGE_EDITOR_WIDTH, String(state.editorWidth));
    }
    if (!state.boardHidden) {
      localStorage.setItem(STORAGE_BOARD_WIDTH, String(state.boardWidth));
    }
  } catch {
    /* ignore */
  }
}

function fitPanels(
  editorW: number,
  boardW: number,
  panelW: number
): { editorWidth: number; boardWidth: number } {
  const available = panelW - SPLITTER_SIZE * 2;
  let e = Math.max(0, editorW);
  let b = Math.max(0, boardW);
  const total = e + b;
  if (total > available && total > 0) {
    const scale = available / total;
    e = Math.round(e * scale);
    b = available - e;
  }
  return { editorWidth: e, boardWidth: b };
}

function reflowToPanelWidth(state: PanelState, panelW: number): PanelState {
  if (panelW <= 0) return state;

  if (state.editorHidden && state.boardHidden) {
    return state;
  }

  if (state.editorHidden) {
    return {
      ...state,
      boardWidth: Math.max(
        MIN_BOARD,
        panelW - COLLAPSED_SPLITTER - SPLITTER_SIZE
      ),
    };
  }

  if (state.boardHidden) {
    return {
      ...state,
      editorWidth: Math.max(
        MIN_EDITOR,
        panelW - COLLAPSED_SPLITTER - SPLITTER_SIZE
      ),
    };
  }

  const available = panelW - SPLITTER_SIZE * 2;
  const total = state.editorWidth + state.boardWidth;
  const ratio =
    total > 0 ? state.editorWidth / total : DEFAULT_EDITOR_RATIO;

  let editorWidth = Math.round(available * ratio);
  let boardWidth = available - editorWidth;

  if (editorWidth < MIN_EDITOR) {
    editorWidth = MIN_EDITOR;
    boardWidth = available - editorWidth;
  }
  if (boardWidth < MIN_BOARD) {
    boardWidth = MIN_BOARD;
    editorWidth = available - boardWidth;
  }

  const fitted = fitPanels(editorWidth, boardWidth, panelW);
  let e = Math.max(MIN_EDITOR, fitted.editorWidth);
  let b = available - e;
  if (b < MIN_BOARD) {
    b = MIN_BOARD;
    e = available - b;
  }
  return { ...state, editorWidth: e, boardWidth: b };
}

export function panelFlexStyle(
  hidden: boolean,
  weight: number,
  minPx: number
): { flex: string } {
  if (hidden) return { flex: "0 0 0px" };
  return { flex: `${Math.max(weight, minPx)} 1 ${minPx}px` };
}

export function useResizablePanels(sidebarVisible: boolean) {
  const mainRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<PanelState>({
    editorWidth: MIN_EDITOR,
    boardWidth: MIN_BOARD,
    editorHidden: false,
    boardHidden: loadBool(STORAGE_BOARD_HIDDEN),
  });
  const [editorWidth, setEditorWidth] = useState(MIN_EDITOR);
  const [boardWidth, setBoardWidth] = useState(MIN_BOARD);
  const [editorHidden, setEditorHidden] = useState(false);
  const [boardHidden, setBoardHidden] = useState(() =>
    loadBool(STORAGE_BOARD_HIDDEN)
  );
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);
  const dragTargetRef = useRef<DragTarget | null>(null);
  const dragRef = useRef<{ startX: number; startEditor: number; startBoard: number } | null>(
    null
  );
  const initialized = useRef(false);

  useEffect(() => {
    dragTargetRef.current = dragTarget;
  }, [dragTarget]);

  const applyState = useCallback((next: PanelState) => {
    stateRef.current = next;
    setEditorWidth(next.editorWidth);
    setBoardWidth(next.boardWidth);
    setEditorHidden(next.editorHidden);
    setBoardHidden(next.boardHidden);
  }, []);

  useEffect(() => {
    const el = mainRef.current;
    if (!el || initialized.current) return;

    const panelW = el.clientWidth;
    if (panelW <= 0) return;
    initialized.current = true;

    const editorH = loadBool(STORAGE_EDITOR_HIDDEN);
    const boardH = loadBool(STORAGE_BOARD_HIDDEN);
    const storedEditor = loadNum(STORAGE_EDITOR_WIDTH);
    const storedBoard = loadNum(STORAGE_BOARD_WIDTH);

    if (editorH && boardH) {
      applyState({
        editorWidth: 0,
        boardWidth: 0,
        editorHidden: true,
        boardHidden: true,
      });
      return;
    }

    if (editorH) {
      const b = storedBoard ?? panelW - COLLAPSED_SPLITTER - SPLITTER_SIZE;
      applyState({
        editorWidth: 0,
        boardWidth: Math.max(MIN_BOARD, b),
        editorHidden: true,
        boardHidden: false,
      });
      return;
    }

    if (boardH) {
      const e = storedEditor ?? panelW - COLLAPSED_SPLITTER - SPLITTER_SIZE;
      applyState({
        editorWidth: Math.max(MIN_EDITOR, e),
        boardWidth: 0,
        editorHidden: false,
        boardHidden: true,
      });
      return;
    }

    const available = panelW - SPLITTER_SIZE * 2;
    let e = storedEditor ?? Math.round(available * DEFAULT_EDITOR_RATIO);
    let b = storedBoard ?? available - e;
    applyState(
      reflowToPanelWidth(
        {
          editorWidth: e,
          boardWidth: b,
          editorHidden: false,
          boardHidden: false,
        },
        panelW
      )
    );
  }, [applyState]);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;

    const onResize = () => {
      if (dragTargetRef.current) return;
      const panelW = el.clientWidth;
      if (panelW <= 0 || !initialized.current) return;
      applyState(reflowToPanelWidth(stateRef.current, panelW));
    };

    const observer = new ResizeObserver(onResize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [applyState]);

  useEffect(() => {
    const el = mainRef.current;
    if (!el || !initialized.current) return;
    const id = requestAnimationFrame(() => {
      const panelW = el.clientWidth;
      if (panelW > 0) {
        applyState(reflowToPanelWidth(stateRef.current, panelW));
      }
    });
    return () => cancelAnimationFrame(id);
  }, [sidebarVisible, applyState]);

  useEffect(() => {
    if (!dragTarget) return;

    const onMove = (e: PointerEvent) => {
      const session = dragRef.current;
      const panel = mainRef.current;
      if (!session || !panel) return;

      const panelW = panel.clientWidth;
      const rect = panel.getBoundingClientRect();
      if (panelW <= 0) return;

      if (dragTarget === "board") {
        const boardW = rect.right - e.clientX - SPLITTER_SIZE;
        if (boardW < COLLAPSE_AT) {
          applyState({
            editorWidth: panelW - COLLAPSED_SPLITTER - SPLITTER_SIZE,
            boardWidth: 0,
            editorHidden: false,
            boardHidden: true,
          });
          return;
        }
        const b = Math.max(MIN_BOARD, boardW);
        const eW = panelW - b - SPLITTER_SIZE * 2;
        if (eW < COLLAPSE_AT) {
          applyState({
            editorWidth: 0,
            boardWidth: panelW - COLLAPSED_SPLITTER - SPLITTER_SIZE,
            editorHidden: true,
            boardHidden: false,
          });
          return;
        }
        applyState({
          editorWidth: Math.max(MIN_EDITOR, eW),
          boardWidth: b,
          editorHidden: false,
          boardHidden: false,
        });
        return;
      }

      const editorW = e.clientX - rect.left - SPLITTER_SIZE;
      if (editorW < COLLAPSE_AT) {
        applyState({
          editorWidth: 0,
          boardWidth: panelW - COLLAPSED_SPLITTER - SPLITTER_SIZE,
          editorHidden: true,
          boardHidden: false,
        });
        return;
      }
      const eW = Math.max(MIN_EDITOR, editorW);
      const bW = panelW - eW - SPLITTER_SIZE * 2;
      if (bW < COLLAPSE_AT) {
        applyState({
          editorWidth: panelW - COLLAPSED_SPLITTER - SPLITTER_SIZE,
          boardWidth: 0,
          editorHidden: false,
          boardHidden: true,
        });
        return;
      }
      applyState({
        editorWidth: eW,
        boardWidth: Math.max(MIN_BOARD, bW),
        editorHidden: false,
        boardHidden: false,
      });
    };

    const onUp = () => {
      dragRef.current = null;
      setDragTarget(null);
      document.body.classList.remove("panel-resizing");
      persist(stateRef.current);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragTarget, applyState]);

  const startDrag = useCallback(
    (target: DragTarget, e: React.PointerEvent) => {
      e.preventDefault();
      const panelW = mainRef.current?.clientWidth ?? 0;
      const s = stateRef.current;

      if (target === "editor" && s.editorHidden && panelW > 0) {
        const eW = loadNum(STORAGE_EDITOR_WIDTH) ?? Math.round(panelW * DEFAULT_EDITOR_RATIO);
        const bW = panelW - eW - SPLITTER_SIZE * 2;
        applyState({
          editorWidth: Math.max(MIN_EDITOR, eW),
          boardWidth: Math.max(MIN_BOARD, bW),
          editorHidden: false,
          boardHidden: false,
        });
      }

      if (target === "board" && s.boardHidden && panelW > 0) {
        const bW = loadNum(STORAGE_BOARD_WIDTH) ?? Math.round(panelW * (1 - DEFAULT_EDITOR_RATIO));
        const eW = panelW - bW - SPLITTER_SIZE * 2;
        applyState({
          editorWidth: Math.max(MIN_EDITOR, eW),
          boardWidth: Math.max(MIN_BOARD, bW),
          editorHidden: false,
          boardHidden: false,
        });
      }

      const current = stateRef.current;
      dragRef.current = {
        startX: e.clientX,
        startEditor: current.editorHidden ? 0 : current.editorWidth,
        startBoard: current.boardHidden ? 0 : current.boardWidth,
      };
      setDragTarget(target);
      document.body.classList.add("panel-resizing");
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [applyState]
  );

  const toggleEditor = useCallback(() => {
    const panelW = mainRef.current?.clientWidth ?? 800;
    const s = stateRef.current;
    const nextHidden = !s.editorHidden;

    const next: PanelState = {
      ...s,
      editorHidden: nextHidden,
      editorWidth: nextHidden ? 0 : s.editorWidth,
    };
    applyState(reflowToPanelWidth(next, panelW));
    persist(stateRef.current);
  }, [applyState]);

  const toggleBoard = useCallback(() => {
    const panelW = mainRef.current?.clientWidth ?? 800;
    const s = stateRef.current;
    const nextHidden = !s.boardHidden;

    const next: PanelState = {
      ...s,
      boardHidden: nextHidden,
      boardWidth: nextHidden ? 0 : s.boardWidth,
    };
    applyState(reflowToPanelWidth(next, panelW));
    persist(stateRef.current);
  }, [applyState]);

  const setBoardPanelWidth = useCallback(
    (width: number) => {
      const panelW = mainRef.current?.clientWidth ?? 800;
      const w = clampBoardWidth(width);
      const s = stateRef.current;
      const next = reflowToPanelWidth(
        {
          ...s,
          boardWidth: w,
          boardHidden: false,
        },
        panelW
      );
      applyState(next);
      persist(next);
    },
    [applyState]
  );

  const setBoardPanelHidden = useCallback(
    (hidden: boolean) => {
      const panelW = mainRef.current?.clientWidth ?? 800;
      const s = stateRef.current;
      const next = reflowToPanelWidth(
        {
          ...s,
          boardHidden: hidden,
          boardWidth: hidden ? 0 : s.boardWidth || loadBoardPanelWidth() || MIN_BOARD,
        },
        panelW
      );
      applyState(next);
      persist(next);
      saveBoardPanelHidden(hidden);
    },
    [applyState]
  );

  return {
    mainRef,
    editorWidth: editorHidden ? 0 : editorWidth,
    boardWidth: boardHidden ? 0 : boardWidth,
    editorHidden,
    boardHidden,
    draggingEditor: dragTarget === "editor",
    draggingBoard: dragTarget === "board",
    onEditorSplitterDown: (e: React.PointerEvent) => startDrag("editor", e),
    onBoardSplitterDown: (e: React.PointerEvent) => startDrag("board", e),
    onEditorSplitterDoubleClick: toggleEditor,
    onBoardSplitterDoubleClick: toggleBoard,
    setBoardPanelWidth,
    setBoardPanelHidden,
  };
}
