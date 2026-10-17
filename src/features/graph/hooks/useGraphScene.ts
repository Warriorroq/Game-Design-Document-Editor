import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { normalizeGraphData } from "@/domain/graph/graph";
import type { GraphData } from "@/domain/types";
import { GraphEngine } from "@/features/graph/lib/GraphEngine";

export type GraphContextMenuState =
  | { mode: "create"; x: number; y: number }
  | { mode: "node"; nodeId: string; x: number; y: number }
  | { mode: "edge"; edgeId: string; x: number; y: number };

export type GraphTooltipState = {
  nodeId: string;
  name: string;
  description: string;
  x: number;
  y: number;
} | null;

interface UseGraphSceneOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  graphData: GraphData;
  onGraphChange: (data: GraphData) => void;
  onContextMenu: (menu: GraphContextMenuState | null) => void;
  onTooltip: (tooltip: GraphTooltipState) => void;
  onSelectionChange?: (selectedId: string | null) => void;
  /** Disables create/link/edit; click activates a node instead of linking. */
  readOnly?: boolean;
  onNodeActivate?: (nodeId: string) => void;
}

export type GraphSceneApi = {
  getEngine: () => GraphEngine | null;
  persist: () => void;
  clearSelection: () => void;
  selectNode: (id: string) => void;
  setCursor: (cursor: string) => void;
};

function makeStarfield(count = 1800): THREE.Points {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 40 + Math.random() * 60;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    const c = 0.65 + Math.random() * 0.35;
    colors[i * 3] = c * 0.85;
    colors[i * 3 + 1] = c * 0.9;
    colors[i * 3 + 2] = c;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size: 0.08,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      sizeAttenuation: true
    })
  );
}

