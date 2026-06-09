const STORAGE_KEY = "gdd-editor-board-size";

export const DEFAULT_BOARD_WIDTH = 3200;
export const DEFAULT_BOARD_HEIGHT = 2400;
export const MIN_BOARD_DIMENSION = 800;
export const MAX_BOARD_DIMENSION = 8000;

export type BoardSizePresetId = "default" | "hd" | "wide" | "large";

export const BOARD_SIZE_PRESET_IDS: BoardSizePresetId[] = [
  "default",
  "hd",
  "wide",
  "large",
];

export const BOARD_SIZE_PRESETS: Record<
  BoardSizePresetId,
  { width: number; height: number }
> = {
  default: { width: 3200, height: 2400 },
  hd: { width: 1920, height: 1080 },
  wide: { width: 3840, height: 2160 },
  large: { width: 4800, height: 3600 },
};

export interface BoardSize {
  width: number;
  height: number;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function normalizeBoardSize(width: number, height: number): BoardSize {
  return {
    width: Math.round(clamp(width, MIN_BOARD_DIMENSION, MAX_BOARD_DIMENSION)),
    height: Math.round(
      clamp(height, MIN_BOARD_DIMENSION, MAX_BOARD_DIMENSION)
    ),
  };
}

export function loadBoardSize(): BoardSize {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        width: DEFAULT_BOARD_WIDTH,
        height: DEFAULT_BOARD_HEIGHT,
      };
    }
    const parsed = JSON.parse(raw) as Partial<BoardSize>;
    if (
      typeof parsed.width !== "number" ||
      typeof parsed.height !== "number"
    ) {
      return {
        width: DEFAULT_BOARD_WIDTH,
        height: DEFAULT_BOARD_HEIGHT,
      };
    }
    return normalizeBoardSize(parsed.width, parsed.height);
  } catch {
    return {
      width: DEFAULT_BOARD_WIDTH,
      height: DEFAULT_BOARD_HEIGHT,
    };
  }
}

export function saveBoardSize(size: BoardSize): BoardSize {
  const normalized = normalizeBoardSize(size.width, size.height);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function boardSizeMatchesPreset(
  size: BoardSize,
  presetId: BoardSizePresetId
): boolean {
  const preset = BOARD_SIZE_PRESETS[presetId];
  return size.width === preset.width && size.height === preset.height;
}
