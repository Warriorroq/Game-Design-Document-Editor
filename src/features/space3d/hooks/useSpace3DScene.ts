import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { resolveSpace3DModelSrc } from "@/domain/space3d/modelRegistry";
import {
  defaultSpace3DData,
  normalizeSpace3DGrid,
  normalizeSpace3DObject,
  transformModeToControls,
} from "@/domain/space3d/space3d";
import type { GddDocument, Space3DData, Space3DEditMode, Space3DObject } from "@/domain/types";
import {
  createInfiniteGrid,
  disposeInfiniteGrid,
  snapTransformPatch,
  updateInfiniteGrid,
} from "@/features/space3d/lib/space3dGrid";
import { cloneModelInstance, loadSpace3DModelTemplate } from "@/features/space3d/lib/space3dLoader";
import { configureTransformControlsGizmo } from "@/features/space3d/lib/space3dTransformControls";
import {
  applyObjectTransform,
  disposeObject3D,
  findObjectRoot,
  patchFromObject3D,
  primitiveMesh,
} from "@/features/space3d/lib/space3dObject";

interface UseSpace3DSceneOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  doc: GddDocument;
  space3d: Space3DData;
  selectedId: string | null;
  editMode: Space3DEditMode;
  onSelect: (id: string | null) => void;
  onObjectChange: (objectId: string, patch: Partial<Space3DObject>) => void;
  onCameraChange: (camera: NonNullable<Space3DData["camera"]>) => void;
  onBeginTransientEdit?: () => void;
  onEndTransientEdit?: () => void;
}

type SceneContext = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  transformControls: TransformControls;
  objectGroup: THREE.Group;
  instances: Map<string, THREE.Object3D>;
  selectionHelper: THREE.BoxHelper;
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  gridHelper: THREE.Mesh;
};

