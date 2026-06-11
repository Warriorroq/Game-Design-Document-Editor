import { isBoardVideoItem } from "@/domain/board/boardItem";
import {
  assetIdFromAssetPath,
  collectBoardImageAsset,
  migrateBoardImages,
  resolveBoardItemSrc,
} from "@/domain/board/boardImageRegistry";
import { normalizeDocument } from "@/domain/document/document";
import type {
  BoardImageAsset,
  BoardItem,
  GddDocument,
  GddSection,
  GddSectionFolder,
} from "@/domain/types";

export const FOLDER_FORMAT = "gdd-editor-folder" as const;
export const FOLDER_VERSION = 2;
export const MANIFEST_FILE = "gdd.json";
export const SECTIONS_DIR = "sections";
export const ASSETS_DIR = "assets";

export interface FolderAsset {
  path: string;
  mime: string;
  dataBase64: string;
}

export interface FolderSectionEntry {
  id: string;
  path: string;
  content: string;
}

export interface FolderProjectPayload {
  manifest: string;
  sections: FolderSectionEntry[];
  assets: FolderAsset[];
}

interface ManifestSectionRef {
  id: string;
  file: string;
  order: number;
}

interface ManifestFolderRef {
  id: string;
  title: string;
  order: number;
  parentFolderId?: string;
  collapsed?: boolean;
}

interface ManifestBoardImageMeta {
  id: string;
  name?: string;
}

interface ManifestFile {
  format: typeof FOLDER_FORMAT;
  version: number;
  id: string;
  title: string;
  subtitle: string;
  lastModified: string;
  folders?: ManifestFolderRef[];
  sections: ManifestSectionRef[];
  boardImages?: ManifestBoardImageMeta[];
}

interface SectionFileBoardItem {
  id: string;
  asset?: string;
  kind?: "video";
  videoUrl?: string;
  embedUrl?: string;
  videoRender?: "iframe" | "video";
  x: number;
  y: number;
  width: number;
  height: number;
  locked?: boolean;
  rotation?: number;
  flipH?: boolean;
  flipV?: boolean;
}

interface SectionFile {
  id: string;
  title: string;
  description: string;
  content: string;
  order: number;
  folderId?: string;
  board: SectionFileBoardItem[];
  shapes: GddSection["shapes"];
  strokes: GddSection["strokes"];
  texts: GddSection["texts"];
  groups: GddSection["groups"];
}

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function extensionForMime(mime: string): string {
  return MIME_EXT[mime] ?? "bin";
}

function parseDataUrl(src: string): { mime: string; dataBase64: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(src);
  if (!match) return null;
  return { mime: match[1], dataBase64: match[2] };
}

function dataUrlFromBase64(mime: string, dataBase64: string): string {
  return `data:${mime};base64,${dataBase64}`;
}

function sectionFilePath(sectionId: string): string {
  return `${SECTIONS_DIR}/${sectionId}.json`;
}

function assetFilePath(assetId: string, mime: string): string {
  return `${ASSETS_DIR}/${assetId}.${extensionForMime(mime)}`;
}

function registryAssetToFolder(
  asset: BoardImageAsset,
  assets: Map<string, FolderAsset>
): void {
  const parsed = parseDataUrl(asset.src);
  if (!parsed) return;

  const path = assetFilePath(asset.id, parsed.mime);
  if (assets.has(path)) return;

  assets.set(path, {
    path,
    mime: parsed.mime,
    dataBase64: parsed.dataBase64,
  });
}

function collectBoardImageRegistryAssets(
  doc: GddDocument,
  assets: Map<string, FolderAsset>
): void {
  for (const asset of Object.values(doc.boardImages ?? {})) {
    registryAssetToFolder(asset, assets);
  }
}

