import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

export type Space3DModelFormat = "gltf" | "fbx" | "obj";

const gltfLoader = new GLTFLoader();
const fbxLoader = new FBXLoader();
const objLoader = new OBJLoader();
const templateCache = new Map<string, Promise<THREE.Group>>();

export function modelFormatFromSrc(src: string): Space3DModelFormat | null {
  const dataMatch = /^data:([^;]+);/i.exec(src);
  if (dataMatch) {
    const mime = dataMatch[1].toLowerCase();
    if (mime.includes("gltf")) return "gltf";
    if (mime.includes("fbx")) return "fbx";
    if (mime.includes("obj")) return "obj";
  }
  const lower = src.toLowerCase();
  if (lower.endsWith(".fbx")) return "fbx";
  if (lower.endsWith(".obj")) return "obj";
  if (lower.endsWith(".gltf") || lower.endsWith(".glb")) return "gltf";
  return null;
}

export function isSupportedModelFileName(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.endsWith(".glb") ||
    lower.endsWith(".gltf") ||
    lower.endsWith(".fbx") ||
    lower.endsWith(".obj")
  );
}

export function modelMimeForFileName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".glb")) return "model/gltf-binary";
  if (lower.endsWith(".gltf")) return "model/gltf+json";
  if (lower.endsWith(".fbx")) return "model/fbx";
  if (lower.endsWith(".obj")) return "model/obj";
  return "application/octet-stream";
}

function normalizeTemplate(group: THREE.Group): THREE.Group {
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const scale = 1 / maxDim;
  group.scale.multiplyScalar(scale);
  box.setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  group.position.sub(center);
  group.position.y += size.y * scale * 0.5;
  return group;
}

function prepareLoadedRoot(root: THREE.Object3D): THREE.Group {
  const group = root instanceof THREE.Group ? root : new THREE.Group().add(root);
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return normalizeTemplate(group);
}

function loadGltf(src: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    gltfLoader.load(
      src,
      (gltf) => resolve(prepareLoadedRoot(gltf.scene)),
      undefined,
      reject
    );
  });
}

function loadFbx(src: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    fbxLoader.load(
      src,
      (object) => resolve(prepareLoadedRoot(object)),
      undefined,
      reject
    );
  });
}

function loadObj(src: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    objLoader.load(
      src,
      (object) => resolve(prepareLoadedRoot(object)),
      undefined,
      reject
    );
  });
}

export function loadSpace3DModelTemplate(src: string): Promise<THREE.Group> {
  const cached = templateCache.get(src);
  if (cached) return cached;

  const format = modelFormatFromSrc(src);
  const promise = (() => {
    switch (format) {
      case "fbx":
        return loadFbx(src);
      case "obj":
        return loadObj(src);
      case "gltf":
        return loadGltf(src);
      default:
        return Promise.reject(new Error("Unsupported model format"));
    }
  })();

  templateCache.set(src, promise);
  promise.catch(() => templateCache.delete(src));
  return promise;
}

export function cloneModelInstance(template: THREE.Group): THREE.Group {
  return template.clone(true);
}

export function invalidateModelCache(src: string): void {
  templateCache.delete(src);
}

export async function readModelFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const mime = modelMimeForFileName(file.name);
  return `data:${mime};base64,${btoa(binary)}`;
}
