import * as THREE from "three";
import type { Space3DObject } from "@/domain/types";

export const MIN_SCALE = 0.001;

export function clampTransformPatch(
  patch: Partial<Space3DObject>
): Partial<Space3DObject> {
  const next = { ...patch };
  for (const key of ["scaleX", "scaleY", "scaleZ"] as const) {
    if (next[key] !== undefined) {
      next[key] = Math.max(MIN_SCALE, Math.abs(next[key]!));
    }
  }
  return next;
}

export function patchFromObject3D(obj: THREE.Object3D): Pick<
  Space3DObject,
  "x" | "y" | "z" | "scaleX" | "scaleY" | "scaleZ" | "rotationX" | "rotationY" | "rotationZ"
> {
  return clampTransformPatch({
    x: obj.position.x,
    y: obj.position.y,
    z: obj.position.z,
    scaleX: obj.scale.x,
    scaleY: obj.scale.y,
    scaleZ: obj.scale.z,
    rotationX: THREE.MathUtils.radToDeg(obj.rotation.x),
    rotationY: THREE.MathUtils.radToDeg(obj.rotation.y),
    rotationZ: THREE.MathUtils.radToDeg(obj.rotation.z),
  }) as Pick<
    Space3DObject,
    "x" | "y" | "z" | "scaleX" | "scaleY" | "scaleZ" | "rotationX" | "rotationY" | "rotationZ"
  >;
}

export function applyObjectTransform(obj3d: THREE.Object3D, obj: Space3DObject): void {
  obj3d.position.set(obj.x, obj.y, obj.z);
  const sx = Math.max(MIN_SCALE, Math.abs(obj.scaleX ?? 1));
  const sy = Math.max(MIN_SCALE, Math.abs(obj.scaleY ?? 1));
  const sz = Math.max(MIN_SCALE, Math.abs(obj.scaleZ ?? 1));
  obj3d.scale.set(sx, sy, sz);
  obj3d.rotation.set(
    THREE.MathUtils.degToRad(obj.rotationX ?? 0),
    THREE.MathUtils.degToRad(obj.rotationY ?? 0),
    THREE.MathUtils.degToRad(obj.rotationZ ?? 0)
  );
}

export function primitiveMesh(obj: Space3DObject): THREE.Mesh {
  const sx = obj.scaleX ?? 1;
  const sy = obj.scaleY ?? 1;
  const sz = obj.scaleZ ?? 1;
  const geometry =
    obj.type === "sphere"
      ? new THREE.SphereGeometry(0.5, 24, 16)
      : new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({
    color: obj.color ?? "#6366f1",
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function findObjectRoot(object: THREE.Object3D): THREE.Object3D | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (current.userData.objectId) return current;
    current = current.parent;
  }
  return null;
}

export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const material = child.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material.dispose();
    }
  });
}