export function useSpace3DScene({
  containerRef,
  doc,
  space3d,
  selectedId,
  editMode,
  onSelect,
  onObjectChange,
  onCameraChange,
  onBeginTransientEdit,
  onEndTransientEdit,
}: UseSpace3DSceneOptions) {
  const sceneRef = useRef<SceneContext | null>(null);
  const space3dRef = useRef(space3d);
  space3dRef.current = space3d;
  const docRef = useRef(doc);
  docRef.current = doc;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onObjectChangeRef = useRef(onObjectChange);
  onObjectChangeRef.current = onObjectChange;
  const onCameraChangeRef = useRef(onCameraChange);
  onCameraChangeRef.current = onCameraChange;
  const onBeginTransientRef = useRef(onBeginTransientEdit);
  onBeginTransientRef.current = onBeginTransientEdit;
  const onEndTransientRef = useRef(onEndTransientEdit);
  onEndTransientRef.current = onEndTransientEdit;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const syncingRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111318);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
    const cam = space3dRef.current.camera ?? defaultSpace3DData().camera!;
    camera.position.set(cam.position.x, cam.position.y, cam.position.z);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(cam.target.x, cam.target.y, cam.target.z);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };

    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.setMode(transformModeToControls(editMode));
    configureTransformControlsGizmo(transformControls);
    scene.add(transformControls.getHelper());

    transformControls.addEventListener("mouseDown", () => {
      controls.enabled = false;
      onBeginTransientRef.current?.();
    });
    transformControls.addEventListener("mouseUp", () => {
      controls.enabled = true;
      onEndTransientRef.current?.();
    });

    transformControls.addEventListener("objectChange", () => {
      const attached = transformControls.object;
      const objectId = attached?.userData.objectId as string | undefined;
      if (!attached || !objectId) return;
      const grid = normalizeSpace3DGrid(space3dRef.current.grid);
      let patch = patchFromObject3D(attached);
      if (grid.enabled === true && (grid.step ?? 0) > 0) {
        patch = snapTransformPatch(patch, grid) as typeof patch;
        applyObjectTransform(attached, {
          id: objectId,
          type: "box",
          x: patch.x,
          y: patch.y,
          z: patch.z,
          scaleX: patch.scaleX,
          scaleY: patch.scaleY,
          scaleZ: patch.scaleZ,
          rotationX: patch.rotationX,
          rotationY: patch.rotationY,
          rotationZ: patch.rotationZ,
        });
      }
      onObjectChangeRef.current(objectId, patch);
      const ctx = sceneRef.current;
      if (ctx) {
        ctx.selectionHelper.setFromObject(attached);
      }
    });

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 0.85);
    sun.position.set(6, 10, 4);
    sun.castShadow = true;
    scene.add(sun);

    const grid = normalizeSpace3DGrid(space3dRef.current.grid);
    const gridHelper = createInfiniteGrid(grid);
    scene.add(gridHelper);

    const objectGroup = new THREE.Group();
    scene.add(objectGroup);

    const selectionHelper = new THREE.BoxHelper(new THREE.Object3D(), 0x6366f1);
    selectionHelper.visible = false;
    scene.add(selectionHelper);

    const ctx: SceneContext = {
      scene,
      camera,
      renderer,
      controls,
      transformControls,
      objectGroup,
      instances: new Map(),
      selectionHelper,
      raycaster: new THREE.Raycaster(),
      pointer: new THREE.Vector2(),
      gridHelper,
    };
    sceneRef.current = ctx;

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w <= 0 || h <= 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    let frameId = 0;
    const tick = () => {
      frameId = requestAnimationFrame(tick);
      controls.update();
      if (gridHelper.visible) {
        updateInfiniteGrid(
          gridHelper,
          camera,
          controls.target,
          normalizeSpace3DGrid(space3dRef.current.grid)
        );
      }
      renderer.render(scene, camera);
    };
    tick();

    const saveCamera = () => {
      onCameraChangeRef.current({
        position: {
          x: camera.position.x,
          y: camera.position.y,
          z: camera.position.z,
        },
        target: {
          x: controls.target.x,
          y: controls.target.y,
          z: controls.target.z,
        },
      });
    };
    const onOrbitStart = () => {
      onBeginTransientRef.current?.();
    };
    const onOrbitEnd = () => {
      saveCamera();
      onEndTransientRef.current?.();
    };
    controls.addEventListener("start", onOrbitStart);
    controls.addEventListener("end", onOrbitEnd);

    let pointerDownX = 0;
    let pointerDownY = 0;

    const pickObject = (clientX: number, clientY: number): string | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      ctx.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ctx.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      ctx.raycaster.setFromCamera(ctx.pointer, camera);
      const hits = ctx.raycaster.intersectObjects(objectGroup.children, true);
      for (const hit of hits) {
        const root = findObjectRoot(hit.object);
        if (root?.userData.objectId) return root.userData.objectId as string;
      }
      return null;
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownX = e.clientX;
      pointerDownY = e.clientY;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (transformControls.dragging) return;
      const dx = e.clientX - pointerDownX;
      const dy = e.clientY - pointerDownY;
      if (dx * dx + dy * dy > 36) return;
      const id = pickObject(e.clientX, e.clientY);
      onSelectRef.current(id);
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    return () => {
      cancelAnimationFrame(frameId);
      controls.removeEventListener("start", onOrbitStart);
      controls.removeEventListener("end", onOrbitEnd);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      for (const root of ctx.instances.values()) {
        objectGroup.remove(root);
        disposeObject3D(root);
      }
      disposeInfiniteGrid(ctx.gridHelper);
      transformControls.dispose();
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, [containerRef]);

  const gridKey = JSON.stringify(normalizeSpace3DGrid(space3d.grid));

  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx) return;

    const grid = normalizeSpace3DGrid(space3dRef.current.grid);

    ctx.scene.remove(ctx.gridHelper);
    disposeInfiniteGrid(ctx.gridHelper);

    const nextGrid = createInfiniteGrid(grid);
    nextGrid.visible = grid.enabled === true && (grid.step ?? 1) > 0;
    ctx.scene.add(nextGrid);
    ctx.gridHelper = nextGrid;
  }, [gridKey]);

  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx || syncingRef.current) return;

    let cancelled = false;

    async function syncObjects() {
      syncingRef.current = true;
      const objects = space3dRef.current.objects.map((obj) => normalizeSpace3DObject(obj));
      const nextIds = new Set(objects.map((obj) => obj.id));

      for (const [id, root] of ctx!.instances) {
        if (!nextIds.has(id)) {
          ctx!.objectGroup.remove(root);
          disposeObject3D(root);
          ctx!.instances.delete(id);
        }
      }

      for (const obj of objects) {
        if (cancelled) return;
        const existing = ctx!.instances.get(obj.id);
        if (obj.type === "model") {
          const src = resolveSpace3DModelSrc(docRef.current, obj.assetId);
          if (!src) continue;

          if (existing && existing.userData.modelSrc === src) {
            applyObjectTransform(existing, obj);
            continue;
          }

          if (existing) {
            ctx!.objectGroup.remove(existing);
            disposeObject3D(existing);
            ctx!.instances.delete(obj.id);
          }

          try {
            const template = await loadSpace3DModelTemplate(src);
            if (cancelled) return;
            const root = cloneModelInstance(template);
            root.userData.objectId = obj.id;
            root.userData.modelSrc = src;
            applyObjectTransform(root, obj);
            ctx!.instances.set(obj.id, root);
            ctx!.objectGroup.add(root);
          } catch {
            // skip failed model
          }
          continue;
        }

        if (existing) {
          const mesh = existing as THREE.Mesh;
          const needsRebuild =
            mesh.userData.primitiveType !== obj.type ||
            mesh.userData.color !== obj.color;
          if (needsRebuild) {
            ctx!.objectGroup.remove(existing);
            disposeObject3D(existing);
            ctx!.instances.delete(obj.id);
          } else {
            applyObjectTransform(existing, obj);
            continue;
          }
        }

        const mesh = primitiveMesh(obj);
        mesh.userData.objectId = obj.id;
        mesh.userData.primitiveType = obj.type;
        mesh.userData.color = obj.color;
        applyObjectTransform(mesh, obj);
        ctx!.instances.set(obj.id, mesh);
        ctx!.objectGroup.add(mesh);
      }

      syncingRef.current = false;

      const selected = selectedIdRef.current;
      if (selected && ctx!.instances.has(selected)) {
        const root = ctx!.instances.get(selected)!;
        ctx!.transformControls.attach(root);
        ctx!.selectionHelper.setFromObject(root);
        ctx!.selectionHelper.visible = true;
      }
    }

    void syncObjects();
    return () => {
      cancelled = true;
      syncingRef.current = false;
    };
  }, [space3d.objects, doc.space3DModels]);

  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx) return;

    if (!selectedId || !ctx.instances.has(selectedId)) {
      ctx.transformControls.detach();
      ctx.selectionHelper.visible = false;
      return;
    }

    const root = ctx.instances.get(selectedId)!;
    ctx.transformControls.attach(root);
    ctx.selectionHelper.setFromObject(root);
    ctx.selectionHelper.visible = true;
  }, [selectedId, space3d.objects]);

  const setEditMode = (mode: Space3DEditMode) => {
    sceneRef.current?.transformControls.setMode(transformModeToControls(mode));
  };

  return { setEditMode };
}
