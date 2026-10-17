import * as THREE from "three";

import { DEFAULT_GRAPH_SETTINGS, DEFAULT_NODE_COLOR, EDGE_STYLES, SPRING_LENGTH } from "@/domain/graph/graph";
import type { GraphData, GraphEdgeStyle, GraphSettings } from "@/domain/types";

export { DEFAULT_NODE_COLOR, EDGE_STYLES, SPRING_LENGTH };
export const DEFAULT_SETTINGS = DEFAULT_GRAPH_SETTINGS;

const NODE_RADIUS = 0.12;
const CENTER_RADIUS = 0.28;
const CENTER_COLOR = 0xffe6a8;
const NODE_HOVER = 0xffffff;
const NODE_SELECTED = 0xffd080;
const EDGE_COLOR = 0x6a8ab8;

export const ORPHAN_CORE_DISTANCE = 1.1;

let nextId = 1;

type HighlightMode = "idle" | "selected" | "hover";

interface EngineNode {
  id: string;
  name: string;
  description: string;
  color?: string;
  paintColor?: string;
  liveColor?: THREE.Color;
  mesh: THREE.Mesh;
  label: THREE.Sprite | null;
  fixed: boolean;
  highlightMode?: HighlightMode;
}

interface EngineEdge {
  id: string;
  from: string;
  to: string;
  key: string;
  line: THREE.Line;
  toCore: boolean;
  coreFirst: boolean;
  style: GraphEdgeStyle;
  highlighted?: boolean;
}

interface AddNodeOptions {
  /** Preserve this id when loading from JSON (section / external node ids). */
  id?: string;
  name?: string;
  description?: string;
  color?: string;
  x?: number;
  y?: number;
  z?: number;
  linkToCenter?: boolean;
}

interface ConnectOptions {
  style?: GraphEdgeStyle;
}

interface UpdateNodeOptions {
  name?: string;
  description?: string;
  color?: string;
}

interface LerpLineOptions {
  toCore?: boolean;
  highlight?: boolean;
  style?: GraphEdgeStyle;
  length?: number;
}

interface InkAccum {
  r: number;
  g: number;
  b: number;
  w: number;
}

interface NodeLink {
  edgeId: string;
  otherId: string;
  otherName: string;
}

type LerpLineMaterial = THREE.ShaderMaterial & {
  uniforms: {
    uColorA: { value: THREE.Color };
    uColorB: { value: THREE.Color };
    uOpacity: { value: number };
    uFadeEnd: { value: number };
    uHighlight: { value: number };
    uStyle: { value: number };
    uLength: { value: number };
  };
};

function asBasicMaterial(material: THREE.Material | THREE.Material[]): THREE.MeshBasicMaterial {
  return material as THREE.MeshBasicMaterial;
}

function asLerpMaterial(material: THREE.Material | THREE.Material[]): LerpLineMaterial {
  return material as LerpLineMaterial;
}

export class GraphEngine {
  scene: THREE.Scene;
  nodes: Map<string, EngineNode>;
  edges: Map<string, EngineEdge>;
  group: THREE.Group;
  velocities: Map<string, THREE.Vector3>;
  centerId: string | null;
  pointCount: number;
  settings: GraphSettings;
  nodeGeo: THREE.SphereGeometry;
  centerGeo: THREE.SphereGeometry;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.nodes = new Map();
    this.edges = new Map();
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.velocities = new Map();
    this.centerId = null;
    this.pointCount = 0;
    this.settings = { ...DEFAULT_SETTINGS };