function boardItemToFile(
  doc: GddDocument,
  item: BoardItem,
  assets: Map<string, FolderAsset>
): SectionFileBoardItem {
  if (isBoardVideoItem(item)) {
    const embedUrl = item.src;
    if (!embedUrl) {
      throw new Error(`Board video ${item.id} has no embed URL`);
    }
    return {
      id: item.id,
      kind: "video",
      videoUrl: item.videoUrl ?? embedUrl,
      embedUrl,
      videoRender: item.videoRender,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      locked: item.locked,
    };
  }

  const src = resolveBoardItemSrc(doc, item);
  const assetId =
    item.assetId ??
    Object.entries(doc.boardImages ?? {}).find(([, asset]) => asset.src === src)?.[0];
  if (!assetId) {
    throw new Error(`Board item ${item.id} has no asset id`);
  }

  const parsed = parseDataUrl(src);
  if (parsed) {
    const path = assetFilePath(assetId, parsed.mime);
    if (!assets.has(path)) {
      assets.set(path, {
        path,
        mime: parsed.mime,
        dataBase64: parsed.dataBase64,
      });
    }
    return {
      id: item.id,
      asset: path,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      locked: item.locked,
      rotation: item.rotation,
      flipH: item.flipH,
      flipV: item.flipV,
    };
  }

  if (src.startsWith(`${ASSETS_DIR}/`)) {
    return {
      id: item.id,
      asset: src,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      locked: item.locked,
      rotation: item.rotation,
      flipH: item.flipH,
      flipV: item.flipV,
    };
  }

  throw new Error(`Unsupported board image source for item ${item.id}.`);
}

function boardItemFromFile(
  item: SectionFileBoardItem,
  assetMap: Map<string, FolderAsset>,
  registry: Record<string, BoardImageAsset>
): BoardItem | null {
  if (item.kind === "video" && item.embedUrl) {
    return {
      id: item.id,
      kind: "video",
      videoUrl: item.videoUrl ?? item.embedUrl,
      src: item.embedUrl,
      videoRender: item.videoRender,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      locked: item.locked,
    };
  }

  if (!item.asset) return null;

  const asset = assetMap.get(item.asset);
  if (!asset) {
    return null;
  }
  const assetId = assetIdFromAssetPath(item.asset);
  const src = dataUrlFromBase64(asset.mime, asset.dataBase64);
  collectBoardImageAsset(registry, assetId, src);
  return {
    id: item.id,
    assetId,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    locked: item.locked,
    rotation: item.rotation,
    flipH: item.flipH,
    flipV: item.flipV,
  };
}

export function documentToFolderPayload(doc: GddDocument): FolderProjectPayload {
  const updated = migrateBoardImages({
    ...doc,
    lastModified: new Date().toISOString(),
  });
  const assets = new Map<string, FolderAsset>();
  const sections: FolderSectionEntry[] = [];

  const sorted = [...updated.sections].sort((a, b) => a.order - b.order);
  for (const section of sorted) {
    const sectionFile: SectionFile = {
      id: section.id,
      title: section.title,
      description: section.description,
      content: section.content,
      order: section.order,
      folderId: section.folderId,
      board: section.board.map((item) => boardItemToFile(updated, item, assets)),
      shapes: section.shapes,
      strokes: section.strokes,
      texts: section.texts,
      groups: section.groups,
    };
    const path = sectionFilePath(section.id);
    sections.push({
      id: section.id,
      path,
      content: JSON.stringify(sectionFile, null, 2),
    });
  }

  collectBoardImageRegistryAssets(updated, assets);

  const boardImageMeta: ManifestBoardImageMeta[] = [];
  for (const asset of Object.values(updated.boardImages ?? {})) {
    const name = asset.name?.trim();
    if (name) boardImageMeta.push({ id: asset.id, name });
  }

  const manifest: ManifestFile = {
    format: FOLDER_FORMAT,
    version: FOLDER_VERSION,
    id: updated.id,
    title: updated.title,
    subtitle: updated.subtitle,
    lastModified: updated.lastModified,
    folders: (updated.folders ?? []).map((folder) => ({
      id: folder.id,
      title: folder.title,
      order: folder.order,
      parentFolderId: folder.parentFolderId,
      collapsed: folder.collapsed,
    })),
    sections: sorted.map((section) => ({
      id: section.id,
      file: sectionFilePath(section.id),
      order: section.order,
    })),
    ...(boardImageMeta.length > 0 ? { boardImages: boardImageMeta } : {}),
  };

  return {
    manifest: JSON.stringify(manifest, null, 2),
    sections,
    assets: Array.from(assets.values()),
  };
}

