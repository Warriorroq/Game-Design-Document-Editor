import * as THREE from "three";
import type { Space3DGrid, Space3DObject } from "@/domain/types";
import { clampTransformPatch } from "@/features/space3d/lib/space3dObject";

const GRID_PLANE_SIZE = 600;

const infiniteGridVertexShader = `
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const infiniteGridFragmentShader = `
  varying vec3 vWorldPosition;

  uniform float uStep;
  uniform vec3 uCenterColor;
  uniform vec3 uLineColor;
  uniform vec3 uCameraPosition;
  uniform float uFadeNear;
  uniform float uFadeFar;

  float gridLines(vec2 coord, float step) {
    vec2 c = coord / step;
    vec2 grid = abs(fract(c - 0.5) - 0.5) / fwidth(c);
    return 1.0 - min(min(grid.x, grid.y), 1.0);
  }

  float axisLines(vec2 coord) {
    vec2 a = abs(coord) / fwidth(coord);
    return 1.0 - min(min(a.x, a.y), 1.0);
  }

  void main() {
    vec2 p = vWorldPosition.xz;
    float dist = length(p - uCameraPosition.xz);
    float fade = (1.0 - smoothstep(uFadeNear, uFadeFar, dist)) * smoothstep(0.0, 2.0, dist);

    float minor = gridLines(p, uStep);
    float axis = axisLines(p);

    vec3 color = mix(uLineColor, uCenterColor, axis);
    float alpha = max(minor, axis) * fade;

    if (alpha < 0.005) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;

function hexToColor(hex: string, fallback: number): THREE.Color {
  const color = new THREE.Color();
  if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(hex.trim())) {
    color.setStyle(hex);
  } else {
    color.setHex(fallback);
  }
  return color;
}

function applyGridMaterialUniforms(material: THREE.ShaderMaterial, grid: Space3DGrid) {
  const step = grid.step ?? 1;
  material.uniforms.uStep.value = step;
  material.uniforms.uCenterColor.value.copy(
    hexToColor(grid.centerColor ?? "#3f3f46", 0x3f3f46)
  );
  material.uniforms.uLineColor.value.copy(hexToColor(grid.lineColor ?? "#27272a", 0x27272a));
}

export function snapToGrid(value: number, step: number): number {
  if (!(step > 0)) return value;
  const snapped = Math.round(value / step) * step;
  const precision = step < 1 ? Math.min(6, Math.ceil(-Math.log10(step)) + 2) : 4;
  return Number(snapped.toFixed(precision));
}

export function snapTransformPatch(
  patch: Partial<Space3DObject>,
  grid: Space3DGrid | undefined
): Partial<Space3DObject> {
  const step = grid?.step ?? 1;
  if (grid?.enabled !== true || !(step > 0)) return clampTransformPatch(patch);
  const next = { ...patch };
  for (const key of ["x", "y", "z", "scaleX", "scaleY", "scaleZ"] as const) {
    if (next[key] !== undefined) {
      next[key] = snapToGrid(next[key]!, step);
    }
  }
  return clampTransformPatch(next);
}

export function createInfiniteGrid(grid: Space3DGrid): THREE.Mesh {
  const step = grid.step ?? 1;
  const material = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uStep: { value: step },
      uCenterColor: { value: hexToColor(grid.centerColor ?? "#3f3f46", 0x3f3f46) },
      uLineColor: { value: hexToColor(grid.lineColor ?? "#27272a", 0x27272a) },
      uCameraPosition: { value: new THREE.Vector3() },
      uFadeNear: { value: 8 },
      uFadeFar: { value: 140 },
    },
    vertexShader: infiniteGridVertexShader,
    fragmentShader: infiniteGridFragmentShader,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(GRID_PLANE_SIZE, GRID_PLANE_SIZE), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  mesh.visible = grid.enabled === true && step > 0;
  return mesh;
}

export function updateInfiniteGrid(
  mesh: THREE.Mesh,
  camera: THREE.Camera,
  target: THREE.Vector3,
  grid: Space3DGrid
) {
  const step = grid.step ?? 1;
  if (!(step > 0)) return;

  const material = mesh.material as THREE.ShaderMaterial;
  applyGridMaterialUniforms(material, grid);
  material.uniforms.uCameraPosition.value.copy(camera.position);

  mesh.position.set(
    snapToGrid(target.x, step),
    0,
    snapToGrid(target.z, step)
  );
}

export function disposeInfiniteGrid(mesh: THREE.Mesh) {
  mesh.geometry.dispose();
  (mesh.material as THREE.Material).dispose();
}
