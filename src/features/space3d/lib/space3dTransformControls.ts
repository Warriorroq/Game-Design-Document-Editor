import * as THREE from "three";
import type { TransformControls } from "three/addons/controls/TransformControls.js";

type GizmoHost = THREE.Object3D & {
  gizmo: Record<string, THREE.Object3D>;
  picker: Record<string, THREE.Object3D>;
};

const AXIS_CENTER_KEY: Record<string, "x" | "y" | "z"> = {
  X: "x",
  Y: "y",
  Z: "z",
};

/** Remove translate/scale handles on the negative side of each axis. */
function removeNegativeAxisHandles(group: THREE.Object3D): void {
  const toRemove: THREE.Object3D[] = [];

  for (const child of group.children) {
    const axis = AXIS_CENTER_KEY[child.name];
    if (!axis) continue;

    const mesh = child as THREE.Mesh;
    if (!mesh.geometry) continue;

    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox;
    if (!box) continue;

    const center = new THREE.Vector3();
    box.getCenter(center);
    if (center[axis] < -0.05) {
      toRemove.push(child);
    }
  }

  for (const child of toRemove) {
    const mesh = child as THREE.Mesh;
    mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) {
      material.forEach((entry) => entry.dispose());
    } else if (material) {
      material.dispose();
    }
    group.remove(child);
  }
}

export function configureTransformControlsGizmo(transformControls: TransformControls): void {
  const gizmo = (transformControls as unknown as { _gizmo: GizmoHost })._gizmo;
  if (!gizmo?.gizmo || !gizmo?.picker) return;

  for (const mode of ["translate", "scale"] as const) {
    removeNegativeAxisHandles(gizmo.gizmo[mode]);
    removeNegativeAxisHandles(gizmo.picker[mode]);
  }
}
