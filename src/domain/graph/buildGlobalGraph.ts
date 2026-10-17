import { DEFAULT_GRAPH_SETTINGS, DEFAULT_NODE_COLOR } from "@/domain/graph/graph";
import type { GddDocument, GddSection, GraphData, GraphEdgeData, GraphNodeData } from "@/domain/types";
import { extractLinksFromText } from "@/features/links/lib/linkifyText";
import { parseGddHref, suggestLinkText } from "@/features/links/lib/links";

const SECTION_COLOR: Record<string, string> = {
  document: DEFAULT_NODE_COLOR,
  space3d: "#b8e0ff",
  graph: "#d0c4ff"
};

const EXTERNAL_COLOR = "#ffc28a";

/** Sentinel id mapped to the live invisible core in GraphEngine.fromJSON. */
export const GLOBAL_GRAPH_CORE_ID = "__core__";

function collectHtmlHrefs(html: string): string[] {
  if (!html.trim()) return [];
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return [...doc.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")?.trim() ?? "").filter(Boolean);
  } catch {
    return [];
  }
}

function collectSectionHrefs(section: GddSection): string[] {
  const hrefs: string[] = [];
  hrefs.push(...collectHtmlHrefs(section.content));
  hrefs.push(...extractLinksFromText(section.description));
  for (const text of section.texts ?? []) {
    hrefs.push(...extractLinksFromText(text.content));
  }
  if (section.kind === "graph") {
    for (const node of section.graph?.nodes ?? []) {
      hrefs.push(...extractLinksFromText(node.description));
      hrefs.push(...extractLinksFromText(node.name));
    }
  }
  return hrefs;
}

function externalNodeId(url: string): string {
  return `ext:${encodeURIComponent(url)}`;
}

function sectionKindColor(section: GddSection): string {
  const kind = section.kind ?? "document";
  return SECTION_COLOR[kind] ?? DEFAULT_NODE_COLOR;
}

function fibonacciSphere(index: number, total: number, radius: number): { x: number; y: number; z: number } {
  if (total <= 1) return { x: radius * 0.4, y: 0, z: 0 };
  const offset = 2 / total;
  const y = index * offset - 1 + offset / 2;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const phi = index * Math.PI * (3 - Math.sqrt(5));
  return {
    x: Math.cos(phi) * r * radius,
    y: y * radius,
    z: Math.sin(phi) * r * radius
  };
}

/** Undirected connected components among point nodes (core excluded). */
function findIslands(nodeIds: string[], edges: GraphEdgeData[]): string[][] {
  const adj = new Map<string, string[]>();
  for (const id of nodeIds) adj.set(id, []);
  for (const edge of edges) {
    if (edge.from === GLOBAL_GRAPH_CORE_ID || edge.to === GLOBAL_GRAPH_CORE_ID) continue;
    if (!adj.has(edge.from) || !adj.has(edge.to)) continue;
    adj.get(edge.from)!.push(edge.to);
    adj.get(edge.to)!.push(edge.from);
  }

  const seen = new Set<string>();
  const islands: string[][] = [];
  for (const id of nodeIds) {
    if (seen.has(id)) continue;
    const island: string[] = [];
    const stack = [id];
    seen.add(id);
    while (stack.length) {
      const cur = stack.pop()!;
      island.push(cur);
      for (const next of adj.get(cur) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        stack.push(next);
      }
    }
    islands.push(island);
  }
  return islands;
}

/**
 * Builds a read-only project graph from inter-section and external https links.
 * Node ids are section UUIDs or `ext:<urlencoded url>`.
 * Each island is tethered to the invisible core by exactly one node (prefer first section in doc order).
 */
export function buildGlobalGraph(doc: GddDocument): GraphData {
  const sectionById = new Map(doc.sections.map((s) => [s.id, s]));
  const sectionOrder = new Map(doc.sections.map((s, index) => [s.id, index]));
  const nodes = new Map<string, GraphNodeData>();
  const edgeKeys = new Set<string>();
  const edges: GraphEdgeData[] = [];

  const ensureSectionNode = (section: GddSection) => {
    if (nodes.has(section.id)) return;
    nodes.set(section.id, {
      id: section.id,
      name: section.title || "Section",
      description: section.description || "",
      color: sectionKindColor(section),
      x: 0,
      y: 0,
      z: 0
    });
  };

  const ensureExternalNode = (url: string) => {
    const id = externalNodeId(url);
    if (nodes.has(id)) return id;
    nodes.set(id, {
      id,
      name: suggestLinkText(doc, url),
      description: url,
      color: EXTERNAL_COLOR,
      x: 0,
      y: 0,
      z: 0
    });
    return id;
  };

  const addEdge = (from: string, to: string) => {
    if (from === to) return;
    const key = [from, to].sort().join("|");
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ from, to, style: "solid" });
  };

  // Always show every section so the project map is complete.
  for (const section of doc.sections) {
    ensureSectionNode(section);
  }

  for (const section of doc.sections) {
    const hrefs = collectSectionHrefs(section);
    for (const href of hrefs) {
      const link = parseGddHref(href);
      if (!link) continue;

      if (link.type === "external") {
        const toId = ensureExternalNode(link.url);
        addEdge(section.id, toId);
        continue;
      }

      const target = sectionById.get(link.sectionId);
      if (!target) continue;
      ensureSectionNode(target);
      addEdge(section.id, target.id);
    }
  }

  const nodeList = [...nodes.values()];
  const nodeIds = nodeList.map((n) => n.id);

  // One core tether per island. Prefer earliest section in document order.
  const pickIslandAnchor = (island: string[]): string =>
    island.slice().sort((a, b) => {
      const ai = sectionOrder.has(a) ? sectionOrder.get(a)! : Number.MAX_SAFE_INTEGER;
      const bi = sectionOrder.has(b) ? sectionOrder.get(b)! : Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return a.localeCompare(b);
    })[0]!;

  for (const island of findIslands(nodeIds, edges)) {
    if (island.length === 0) continue;
    addEdge(GLOBAL_GRAPH_CORE_ID, pickIslandAnchor(island));
  }

  const radius = Math.max(2.2, Math.sqrt(Math.max(nodeList.length, 1)) * 1.1);
  nodeList.forEach((node, index) => {
    const pos = fibonacciSphere(index, nodeList.length, radius);
    node.x = pos.x;
    node.y = pos.y;
    node.z = pos.z;
  });

  return {
    version: 1,
    pointCount: nodeList.length,
    centerId: GLOBAL_GRAPH_CORE_ID,
    settings: {
      ...DEFAULT_GRAPH_SETTINGS,
      // Slightly calmer layout for overview graphs
      expand: 1.4,
      springLength: 3.2,
      inkSpread: false
    },
    nodes: nodeList,
    edges
  };
}

export function globalGraphSignature(data: GraphData): string {
  return `${data.nodes.length}:${data.edges.length}:${data.edges
    .map((e) => `${e.from}>${e.to}`)
    .sort()
    .join(",")}:${data.nodes.map((n) => `${n.id}:${n.name}`).join("|")}`;
}

export function isExternalGlobalNodeId(id: string): boolean {
  return id.startsWith("ext:");
}

export function externalUrlFromGlobalNodeId(id: string): string | null {
  if (!isExternalGlobalNodeId(id)) return null;
  try {
    return decodeURIComponent(id.slice(4));
  } catch {
    return null;
  }
}
