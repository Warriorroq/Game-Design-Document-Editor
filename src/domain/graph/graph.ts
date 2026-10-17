import type { GddSection, GraphData, GraphEdgeStyle, GraphSettings } from "@/domain/types";

export const DEFAULT_NODE_COLOR = "#e8f0ff";

export const SPRING_LENGTH = 2.8;

export const EDGE_STYLES: GraphEdgeStyle[] = ["solid", "dotted", "ghost"];

export const DEFAULT_GRAPH_SETTINGS: GraphSettings = {
  inkSpread: true,
  inkHops: 3,
  inkSoftness: 0.85,
  inkIntensity: 1.45,
  edgeStyle: "solid",
  expand: 1.8,
  repulsion: 8,
  springStrength: 9,
  springLength: SPRING_LENGTH,
  orphanPull: 6
};

export function defaultGraphData(): GraphData {
  return {
    version: 1,
    pointCount: 0,
    centerId: null,
    settings: { ...DEFAULT_GRAPH_SETTINGS },
    nodes: [],
    edges: []
  };
}

function normalizeEdgeStyle(style: unknown): GraphEdgeStyle {
  return EDGE_STYLES.includes(style as GraphEdgeStyle) ? (style as GraphEdgeStyle) : "solid";
}

export function normalizeGraphSettings(settings: Partial<GraphSettings> | undefined): GraphSettings {
  const base = DEFAULT_GRAPH_SETTINGS;
  if (!settings) return { ...base };
  return {
    inkSpread: settings.inkSpread !== false,
    inkHops: Number.isFinite(settings.inkHops) ? Number(settings.inkHops) : base.inkHops,
    inkSoftness: Number.isFinite(settings.inkSoftness) ? Number(settings.inkSoftness) : base.inkSoftness,
    inkIntensity: Number.isFinite(settings.inkIntensity) ? Number(settings.inkIntensity) : base.inkIntensity,
    edgeStyle: normalizeEdgeStyle(settings.edgeStyle),
    expand: Number.isFinite(settings.expand) ? Number(settings.expand) : base.expand,
    repulsion: Number.isFinite(settings.repulsion) ? Number(settings.repulsion) : base.repulsion,
    springStrength: Number.isFinite(settings.springStrength) ? Number(settings.springStrength) : base.springStrength,
    springLength: Number.isFinite(settings.springLength) ? Number(settings.springLength) : base.springLength,
    orphanPull: Number.isFinite(settings.orphanPull) ? Number(settings.orphanPull) : base.orphanPull
  };
}

export function normalizeGraphData(data: GraphData | undefined): GraphData {
  const base = defaultGraphData();
  if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) return base;
  return {
    version: typeof data.version === "number" ? data.version : 1,
    pointCount: typeof data.pointCount === "number" ? data.pointCount : data.nodes.length,
    centerId: data.centerId ?? null,
    settings: normalizeGraphSettings(data.settings),
    nodes: data.nodes.map((n) => ({
      id: String(n.id),
      name: String(n.name ?? ""),
      description: String(n.description ?? ""),
      color: String(n.color || DEFAULT_NODE_COLOR),
      x: Number(n.x) || 0,
      y: Number(n.y) || 0,
      z: Number(n.z) || 0
    })),
    edges: data.edges.map((e) => ({
      from: String(e.from),
      to: String(e.to),
      style: normalizeEdgeStyle(e.style)
    }))
  };
}

export function isGraphSection(section: GddSection): boolean {
  return section.kind === "graph";
}

export function isImmersiveSection(section: GddSection): boolean {
  return section.kind === "space3d" || section.kind === "graph";
}
