export const BOARD_MAX_SCALE = 4;
export const INITIAL_BOARD_SCALE = 1;

export interface BoardViewport {
  scale: number;
  panX: number;
  panY: number;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function minBoardScale(
  viewW: number,
  viewH: number,
  canvasW: number,
  canvasH: number
): number {
  if (viewW <= 0 || viewH <= 0 || canvasW <= 0 || canvasH <= 0) return 0.15;
  return Math.max(viewW / canvasW, viewH / canvasH);
}

export function constrainBoardViewport(
  viewport: BoardViewport,
  viewW: number,
  viewH: number,
  canvasW: number,
  canvasH: number
): BoardViewport {
  if (viewW <= 0 || viewH <= 0) return viewport;

  const scale = clamp(
    viewport.scale,
    minBoardScale(viewW, viewH, canvasW, canvasH),
    BOARD_MAX_SCALE
  );
  const contentW = canvasW * scale;
  const contentH = canvasH * scale;

  let panX: number;
  let panY: number;

  if (contentW <= viewW) {
    panX = (viewW - contentW) / 2;
  } else {
    panX = clamp(viewport.panX, viewW - contentW, 0);
  }

  if (contentH <= viewH) {
    panY = (viewH - contentH) / 2;
  } else {
    panY = clamp(viewport.panY, viewH - contentH, 0);
  }

  return { scale, panX, panY };
}

export function fitBoardViewport(
  viewW: number,
  viewH: number,
  canvasW: number,
  canvasH: number
): BoardViewport {
  const scale = Math.max(
    minBoardScale(viewW, viewH, canvasW, canvasH),
    INITIAL_BOARD_SCALE
  );
  return constrainBoardViewport(
    {
      scale,
      panX: viewW / 2 - (canvasW / 2) * scale,
      panY: viewH / 2 - (canvasH / 2) * scale,
    },
    viewW,
    viewH,
    canvasW,
    canvasH
  );
}