    this.nodeGeo = new THREE.SphereGeometry(NODE_RADIUS, 16, 16);
    this.centerGeo = new THREE.SphereGeometry(CENTER_RADIUS, 24, 24);
  }

  setSettings(partial: Partial<GraphSettings> = {}): void {
    Object.assign(this.settings, partial);
  }

  createCenter(): string {
    if (this.centerId) return this.centerId;

    const id = `n${nextId++}`;
    const mat = new THREE.MeshBasicMaterial({
      color: CENTER_COLOR,
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(this.centerGeo, mat);
    mesh.position.set(0, 0, 0);
    mesh.userData = { id, type: "node", fixed: true };

    this.group.add(mesh);
    this.nodes.set(id, { id, name: "", description: "", mesh, label: null, fixed: true });
    this.velocities.set(id, new THREE.Vector3());
    this.centerId = id;
    return id;
  }

  addNode({ id: preferredId, name, description, color, x, y, z, linkToCenter = false }: AddNodeOptions = {}): string {
    const requested = preferredId?.trim() || "";
    let id = requested;
    if (!id || this.nodes.has(id) || id === this.centerId) {
      id = `n${nextId++}`;
    } else {
      const match = /^n(\d+)$/.exec(id);
      if (match) nextId = Math.max(nextId, Number(match[1]) + 1);
    }
    this.pointCount += 1;
    const pointName = name || `point ${this.pointCount}`;
    const pointColor = this.#normalizeColor(color) || DEFAULT_NODE_COLOR;
    const mat = new THREE.MeshBasicMaterial({ color: pointColor });
    const mesh = new THREE.Mesh(this.nodeGeo, mat);

    if (x == null || y == null || z == null) {
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      const spawn = 0.35 + Math.random() * 0.4;
      mesh.position.copy(dir.multiplyScalar(spawn));
    } else {
      mesh.position.set(x, y, z);
    }

    mesh.userData = { id, type: "node", fixed: false };

    const label = this.#makeLabel(pointName);
    label.position.y = NODE_RADIUS + 0.22;
    mesh.add(label);

    this.group.add(mesh);
    this.nodes.set(id, {
      id,
      name: pointName,
      description: description || "",
      color: pointColor,
      paintColor: pointColor,
      liveColor: new THREE.Color(pointColor),
      mesh,
      label,
      fixed: false,
      highlightMode: "idle"
    });
    this.velocities.set(id, new THREE.Vector3());

    if (linkToCenter && this.centerId) this.connect(this.centerId, id);
    return id;
  }

  #normalizeColor(color: string | undefined | null): string | null {
    if (!color) return null;
    try {
      const c = new THREE.Color(color);
      return `#${c.getHexString()}`;
    } catch {
      return null;
    }
  }

  #makeLabel(text: string): THREE.Sprite {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    const fontSize = 36;
    const font = `500 ${fontSize}px Outfit, system-ui, sans-serif`;
    ctx.font = font;
    const metrics = ctx.measureText(text);
    const padX = 16;
    const padY = 10;
    canvas.width = Math.ceil(metrics.width + padX * 2);
    canvas.height = fontSize + padY * 2;

    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(210, 225, 245, 0.9)";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false
      })
    );
    const scale = 0.007;
    sprite.scale.set(canvas.width * scale, canvas.height * scale, 1);
    sprite.center.set(0.5, 0);
    sprite.raycast = () => {};
    return sprite;
  }

  #disposeLabel(label: THREE.Sprite | null): void {
    if (!label) return;
    label.material.map?.dispose();
    label.material.dispose();
  }

  removeNode(id: string): void {
    if (id === this.centerId) return;
    const node = this.nodes.get(id);
    if (!node) return;

    for (const [edgeId, edge] of [...this.edges]) {
      if (edge.from === id || edge.to === id) this.removeEdge(edgeId);
    }

    this.group.remove(node.mesh);
    this.#disposeLabel(node.label);
    asBasicMaterial(node.mesh.material).dispose();
    this.nodes.delete(id);
    this.velocities.delete(id);
  }

  clearPoints(): void {
    for (const id of [...this.nodes.keys()]) {
      if (id !== this.centerId) this.removeNode(id);
    }
    this.pointCount = 0;
  }

  toJSON(): GraphData {
    const nodes: GraphData["nodes"] = [];
    for (const node of this.nodes.values()) {
      if (node.fixed) continue;
      const { x, y, z } = node.mesh.position;
      nodes.push({
        id: node.id,
        name: node.name,
        description: node.description,
        color: node.paintColor || node.color || DEFAULT_NODE_COLOR,
        x,
        y,
        z
      });
    }
    const edges: GraphData["edges"] = [];
    for (const edge of this.edges.values()) {
      edges.push({ from: edge.from, to: edge.to, style: edge.style || "solid" });
    }
    return {
      version: 1,
      pointCount: this.pointCount,
      centerId: this.centerId,
      settings: { ...this.settings },
      nodes,
      edges
    };
  }

  fromJSON(data: GraphData): void {
    if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
      throw new Error("Invalid graph file");
    }

    this.clearPoints();
    if (!this.centerId) this.createCenter();
    if (data.settings) this.setSettings({ ...DEFAULT_SETTINGS, ...data.settings });

    const idMap = new Map<string, string>();
    if (data.centerId) idMap.set(data.centerId, this.centerId!);

    let maxPoint = 0;
    for (const n of data.nodes) {
      // Keep source ids (section UUIDs / ext:…) so read-only activate can resolve them.
      const preserveId = n.id && n.id !== data.centerId ? n.id : undefined;
      const id = this.addNode({
        id: preserveId,
        name: n.name,
        description: n.description || "",
        color: n.color,
        x: n.x,
        y: n.y,
        z: n.z,
        linkToCenter: false
      });
      if (n.id) idMap.set(n.id, id);
      const match = String(n.name || "").match(/point\s+(\d+)/i);
      if (match) maxPoint = Math.max(maxPoint, Number(match[1]));
    }

    this.pointCount = Math.max(data.pointCount || 0, maxPoint, data.nodes.length);

    for (const e of data.edges) {
      const from = idMap.get(e.from) || (e.from === data.centerId ? this.centerId : null);
      const to = idMap.get(e.to) || (e.to === data.centerId ? this.centerId : null);
      if (from && to) this.connect(from, to, { style: e.style || "solid" });
    }
  }

  connect(fromId: string, toId: string, { style }: ConnectOptions = {}): string | null {
    if (fromId === toId) return null;
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) return null;

    const key = [fromId, toId].sort().join("|");
    for (const edge of this.edges.values()) {
      if (edge.key === key) return null;
    }

    const fromNode = this.nodes.get(fromId)!;
    const toNode = this.nodes.get(toId)!;
    const toCore = fromId === this.centerId || toId === this.centerId;
    const coreFirst = fromId === this.centerId;
    const edgeStyle: GraphEdgeStyle = style && EDGE_STYLES.includes(style) ? style : this.settings.edgeStyle || "solid";

    // Vertex 0 / progress 0 = from (or core when toCore), vertex 1 = to (or outer)
    let p0 = fromNode.mesh.position.clone();
    let p1 = toNode.mesh.position.clone();
    if (toCore && !coreFirst) {
      p0 = toNode.mesh.position.clone();
      p1 = fromNode.mesh.position.clone();
    }

    const geo = new THREE.BufferGeometry().setFromPoints([p0, p1]);
    geo.setAttribute("progress", new THREE.BufferAttribute(new Float32Array([0, 1]), 1));

    const { colorA, colorB } = this.#edgeEndpointColors(fromId, toId, toCore, coreFirst);
    const mat = this.#makeLerpLineMaterial(colorA, colorB, {
      toCore,
      highlight: false,
      style: edgeStyle,
      length: p0.distanceTo(p1)
    });
    const line = new THREE.Line(geo, mat);
    line.userData = { type: "edge", toCore, coreFirst };

    const id = `e${nextId++}`;
    line.userData.edgeId = id;
    this.group.add(line);
    this.edges.set(id, {
      id,
      from: fromId,
      to: toId,
      key,
      line,
      toCore,
      coreFirst,
      style: edgeStyle
    });
    return id;
  }

  setEdgeStyle(edgeId: string, style: GraphEdgeStyle): boolean {
    const edge = this.edges.get(edgeId);
    if (!edge || !EDGE_STYLES.includes(style)) return false;
    edge.style = style;
    this.#applyEdgeStyle(edge);
    this.#refreshEdgeColors(edge, !!edge.highlighted);
    return true;
  }

  #nodeDisplayColor(node: EngineNode | undefined): THREE.Color {
    if (!node || node.fixed) return new THREE.Color(EDGE_COLOR);
    if (node.liveColor) return node.liveColor.clone();
    return new THREE.Color(node.paintColor || node.color || DEFAULT_NODE_COLOR);
  }

  #edgeEndpointColors(
    fromId: string,
    toId: string,
    toCore: boolean,
    coreFirst: boolean
  ): { colorA: THREE.Color; colorB: THREE.Color } {
    const fromNode = this.nodes.get(fromId);
    const toNode = this.nodes.get(toId);

    if (toCore) {
      const outer = coreFirst ? toNode : fromNode;
      const outerColor = this.#nodeDisplayColor(outer);
      // Fade from dim outer tint at core → full outer color at the point
      const coreTint = outerColor.clone().multiplyScalar(0.25);
      return { colorA: coreTint, colorB: outerColor };
    }

    return {
      colorA: this.#nodeDisplayColor(fromNode),
      colorB: this.#nodeDisplayColor(toNode)
    };
  }

  #styleToUniform(style: GraphEdgeStyle | string): number {
    if (style === "dotted") return 1;
    if (style === "ghost") return 2;
    return 0;
  }

  #baseOpacity(edge: EngineEdge, highlight = false): number {
    if (highlight) return 0.95;
    if (edge.style === "ghost") return 0.14;
    if (edge.toCore) return 0.7;
    return 0.9;
  }

  #makeLerpLineMaterial(
    colorA: THREE.Color,
    colorB: THREE.Color,
    { toCore = false, highlight = false, style = "solid", length = 1 }: LerpLineOptions = {}
  ): LerpLineMaterial {
    const isGhost = style === "ghost";
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uColorA: { value: colorA.clone() },
        uColorB: { value: colorB.clone() },
        uOpacity: { value: highlight ? 0.95 : isGhost ? 0.14 : toCore ? 0.7 : 0.9 },
        uFadeEnd: { value: toCore ? 0.3 : 0.0 },
        uHighlight: { value: highlight ? 1.0 : 0.0 },
        uStyle: { value: this.#styleToUniform(style) },
        uLength: { value: Math.max(0.2, length) }
      },
      vertexShader: /* glsl */ `
        attribute float progress;
        varying float vProgress;
        void main() {
          vProgress = progress;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        uniform float uOpacity;
        uniform float uFadeEnd;
        uniform float uHighlight;
        uniform float uStyle;
        uniform float uLength;
        varying float vProgress;
        void main() {
          // Dotted: dashed pattern along the link
          if (uStyle > 0.5 && uStyle < 1.5) {
            float dashes = max(uLength * 2.8, 6.0);
            float pattern = fract(vProgress * dashes);
            if (pattern > 0.42) discard;
          }

          vec3 color = mix(uColorA, uColorB, vProgress);
          color = mix(color, vec3(1.0), uHighlight * 0.35);
          float alpha = uOpacity;
          if (uFadeEnd > 0.001) {
            alpha *= smoothstep(0.0, uFadeEnd, vProgress);
          }
          // Ghost stays very faint even when highlighted a bit more
          if (uStyle > 1.5) {
            alpha = mix(0.14, 0.28, uHighlight);
          }
          gl_FragColor = vec4(color, alpha);
        }
      `
    }) as LerpLineMaterial;
  }

  #applyEdgeStyle(edge: EngineEdge): void {
    const uniforms = asLerpMaterial(edge.line.material).uniforms;
    if (!uniforms) return;
    uniforms.uStyle.value = this.#styleToUniform(edge.style || "solid");
  }

  #refreshEdgeColors(edge: EngineEdge, highlight = false): void {
    const { colorA, colorB } = this.#edgeEndpointColors(edge.from, edge.to, edge.toCore, edge.coreFirst);
    const uniforms = asLerpMaterial(edge.line.material).uniforms;
    uniforms.uColorA.value.copy(colorA);
    uniforms.uColorB.value.copy(colorB);
    uniforms.uOpacity.value = this.#baseOpacity(edge, highlight);
    uniforms.uHighlight.value = highlight ? 1.0 : 0.0;
    uniforms.uFadeEnd.value = edge.toCore ? 0.3 : 0.0;
    uniforms.uStyle.value = this.#styleToUniform(edge.style || "solid");
  }

  #refreshEdgesForNode(nodeId: string): void {
    for (const edge of this.edges.values()) {
      if (edge.from === nodeId || edge.to === nodeId) {
        this.#refreshEdgeColors(edge, false);
      }
    }
  }

  removeEdge(id: string): void {
    const edge = this.edges.get(id);
    if (!edge) return;
    this.group.remove(edge.line);
    edge.line.geometry.dispose();
    asLerpMaterial(edge.line.material).dispose();
    this.edges.delete(id);
  }

  disconnect(fromId: string, toId: string): boolean {
    const key = [fromId, toId].sort().join("|");
    for (const [id, edge] of this.edges) {
      if (edge.key === key) {
        this.removeEdge(id);
        return true;
      }
    }
    return false;
  }

  areConnected(fromId: string, toId: string): string | null {
    const key = [fromId, toId].sort().join("|");
    for (const edge of this.edges.values()) {
      if (edge.key === key) return edge.id;
    }
    return null;
  }

  getLinksForNode(nodeId: string): NodeLink[] {
    const links: NodeLink[] = [];
    for (const edge of this.edges.values()) {
      let otherId: string | null = null;
      if (edge.from === nodeId) otherId = edge.to;
      else if (edge.to === nodeId) otherId = edge.from;
      if (!otherId) continue;
      const other = this.nodes.get(otherId);
      if (!other) continue;
      links.push({
        edgeId: edge.id,
        otherId,
        otherName: other.fixed ? "core" : other.name
      });
    }
    return links;
  }

  getEdgeLines(): THREE.Line[] {
    return [...this.edges.values()].map((e) => e.line);
  }

  setEdgeHighlight(edgeId: string, on: boolean): void {
    const edge = this.edges.get(edgeId);
    if (!edge) return;
    edge.highlighted = !!on;
    this.#refreshEdgeColors(edge, edge.highlighted);
  }

  setNodeHighlight(id: string, mode: HighlightMode | string | null | undefined): void {
    const node = this.nodes.get(id);
    if (!node) return;
    if (node.fixed) {
      asBasicMaterial(node.mesh.material).opacity = 0;
      return;
    }
    node.highlightMode = (mode || "idle") as HighlightMode;
    const mat = asBasicMaterial(node.mesh.material);
    if (mode === "selected") mat.color.setHex(NODE_SELECTED);
    else if (mode === "hover") mat.color.setHex(NODE_HOVER);
    else mat.color.copy(node.liveColor || new THREE.Color(node.paintColor || DEFAULT_NODE_COLOR));
  }

  setColor(id: string, color: string): boolean {
    const node = this.nodes.get(id);
    if (!node || node.fixed) return false;
    const next = this.#normalizeColor(color) || DEFAULT_NODE_COLOR;
    node.color = next;
    node.paintColor = next;
    if (!node.liveColor) node.liveColor = new THREE.Color(next);
    else node.liveColor.set(next);
    asBasicMaterial(node.mesh.material).color.set(next);
    this.#refreshEdgesForNode(id);
    return true;
  }

  getNodeMeshes(): THREE.Mesh[] {
    return [...this.nodes.values()].map((n) => n.mesh);
  }

  getNode(id: string): EngineNode | null {
    return this.nodes.get(id) || null;
  }

  setDescription(id: string, description: string): boolean {
    const node = this.nodes.get(id);
    if (!node || node.fixed) return false;
    node.description = description || "";
    return true;
  }

  setName(id: string, name: string): boolean {
    const node = this.nodes.get(id);
    if (!node || node.fixed) return false;
    const next = (name || "").trim();
    if (!next) return false;
    node.name = next;

    if (node.label) {
      node.mesh.remove(node.label);
      this.#disposeLabel(node.label);
    }
    const label = this.#makeLabel(next);
    label.position.y = NODE_RADIUS + 0.22;
    node.mesh.add(label);
    node.label = label;
    return true;
  }

  updateNode(id: string, { name, description, color }: UpdateNodeOptions = {}): void {
    if (name != null) this.setName(id, name);
    if (description != null) this.setDescription(id, description);
    if (color != null) this.setColor(id, color);
  }

  getEdge(id: string): EngineEdge | null {
    return this.edges.get(id) || null;
  }

  degree(id: string): number {
    let count = 0;
    for (const edge of this.edges.values()) {
      if (edge.from === id || edge.to === id) count++;
    }
    return count;
  }

  tick(dt = 0.016): void {
    const nodes = [...this.nodes.values()].filter((n) => !n.fixed);
    const n = nodes.length;
    if (n === 0) {
      this.#syncEdges();
      return;
    }

    this.#tickInkField(nodes);

    const s = this.settings;
    const speed = 2.6;
    const expand = s.expand;
    const repulsion = s.repulsion;
    const springK = s.springStrength;
    const springRest = s.springLength;
    const orphanK = s.orphanPull;
    const damping = 0.84;
    const maxSpeed = 16;

    const forces = new Map<string, THREE.Vector3>();
    const linked = new Map<string, boolean>();
    for (const node of nodes) {
      forces.set(node.id, new THREE.Vector3());
      linked.set(node.id, this.degree(node.id) > 0);
    }

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        const delta = new THREE.Vector3().subVectors(a.mesh.position, b.mesh.position);
        let dist = delta.length();
        if (dist < 0.05) {
          delta.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
          dist = 0.05;
        }
        const strength = repulsion / (dist * dist);
        delta.normalize().multiplyScalar(strength);
        forces.get(a.id)!.add(delta);
        forces.get(b.id)!.sub(delta);
      }
    }

    for (const node of nodes) {
      if (!linked.get(node.id)) continue;
      const pos = node.mesh.position;
      const r = pos.length();
      if (r < 0.01) {
        forces
          .get(node.id)!
          .add(
            new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
              .normalize()
              .multiplyScalar(expand * 2)
          );
      } else {
        forces.get(node.id)!.add(pos.clone().normalize().multiplyScalar(expand));
      }
    }

    for (const edge of this.edges.values()) {
      const a = this.nodes.get(edge.from);
      const b = this.nodes.get(edge.to);
      if (!a || !b || (a.fixed && b.fixed)) continue;

      const delta = new THREE.Vector3().subVectors(b.mesh.position, a.mesh.position);
      const dist = delta.length() || 0.01;
      const stretch = dist - springRest;
      delta.normalize().multiplyScalar(stretch * springK);

      if (!a.fixed) forces.get(a.id)!.add(delta);
      if (!b.fixed) forces.get(b.id)!.sub(delta);
    }

    for (const node of nodes) {
      if (linked.get(node.id)) continue;
      const pos = node.mesh.position;
      const r = pos.length() || 0.001;
      const target = pos.clone().normalize().multiplyScalar(ORPHAN_CORE_DISTANCE);
      if (r < 0.05) {
        target.set(ORPHAN_CORE_DISTANCE, 0, 0);
      }
      forces.get(node.id)!.add(target.sub(pos).multiplyScalar(orphanK));
    }

    const step = dt * speed;

    for (const node of nodes) {
      const f = forces.get(node.id)!;
      const vel = this.velocities.get(node.id)!;
      vel.add(f.multiplyScalar(step));
      vel.multiplyScalar(damping);
      if (vel.length() > maxSpeed) vel.setLength(maxSpeed);
      node.mesh.position.addScaledVector(vel, step);
    }

    if (this.centerId) {
      const center = this.nodes.get(this.centerId);
      if (center) center.mesh.position.set(0, 0, 0);
    }

    this.#syncEdges();
    if (this.settings.inkSpread) {
      for (const edge of this.edges.values()) {
        this.#refreshEdgeColors(edge, !!edge.highlighted);
      }
    }
  }

  /**
   * Ink spreads along connections (graph hops), not 3D space.
   * inkHops = 3 → reaches up to 3 linked nodes away, then stops.
   * Overlapping inks blend; farther hops get weaker influence.
   */
  #tickInkField(nodes: EngineNode[]): void {
    const s = this.settings;
    if (nodes.length === 0) return;

    if (!s.inkSpread) {
      for (const node of nodes) {
        const paint = new THREE.Color(node.paintColor || DEFAULT_NODE_COLOR);
        if (!node.liveColor) node.liveColor = paint.clone();
        else node.liveColor.copy(paint);
        node.color = node.paintColor || DEFAULT_NODE_COLOR;
        if (node.highlightMode !== "selected" && node.highlightMode !== "hover") {
          asBasicMaterial(node.mesh.material).color.copy(node.liveColor);
        }
      }
      return;
    }

    const maxHops = Math.max(0, Math.round(s.inkHops));
    const softness = Math.max(0.15, s.inkSoftness);
    const intensity = Math.max(0.5, s.inkIntensity ?? 1.45);
    const adj = this.#adjacency();

    const accum = new Map<string, InkAccum>();
    for (const node of nodes) {
      accum.set(node.id, { r: 0, g: 0, b: 0, w: 0 });
    }

    // Only custom paints spread — base/default color does not bleed
    for (const source of nodes) {
      if (!this.#isInkSource(source)) continue;
      const ink = this.#intensifyColor(new THREE.Color(source.paintColor || DEFAULT_NODE_COLOR), intensity);
      const hops = this.#bfsHops(source.id, adj, maxHops);
      for (const [id, dist] of hops) {
        if (!accum.has(id)) continue;
        const t = maxHops === 0 ? 1 : 1 - dist / (maxHops + 0.35);
        const w = Math.pow(Math.max(0, t), softness);
        if (w <= 0) continue;
        const a = accum.get(id)!;
        a.r += ink.r * w;
        a.g += ink.g * w;
        a.b += ink.b * w;
        a.w += w;
      }
    }

    for (const node of nodes) {
      if (!node.liveColor) node.liveColor = new THREE.Color();
      const a = accum.get(node.id);
      if (a && a.w > 1e-6) {
        node.liveColor.setRGB(a.r / a.w, a.g / a.w, a.b / a.w);
        this.#intensifyColor(node.liveColor, 1.12);
      } else if (this.#isInkSource(node)) {
        node.liveColor.copy(this.#intensifyColor(new THREE.Color(node.paintColor), intensity));
      } else {
        // Untinted base points stay default until reached by real ink
        node.liveColor.set(DEFAULT_NODE_COLOR);
      }
      node.color = `#${node.liveColor.getHexString()}`;
      if (node.highlightMode !== "selected" && node.highlightMode !== "hover") {
        asBasicMaterial(node.mesh.material).color.copy(node.liveColor);
      }
    }
  }

  #isInkSource(node: EngineNode | undefined): boolean {
    if (!node || node.fixed) return false;
    const paint = (node.paintColor || DEFAULT_NODE_COLOR).toLowerCase();
    return paint !== DEFAULT_NODE_COLOR.toLowerCase();
  }

  /** Push saturation + brightness so ink reads stronger on the dark sky. */
  #intensifyColor(color: THREE.Color, amount = 1.4): THREE.Color {
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);
    hsl.s = Math.min(1, hsl.s * (0.65 + amount * 0.55));
    hsl.l = Math.min(0.72, Math.max(0.28, hsl.l * (0.75 + amount * 0.35)));
    color.setHSL(hsl.h, hsl.s, hsl.l);
    return color;
  }

  #adjacency(): Map<string, string[]> {
    const adj = new Map<string, string[]>();
    for (const node of this.nodes.values()) {
      if (!node.fixed) adj.set(node.id, []);
    }
    for (const edge of this.edges.values()) {
      const a = this.nodes.get(edge.from);
      const b = this.nodes.get(edge.to);
      if (!a || !b || a.fixed || b.fixed) continue;
      adj.get(a.id)?.push(b.id);
      adj.get(b.id)?.push(a.id);
    }
    return adj;
  }

  /** BFS hop distances from start, capped at maxHops (inclusive). */
  #bfsHops(startId: string, adj: Map<string, string[]>, maxHops: number): Map<string, number> {
    const dist = new Map<string, number>([[startId, 0]]);
    if (maxHops === 0) return dist;
    const queue = [startId];
    while (queue.length) {
      const id = queue.shift()!;
      const d = dist.get(id)!;
      if (d >= maxHops) continue;
      for (const next of adj.get(id) || []) {
        if (dist.has(next)) continue;
        dist.set(next, d + 1);
        queue.push(next);
      }
    }
    return dist;
  }

  #syncEdges(): void {
    for (const edge of this.edges.values()) {
      const a = this.nodes.get(edge.from)?.mesh.position;
      const b = this.nodes.get(edge.to)?.mesh.position;
      if (!a || !b) continue;
      const pos = edge.line.geometry.attributes.position as THREE.BufferAttribute;

      let x0: number;
      let y0: number;
      let z0: number;
      let x1: number;
      let y1: number;
      let z1: number;
      if (edge.toCore) {
        const corePos = edge.coreFirst ? a : b;
        const outerPos = edge.coreFirst ? b : a;
        x0 = corePos.x;
        y0 = corePos.y;
        z0 = corePos.z;
        x1 = outerPos.x;
        y1 = outerPos.y;
        z1 = outerPos.z;
      } else {
        x0 = a.x;
        y0 = a.y;
        z0 = a.z;
        x1 = b.x;
        y1 = b.y;
        z1 = b.z;
      }

      pos.setXYZ(0, x0, y0, z0);
      pos.setXYZ(1, x1, y1, z1);
      pos.needsUpdate = true;
      edge.line.geometry.computeBoundingSphere();

      const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
      const uniforms = asLerpMaterial(edge.line.material).uniforms;
      if (uniforms?.uLength) {
        uniforms.uLength.value = Math.max(0.2, len);
      }
    }
  }
}
