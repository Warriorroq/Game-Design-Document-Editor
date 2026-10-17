const STORAGE_KEY = "gdd-editor-graph-tooltip-hold-ms";

/** Default hover time before a point description stays open. */
export const DEFAULT_GRAPH_TOOLTIP_HOLD_MS = 1200;

export const MIN_GRAPH_TOOLTIP_HOLD_MS = 300;
export const MAX_GRAPH_TOOLTIP_HOLD_MS = 10000;

function clampHoldMs(ms: number): number {
  if (!Number.isFinite(ms)) return DEFAULT_GRAPH_TOOLTIP_HOLD_MS;
  return Math.min(MAX_GRAPH_TOOLTIP_HOLD_MS, Math.max(MIN_GRAPH_TOOLTIP_HOLD_MS, Math.round(ms)));
}

function loadGraphTooltipHoldMs(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return DEFAULT_GRAPH_TOOLTIP_HOLD_MS;
    return clampHoldMs(Number(raw));
  } catch {
    return DEFAULT_GRAPH_TOOLTIP_HOLD_MS;
  }
}

let graphTooltipHoldMs = loadGraphTooltipHoldMs();

export function getGraphTooltipHoldMs(): number {
  return graphTooltipHoldMs;
}

export function saveGraphTooltipHoldMs(ms: number): number {
  graphTooltipHoldMs = clampHoldMs(ms);
  localStorage.setItem(STORAGE_KEY, String(graphTooltipHoldMs));
  window.dispatchEvent(new Event("gdd-graph-tooltip-hold-ms"));
  return graphTooltipHoldMs;
}

export function graphTooltipHoldMsToSeconds(ms: number): number {
  return Math.round((ms / 1000) * 10) / 10;
}

export function graphTooltipHoldSecondsToMs(seconds: number): number {
  return clampHoldMs(seconds * 1000);
}