export function useGraphScene({
  containerRef,
  graphData,
  onGraphChange,
  onContextMenu,
  onTooltip,
  onSelectionChange,
  readOnly = false,
  onNodeActivate
}: UseGraphSceneOptions): GraphSceneApi {
  const engineRef = useRef<GraphEngine | null>(null);
  const selectionRef = useRef<{ a: string | null; b: string | null }>({ a: null, b: null });
  const hoveredIdRef = useRef<string | null>(null);
  const hoveredEdgeIdRef = useRef<string | null>(null);
  const onGraphChangeRef = useRef(onGraphChange);
  onGraphChangeRef.current = onGraphChange;
  const onContextMenuRef = useRef(onContextMenu);
  onContextMenuRef.current = onContextMenu;
  const onTooltipRef = useRef(onTooltip);
  onTooltipRef.current = onTooltip;
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;
  const onNodeActivateRef = useRef(onNodeActivate);
  onNodeActivateRef.current = onNodeActivate;
  const readOnlyRef = useRef(readOnly);
  readOnlyRef.current = readOnly;
  const initialDataRef = useRef(normalizeGraphData(graphData));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const persist = () => {
    if (readOnlyRef.current) return;
    const engine = engineRef.current;
    if (!engine) return;
    onGraphChangeRef.current(engine.toJSON());
  };

  const clearSelection = () => {
    const engine = engineRef.current;
    if (!engine) return;
    const { a, b } = selectionRef.current;
    if (a) engine.setNodeHighlight(a, "idle");
    if (b) engine.setNodeHighlight(b, "idle");
    selectionRef.current = { a: null, b: null };
    onSelectionChangeRef.current?.(null);
  };

  const selectNode = (id: string) => {
    const engine = engineRef.current;
    if (!engine || readOnlyRef.current) return;

    const selection = selectionRef.current;
    if (selection.a === id) return;

    if (!selection.a) {
      selection.a = id;
      engine.setNodeHighlight(id, "selected");
      onSelectionChangeRef.current?.(id);
      return;
    }

    selection.b = id;
    engine.setNodeHighlight(id, "selected");
    const existing = engine.areConnected(selection.a, selection.b);
    if (existing) engine.removeEdge(existing);
    else engine.connect(selection.a, selection.b, { style: engine.settings.edgeStyle });
    clearSelection();
    persist();
  };

  const activateNode = (id: string) => {
    if (!readOnlyRef.current) return;
    onNodeActivateRef.current?.(id);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x02040a, 0.018);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
    camera.position.set(0, 2, 14);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x02040a, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    canvasRef.current = renderer.domElement;
    renderer.domElement.className = "graph-canvas";
    renderer.domElement.style.cursor = "grab";

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 2;
    controls.maxDistance = 80;
    controls.enablePan = true;

    const stars = makeStarfield();
    scene.add(stars);

    const engine = new GraphEngine(scene);
    engine.createCenter();
    const data = initialDataRef.current;
    if (data.nodes.length > 0 || data.edges.length > 0) {
      engine.fromJSON(data);
    } else if (data.settings) {
      engine.setSettings(data.settings);
    }
    engineRef.current = engine;

    const raycaster = new THREE.Raycaster();
    raycaster.params.Line = { threshold: 0.18 };
    const pointer = new THREE.Vector2();
    let pointerDown: { x: number; y: number } | null = null;
    let raf = 0;
    let last = performance.now();
    let disposed = false;

    const setPointer = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const w = rect.width || 1;
      const h = rect.height || 1;
      pointer.x = ((e.clientX - rect.left) / w) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / h) * 2 + 1;
    };

    const hitNode = (e: PointerEvent) => {
      setPointer(e);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(engine.getNodeMeshes(), false);
      return hits.length ? (hits[0].object.userData.id as string) : null;
    };

    const hitEdge = (e: PointerEvent) => {
      setPointer(e);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(engine.getEdgeLines(), false);
      return hits.length ? (hits[0].object.userData.edgeId as string) : null;
    };

    const hideTooltip = () => {
      onTooltipRef.current(null);
      const hoveredId = hoveredIdRef.current;
      if (!hoveredId) return;
      const selection = selectionRef.current;
      if (hoveredId !== selection.a && hoveredId !== selection.b) {
        engine.setNodeHighlight(hoveredId, "idle");
      } else {
        engine.setNodeHighlight(hoveredId, "selected");
      }
      hoveredIdRef.current = null;
    };

    const clearEdgeHover = () => {
      if (hoveredEdgeIdRef.current) {
        engine.setEdgeHighlight(hoveredEdgeIdRef.current, false);
        hoveredEdgeIdRef.current = null;
      }
    };

    const resize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      if (readOnlyRef.current) return;
      const pe = e as unknown as PointerEvent;
      const nodeId = hitNode(pe);
      if (nodeId) {
        onContextMenuRef.current({ mode: "node", nodeId, x: e.clientX, y: e.clientY });
        return;
      }
      const edgeId = hitEdge(pe);
      if (edgeId) {
        onContextMenuRef.current({ mode: "edge", edgeId, x: e.clientX, y: e.clientY });
        return;
      }
      onContextMenuRef.current({ mode: "create", x: e.clientX, y: e.clientY });
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      pointerDown = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.button !== 0 || !pointerDown) return;
      const moved = Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y) > 5;
      pointerDown = null;
      if (moved) return;
      if (readOnlyRef.current) return;
      const id = hitNode(e);
      if (id) selectNode(id);
      else clearSelection();
    };

    const onDoubleClick = (e: MouseEvent) => {
      if (!readOnlyRef.current) return;
      e.preventDefault();
      const id = hitNode(e as unknown as PointerEvent);
      if (!id) return;
      const node = engine.getNode(id);
      if (!node || node.fixed) return;
      activateNode(id);
    };

    const onPointerMove = (e: PointerEvent) => {
      const id = hitNode(e);
      if (id) {
        clearEdgeHover();
        const node = engine.getNode(id);
        if (!node) return;
        const selection = selectionRef.current;
        if (hoveredIdRef.current && hoveredIdRef.current !== id) {
          if (hoveredIdRef.current !== selection.a && hoveredIdRef.current !== selection.b) {
            engine.setNodeHighlight(hoveredIdRef.current, "idle");
          } else {
            engine.setNodeHighlight(hoveredIdRef.current, "selected");
          }
        }
        hoveredIdRef.current = id;
        if (id !== selection.a && id !== selection.b) engine.setNodeHighlight(id, "hover");
        if (!node.fixed) {
          onTooltipRef.current({
            nodeId: id,
            name: node.name,
            description: node.description || "",
            x: e.clientX,
            y: e.clientY
          });
        } else {
          onTooltipRef.current(null);
        }
        renderer.domElement.style.cursor = "pointer";
        return;
      }

      hideTooltip();

      const edgeId = hitEdge(e);
      if (edgeId) {
        if (hoveredEdgeIdRef.current && hoveredEdgeIdRef.current !== edgeId) {
          engine.setEdgeHighlight(hoveredEdgeIdRef.current, false);
        }
        hoveredEdgeIdRef.current = edgeId;
        engine.setEdgeHighlight(edgeId, true);
        renderer.domElement.style.cursor = "pointer";
        return;
      }

      clearEdgeHover();
      renderer.domElement.style.cursor = "grab";
    };

    const onPointerLeave = () => {
      hideTooltip();
      clearEdgeHover();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onContextMenuRef.current(null);
        clearSelection();
      }
    };

    const animate = (now: number) => {
      if (disposed) return;
      raf = requestAnimationFrame(animate);
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      engine.tick(dt);
      controls.update();
      renderer.render(scene, camera);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    renderer.domElement.addEventListener("contextmenu", onContextMenu);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("dblclick", onDoubleClick);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("keydown", onKeyDown);
    raf = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      persist();
      renderer.domElement.removeEventListener("contextmenu", onContextMenu);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("dblclick", onDoubleClick);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("keydown", onKeyDown);
      controls.dispose();
      stars.geometry.dispose();
      (stars.material as THREE.Material).dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
      engineRef.current = null;
      canvasRef.current = null;
    };
    // Mount once per section; initial data is captured in initialDataRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef]);

  return {
    getEngine: () => engineRef.current,
    persist,
    clearSelection,
    selectNode,
    setCursor: (cursor: string) => {
      if (canvasRef.current) canvasRef.current.style.cursor = cursor;
    }
  };
}