export function folderPayloadToDocument(payload: FolderProjectPayload): GddDocument {
  let manifest: ManifestFile;
  try {
    manifest = JSON.parse(payload.manifest) as ManifestFile;
  } catch {
    throw new Error("Invalid project manifest (gdd.json).");
  }

  if (manifest.format !== FOLDER_FORMAT) {
    throw new Error("Unsupported folder project format.");
  }

  const assetMap = new Map(payload.assets.map((asset) => [asset.path, asset]));
  const boardImages: Record<string, BoardImageAsset> = {};
  const sectionById = new Map(
    payload.sections.map((entry) => [entry.id, entry.content])
  );

  const sections: GddSection[] = manifest.sections
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((ref) => {
      const raw = sectionById.get(ref.id);
      if (!raw) {
        throw new Error(`Missing section file for ${ref.id}.`);
      }
      let sectionFile: SectionFile;
      try {
        sectionFile = JSON.parse(raw) as SectionFile;
      } catch {
        throw new Error(`Invalid section file: ${ref.file}`);
      }

      return {
        id: sectionFile.id,
        title: sectionFile.title,
        description: sectionFile.description,
        content: sectionFile.content,
        order: sectionFile.order,
        folderId: sectionFile.folderId,
        board: sectionFile.board
          .map((item) => boardItemFromFile(item, assetMap, boardImages))
          .filter((item): item is BoardItem => item !== null),
        shapes: sectionFile.shapes ?? [],
        strokes: sectionFile.strokes ?? [],
        texts: sectionFile.texts ?? [],
        groups: sectionFile.groups ?? [],
      };
    });

  for (const folderAsset of assetMap.values()) {
    const assetId = assetIdFromAssetPath(folderAsset.path);
    const src = dataUrlFromBase64(folderAsset.mime, folderAsset.dataBase64);
    collectBoardImageAsset(boardImages, assetId, src);
  }

  for (const meta of manifest.boardImages ?? []) {
    const name = meta.name?.trim();
    if (!name || !boardImages[meta.id]) continue;
    boardImages[meta.id] = { ...boardImages[meta.id], name };
  }

  return normalizeDocument({
    id: manifest.id,
    title: manifest.title,
    subtitle: manifest.subtitle,
    lastModified: manifest.lastModified,
    boardImages,
    folders: (manifest.folders ?? []).map(
      (folder): GddSectionFolder => ({
        id: folder.id,
        title: folder.title,
        order: folder.order,
        parentFolderId: folder.parentFolderId,
        collapsed: folder.collapsed,
      })
    ),
    sections,
  });
}

export function documentToFolderFiles(
  doc: GddDocument
): Map<string, string | Uint8Array> {
  const payload = documentToFolderPayload(doc);
  const files = new Map<string, string | Uint8Array>();
  files.set(MANIFEST_FILE, payload.manifest);
  for (const section of payload.sections) {
    files.set(section.path, section.content);
  }
  for (const asset of payload.assets) {
    const binary = Uint8Array.from(atob(asset.dataBase64), (c) => c.charCodeAt(0));
    files.set(asset.path, binary);
  }
  return files;
}

export function folderFilesToDocument(
  files: Map<string, string | Uint8Array>
): GddDocument {
  const manifest = files.get(MANIFEST_FILE);
  if (typeof manifest !== "string") {
    throw new Error("Missing gdd.json in project folder.");
  }

  const payload: FolderProjectPayload = {
    manifest,
    sections: [],
    assets: [],
  };

  for (const [path, content] of files) {
    if (path === MANIFEST_FILE) continue;
    if (path.startsWith(`${SECTIONS_DIR}/`) && typeof content === "string") {
      const id = path.slice(`${SECTIONS_DIR}/`.length).replace(/\.json$/, "");
      payload.sections.push({ id, path, content });
      continue;
    }
    if (path.startsWith(`${ASSETS_DIR}/`) && content instanceof Uint8Array) {
      const ext = path.split(".").pop() ?? "bin";
      const mime =
        Object.entries(MIME_EXT).find(([, value]) => value === ext)?.[0] ??
        "application/octet-stream";
      let binary = "";
      for (const byte of content) {
        binary += String.fromCharCode(byte);
      }
      payload.assets.push({
        path,
        mime,
        dataBase64: btoa(binary),
      });
    }
  }

  return folderPayloadToDocument(payload);
}
