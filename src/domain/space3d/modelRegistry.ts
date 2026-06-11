import type { GddDocument, Space3DModelAsset, Space3DObject } from "@/domain/types";

const ASSETS_DIR = "assets";

function parseDataUrl(src: string): { mime: string; dataBase64: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(src);
  if (!match) return null;
  return { mime: match[1], dataBase64: match[2] };
}

export function space3DModelContentKey(src: string): string {
  const parsed = parseDataUrl(src);
  if (parsed) return `${parsed.mime}:${parsed.dataBase64}`;
  if (src.startsWith(`${ASSETS_DIR}/`)) return src;
  return src;
}

export function resolveSpace3DModelSrc(
  doc: GddDocument,
  assetId: string | undefined
): string | null {
  if (!assetId) return null;
  return doc.space3DModels?.[assetId]?.src ?? null;
}

export function displaySpace3DModelName(asset: Space3DModelAsset): string {
  const name = asset.name?.trim();
  return name && name !== asset.id ? name : asset.id;
}

export function registerSpace3DModel(
  doc: GddDocument,
  src: string,
  name?: string
): { doc: GddDocument; assetId: string } {
  const key = space3DModelContentKey(src);
  const models = { ...(doc.space3DModels ?? {}) };

  for (const [id, asset] of Object.entries(models)) {
    if (space3DModelContentKey(asset.src) === key) {
      return { doc, assetId: id };
    }
  }

  const assetId = src.startsWith(`${ASSETS_DIR}/`)
    ? src.slice(`${ASSETS_DIR}/`.length).replace(/\.[^.]+$/, "")
    : crypto.randomUUID();

  const trimmed = name?.trim();
  models[assetId] = {
    id: assetId,
    src,
    name: trimmed && trimmed !== assetId ? trimmed : undefined,
  };

  return { doc: { ...doc, space3DModels: models }, assetId };
}

export function updateSpace3DModelAssetName(
  doc: GddDocument,
  assetId: string,
  name: string
): GddDocument {
  const trimmed = name.trim();
  if (trimmed.length > 200) {
    throw new Error("INVALID_ASSET_NAME");
  }

  const models = doc.space3DModels;
  if (!models?.[assetId]) return doc;

  const asset = models[assetId];
  const nextName = trimmed && trimmed !== asset.id ? trimmed : undefined;

  return {
    ...doc,
    space3DModels: {
      ...models,
      [assetId]: { ...asset, name: nextName },
    },
  };
}

export function deleteSpace3DModelAsset(
  doc: GddDocument,
  assetId: string
): GddDocument {
  const models = doc.space3DModels;
  if (!models?.[assetId]) return doc;

  const next = { ...models };
  delete next[assetId];
  return {
    ...doc,
    space3DModels: Object.keys(next).length > 0 ? next : undefined,
  };
}

export function listSpace3DModelReferences(
  doc: GddDocument,
  assetId: string
): { sectionId: string; sectionTitle: string; objectId: string }[] {
  const refs: { sectionId: string; sectionTitle: string; objectId: string }[] = [];
  for (const section of doc.sections) {
    if (section.kind !== "space3d") continue;
    for (const obj of section.space3d?.objects ?? []) {
      if (obj.type === "model" && obj.assetId === assetId) {
        refs.push({
          sectionId: section.id,
          sectionTitle: section.title.trim() || section.id,
          objectId: obj.id,
        });
      }
    }
  }
  return refs;
}

export function countSpace3DModelUsage(doc: GddDocument, assetId: string): number {
  return listSpace3DModelReferences(doc, assetId).length;
}

export function prepareSpace3DObjectForDoc(
  doc: GddDocument,
  obj: Space3DObject
): { doc: GddDocument; object: Space3DObject } {
  if (obj.type !== "model") {
    return { doc, object: obj };
  }

  if (obj.assetId && doc.space3DModels?.[obj.assetId]) {
    return { doc, object: obj };
  }

  throw new Error(`Space3D model object ${obj.id} has no registered asset`);
}

export function collectSpace3DModelRegistryAssets(
  doc: GddDocument
): Space3DModelAsset[] {
  return Object.values(doc.space3DModels ?? {});
}
