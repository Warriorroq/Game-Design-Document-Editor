import type { BoardImageAsset, BoardItem, GddDocument } from "@/shared/types";

const ASSETS_DIR = "assets";

function parseDataUrl(src: string): { mime: string; dataBase64: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(src);
  if (!match) return null;
  return { mime: match[1], dataBase64: match[2] };
}

export function assetIdFromAssetPath(path: string): string {
  const prefix = `${ASSETS_DIR}/`;
  const name = path.startsWith(prefix) ? path.slice(prefix.length) : path;
  return name.replace(/\.[^.]+$/, "");
}

/** Stable key for deduplicating identical image bytes. */
export function boardImageContentKey(src: string): string {
  const parsed = parseDataUrl(src);
  if (parsed) return `${parsed.mime}:${parsed.dataBase64}`;
  if (src.startsWith(`${ASSETS_DIR}/`)) return src;
  return src;
}

export function resolveBoardItemSrc(doc: GddDocument, item: BoardItem): string {
  const asset = item.assetId ? doc.boardImages?.[item.assetId] : undefined;
  if (asset) return asset.src;
  if (item.src) return item.src;
  throw new Error(`Missing board image asset for item ${item.id}`);
}

export function registerBoardImage(
  doc: GddDocument,
  src: string
): { doc: GddDocument; assetId: string } {
  const key = boardImageContentKey(src);
  const images = { ...(doc.boardImages ?? {}) };

  for (const [id, asset] of Object.entries(images)) {
    if (boardImageContentKey(asset.src) === key) {
      return { doc, assetId: id };
    }
  }

  const assetId = src.startsWith(`${ASSETS_DIR}/`)
    ? assetIdFromAssetPath(src)
    : crypto.randomUUID();

  images[assetId] = { id: assetId, src };
  return { doc: { ...doc, boardImages: images }, assetId };
}

export function prepareBoardItemForDoc(
  doc: GddDocument,
  item: BoardItem
): { doc: GddDocument; item: BoardItem } {
  if (item.assetId && doc.boardImages?.[item.assetId]) {
    const { src: _legacy, ...rest } = item;
    return { doc, item: rest };
  }

  const src = item.src;
  if (!src) {
    throw new Error(`Board item ${item.id} has no image source`);
  }

  const { doc: next, assetId } = registerBoardImage(doc, src);
  const { src: _legacy, ...rest } = item;
  return { doc: next, item: { ...rest, assetId } };
}

export function prepareBoardItemsForDoc(
  doc: GddDocument,
  items: BoardItem[]
): { doc: GddDocument; items: BoardItem[] } {
  let next = doc;
  const prepared: BoardItem[] = [];
  for (const item of items) {
    const result = prepareBoardItemForDoc(next, item);
    next = result.doc;
    prepared.push(result.item);
  }
  return { doc: next, items: prepared };
}

export function migrateBoardImages(doc: GddDocument): GddDocument {
  const images: Record<string, BoardImageAsset> = { ...(doc.boardImages ?? {}) };
  const contentToAssetId = new Map<string, string>();

  for (const asset of Object.values(images)) {
    contentToAssetId.set(boardImageContentKey(asset.src), asset.id);
  }

  let changed = !doc.boardImages;
  const sections = doc.sections.map((section) => ({
    ...section,
    board: section.board.map((item) => {
      if (item.assetId && images[item.assetId]) {
        if (item.src) {
          changed = true;
          const { src: _legacy, ...rest } = item;
          return rest;
        }
        return item;
      }

      const src = item.src;
      if (!src) return item;

      const key = boardImageContentKey(src);
      let assetId = contentToAssetId.get(key);
      if (!assetId) {
        assetId = src.startsWith(`${ASSETS_DIR}/`)
          ? assetIdFromAssetPath(src)
          : crypto.randomUUID();
        images[assetId] = { id: assetId, src };
        contentToAssetId.set(key, assetId);
      }

      changed = true;
      const { src: _legacy, ...rest } = item;
      return { ...rest, assetId };
    }),
  }));

  if (!changed) return doc;
  return { ...doc, boardImages: images, sections };
}

export interface BoardImageAssetReference {
  sectionId: string;
  sectionTitle: string;
  itemId: string;
}

/** One entry per desk (section); `itemId` is the first matching board item. */
export interface BoardImageAssetDeskReference {
  sectionId: string;
  sectionTitle: string;
  itemId: string;
}

export function displayBoardImageAssetName(asset: BoardImageAsset): string {
  const name = asset.name?.trim();
  return name || asset.id;
}

export function normalizeAssetName(input: string): string | null {
  const name = input.trim();
  if (!name || name.length > 200) return null;
  return name;
}

export function listBoardImageAssetReferences(
  doc: GddDocument,
  assetId: string
): BoardImageAssetReference[] {
  const refs: BoardImageAssetReference[] = [];
  for (const section of doc.sections) {
    for (const item of section.board) {
      if (item.assetId === assetId) {
        refs.push({
          sectionId: section.id,
          sectionTitle: section.title.trim() || section.id,
          itemId: item.id,
        });
      }
    }
  }
  return refs;
}

export function listBoardImageAssetDesks(
  doc: GddDocument,
  assetId: string
): BoardImageAssetDeskReference[] {
  const bySection = new Map<string, BoardImageAssetDeskReference>();
  for (const section of doc.sections) {
    for (const item of section.board) {
      if (item.assetId !== assetId) continue;
      if (!bySection.has(section.id)) {
        bySection.set(section.id, {
          sectionId: section.id,
          sectionTitle: section.title.trim() || section.id,
          itemId: item.id,
        });
      }
    }
  }
  return Array.from(bySection.values());
}

export function countBoardImageAssetUsage(doc: GddDocument, assetId: string): number {
  return listBoardImageAssetReferences(doc, assetId).length;
}

export function updateBoardImageAssetName(
  doc: GddDocument,
  assetId: string,
  name: string
): GddDocument {
  const trimmed = name.trim();
  if (trimmed.length > 200) {
    throw new Error("INVALID_ASSET_NAME");
  }

  const images = doc.boardImages;
  if (!images?.[assetId]) return doc;

  const asset = images[assetId];
  const nextName = trimmed && trimmed !== asset.id ? trimmed : undefined;

  return {
    ...doc,
    boardImages: {
      ...images,
      [assetId]: {
        ...asset,
        name: nextName,
      },
    },
  };
}

export function deleteBoardImageAsset(doc: GddDocument, assetId: string): GddDocument {
  const images = doc.boardImages;
  if (!images?.[assetId]) return doc;

  const nextImages = { ...images };
  delete nextImages[assetId];
  return {
    ...doc,
    boardImages: Object.keys(nextImages).length > 0 ? nextImages : undefined,
  };
}

export function pruneUnusedBoardImages(doc: GddDocument): GddDocument {
  const images = doc.boardImages;
  if (!images || Object.keys(images).length === 0) return doc;

  const used = new Set<string>();
  for (const section of doc.sections) {
    for (const item of section.board) {
      if (item.assetId) used.add(item.assetId);
    }
  }

  let changed = false;
  const nextImages: Record<string, BoardImageAsset> = {};
  for (const [id, asset] of Object.entries(images)) {
    if (used.has(id)) {
      nextImages[id] = asset;
    } else {
      changed = true;
    }
  }

  if (!changed) return doc;
  return { ...doc, boardImages: nextImages };
}

export function collectBoardImageAsset(
  registry: Record<string, BoardImageAsset>,
  assetId: string,
  src: string
): void {
  if (!registry[assetId]) {
    registry[assetId] = { id: assetId, src };
  }
}
