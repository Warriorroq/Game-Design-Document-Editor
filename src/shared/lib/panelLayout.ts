export const STORAGE_EDITOR_WIDTH = "gdd-editor-panel-width";
export const STORAGE_EDITOR_HIDDEN = "gdd-editor-panel-hidden";
export const STORAGE_BOARD_WIDTH = "gdd-editor-board-width";
export const STORAGE_BOARD_HIDDEN = "gdd-editor-board-hidden";

export const COMPACT_LAYOUT_MAX_WIDTH = 900;
export const COMPACT_LAYOUT_MEDIA = `(max-width: ${COMPACT_LAYOUT_MAX_WIDTH}px)`;

export const PANEL_MIN_BOARD = 160;
export const PANEL_MAX_BOARD = 720;
export const PANEL_DEFAULT_BOARD = 320;

export function loadBoardPanelWidth(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_BOARD_WIDTH);
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(clampBoardWidth(n));
  } catch {
    return null;
  }
}

export function loadBoardPanelHidden(): boolean {
  try {
    return localStorage.getItem(STORAGE_BOARD_HIDDEN) === "1";
  } catch {
    return false;
  }
}

export function clampBoardWidth(width: number): number {
  return Math.min(PANEL_MAX_BOARD, Math.max(PANEL_MIN_BOARD, Math.round(width)));
}

export function saveBoardPanelWidth(width: number): void {
  try {
    localStorage.setItem(STORAGE_BOARD_WIDTH, String(clampBoardWidth(width)));
  } catch {
    /* ignore */
  }
}

export function saveBoardPanelHidden(hidden: boolean): void {
  try {
    localStorage.setItem(STORAGE_BOARD_HIDDEN, hidden ? "1" : "0");
  } catch {
    /* ignore */
  }
}
