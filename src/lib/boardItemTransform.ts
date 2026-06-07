import type { BoardItem } from "../types";

const SNAP_ANGLES = [0, 90, 180, 270];
const SNAP_THRESHOLD = 10;

function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function snapRotationAngle(deg: number): number {
  const normalized = normalizeAngle(deg);
  for (const snap of SNAP_ANGLES) {
    if (Math.abs(normalized - snap) <= SNAP_THRESHOLD) return snap;
  }
  return Math.round(normalized);
}

/** Radians from center to pointer (screen coords). */
export function pointerAngleRad(
  centerX: number,
  centerY: number,
  pointerX: number,
  pointerY: number
): number {
  return Math.atan2(pointerY - centerY, pointerX - centerX);
}

export function rotationDeltaDeg(startRad: number, currentRad: number): number {
  return ((currentRad - startRad) * 180) / Math.PI;
}

export function boardItemTransform(item: BoardItem): string {
  const rotation = item.rotation ?? 0;
  const scaleX = item.flipH ? -1 : 1;
  const scaleY = item.flipV ? -1 : 1;
  if (rotation === 0 && scaleX === 1 && scaleY === 1) return "none";
  return `rotate(${rotation}deg) scale(${scaleX}, ${scaleY})`;
}
