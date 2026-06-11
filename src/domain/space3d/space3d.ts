import type {
  GddSection,
  Space3DData,
  Space3DEditMode,
  Space3DGrid,
  Space3DObject,
  Space3DObjectType,
} from "@/domain/types";

export const SPACE3D_COLORS = [
  "#6366f1",
  "#22c55e",
  "#f97316",
  "#ec4899",
  "#06b6d4",
  "#eab308",
] as const;

export function defaultSpace3DGrid(): Space3DGrid {
  return {
    enabled: false,
    step: 1,
    size: 40,
    centerColor: "#3f3f46",
    lineColor: "#27272a",
  };
}

export function isGridEnabled(grid: Space3DGrid | undefined): boolean {
  const normalized = normalizeSpace3DGrid(grid);
  return normalized.enabled === true && (normalized.step ?? 0) > 0;
}

function clampGridNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const hex = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    const r = hex[1]!;
    const g = hex[2]!;
    const b = hex[3]!;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
}

export function normalizeSpace3DGrid(grid: Space3DGrid | undefined): Space3DGrid {
  const base = defaultSpace3DGrid();
  if (!grid) return base;

  const legacyStep =
    typeof (grid as { divisions?: number }).divisions === "number" &&
    typeof grid.size === "number" &&
    (grid as { divisions: number }).divisions > 0
      ? grid.size / (grid as { divisions: number }).divisions
      : undefined;

  return {
    enabled: grid.enabled ?? grid.visible ?? false,
    step: clampGridNumber(grid.step ?? legacyStep, 0, 10, base.step!),
    size: clampGridNumber(grid.size, 4, 200, base.size!),
    centerColor: normalizeHexColor(grid.centerColor, base.centerColor!),
    lineColor: normalizeHexColor(grid.lineColor, base.lineColor!),
  };
}

export function defaultSpace3DData(): Space3DData {
  return {
    objects: [],
    camera: {
      position: { x: 8, y: 6, z: 8 },
      target: { x: 0, y: 0, z: 0 },
    },
    grid: defaultSpace3DGrid(),
  };
}

function normalizeObjectType(type: string | undefined): Space3DObjectType {
  if (type === "sphere") return "sphere";
  if (type === "model") return "model";
  return "box";
}

function readScale(obj: Space3DObject & { scale?: number }) {
  const legacy = obj.scale;
  return {
    scaleX: obj.scaleX ?? legacy ?? 1,
    scaleY: obj.scaleY ?? legacy ?? 1,
    scaleZ: obj.scaleZ ?? legacy ?? 1,
  };
}

export function normalizeSpace3DObject(obj: Space3DObject): Space3DObject {
  const type = normalizeObjectType(obj.type);
  const scales = readScale(obj);
  return {
    id: obj.id,
    type,
    x: Number.isFinite(obj.x) ? obj.x : 0,
    y: Number.isFinite(obj.y) ? obj.y : 0,
    z: Number.isFinite(obj.z) ? obj.z : 0,
    color: type === "model" ? undefined : obj.color || SPACE3D_COLORS[0],
    scaleX: scales.scaleX > 0 ? Math.max(0.001, scales.scaleX) : 1,
    scaleY: scales.scaleY > 0 ? Math.max(0.001, scales.scaleY) : 1,
    scaleZ: scales.scaleZ > 0 ? Math.max(0.001, scales.scaleZ) : 1,
    rotationX: Number.isFinite(obj.rotationX) ? obj.rotationX : 0,
    rotationY: Number.isFinite(obj.rotationY) ? obj.rotationY : 0,
    rotationZ: Number.isFinite(obj.rotationZ) ? obj.rotationZ : 0,
    assetId: type === "model" ? obj.assetId : undefined,
  };
}

export function normalizeSpace3DData(data: Space3DData | undefined): Space3DData {
  const base = defaultSpace3DData();
  if (!data) return base;
  return {
    camera: data.camera ?? base.camera,
    grid: normalizeSpace3DGrid(data.grid),
    objects: Array.isArray(data.objects)
      ? data.objects.map((obj) => normalizeSpace3DObject(obj))
      : [],
  };
}

export function isSpace3DSection(section: GddSection): boolean {
  return section.kind === "space3d";
}

export function createSpace3DPrimitive(
  type: "box" | "sphere",
  index: number
): Space3DObject {
  const offset = index * 1.5;
  return normalizeSpace3DObject({
    id: crypto.randomUUID(),
    type,
    x: offset - 1.5,
    y: type === "sphere" ? 0.5 : 0.5,
    z: 0,
    color: SPACE3D_COLORS[index % SPACE3D_COLORS.length],
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
  });
}

export function createSpace3DModelObject(
  assetId: string,
  index: number
): Space3DObject {
  const offset = index * 2;
  return normalizeSpace3DObject({
    id: crypto.randomUUID(),
    type: "model",
    assetId,
    x: offset - 2,
    y: 0,
    z: 0,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
  });
}

export function transformModeToControls(mode: Space3DEditMode): "translate" | "rotate" | "scale" {
  switch (mode) {
    case "scale":
      return "scale";
    case "rotate":
      return "rotate";
    default:
      return "translate";
  }
}
