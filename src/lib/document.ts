import { ensureHtmlContent } from "./editorContent";
import type { BoardItem, GddDocument, GddSection, GddSectionFolder } from "../types";

function parentKey(folderId: string | null | undefined): string {
  return folderId ?? "";
}

function renumberSectionsInParent(
  sections: GddDocument["sections"],
  folderId: string | null
): GddDocument["sections"] {
  const siblings = sections
    .filter((section) => parentKey(section.folderId) === parentKey(folderId))
    .sort((a, b) => a.order - b.order);
  const orderMap = new Map(siblings.map((section, index) => [section.id, index]));
  return sections.map((section) => {
    const order = orderMap.get(section.id);
    return order !== undefined ? { ...section, order } : section;
  });
}

function normalizeFolders(
  folders: GddSectionFolder[] | undefined
): GddSectionFolder[] {
  const normalized = (folders ?? []).map((folder) => ({
    ...folder,
    title: folder.title || "Folder",
  }));
  const folderIds = new Set(normalized.map((folder) => folder.id));
  return normalized.map((folder) => {
    if (
      folder.parentFolderId &&
      (!folderIds.has(folder.parentFolderId) ||
        folder.parentFolderId === folder.id)
    ) {
      return { ...folder, parentFolderId: undefined };
    }
    return folder;
  });
}

export function normalizeDocument(doc: GddDocument & { board?: BoardItem[] }): GddDocument {
  const legacyBoard = Array.isArray(doc.board) ? doc.board : [];
  let migrated = false;

  const sections = doc.sections.map((s) => {
    const board = Array.isArray(s.board) ? s.board : [];
    if (board.length > 0) migrated = true;
    const shapes = Array.isArray(s.shapes) ? s.shapes : [];
    const texts = Array.isArray(s.texts) ? s.texts : [];
    const strokes = Array.isArray(s.strokes) ? s.strokes : [];
    const groups = (Array.isArray(s.groups) ? s.groups : []).map((g) => ({
      ...g,
      memberTextIds: Array.isArray(g.memberTextIds) ? g.memberTextIds : [],
      memberStrokeIds: Array.isArray(g.memberStrokeIds) ? g.memberStrokeIds : [],
    }));
    const folderId =
      s.folderId && Array.isArray(doc.folders) && doc.folders.some((f) => f.id === s.folderId)
        ? s.folderId
        : undefined;
    return {
      ...s,
      board,
      shapes,
      texts,
      strokes,
      groups,
      folderId,
      content: ensureHtmlContent(s.content),
    };
  });

  if (legacyBoard.length && !migrated && sections[0]) {
    sections[0] = { ...sections[0], board: legacyBoard };
  }

  const { board: _removed, ...rest } = doc;
  const folders = normalizeFolders(doc.folders);
  const folderIds = new Set(folders.map((folder) => folder.id));
  let normalizedSections: GddSection[] = sections.map((section) =>
    section.folderId && !folderIds.has(section.folderId)
      ? { ...section, folderId: undefined }
      : section
  );

  for (const folderId of folderIds) {
    normalizedSections = renumberSectionsInParent(normalizedSections, folderId);
  }
  normalizedSections = renumberSectionsInParent(normalizedSections, null);

  return { ...rest, folders, sections: normalizedSections };
}

const STORAGE_KEY = "gdd-editor-document";

export function createDocument(): GddDocument {
  return {
    id: crypto.randomUUID(),
    title: "Untitled Game",
    subtitle: "Game Design Document",
    lastModified: new Date().toISOString(),
    folders: [],
    sections: [],
  };
}

/** Imported archive opened as a fresh in-editor project (new id, detached from folder). */
export function importAsNewProject(doc: GddDocument): GddDocument {
  const normalized = normalizeDocument(doc);
  return {
    ...normalized,
    id: crypto.randomUUID(),
    lastModified: new Date().toISOString(),
  };
}

export function loadDocument(): GddDocument | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GddDocument;
    if (!Array.isArray(parsed.sections)) return null;
    return normalizeDocument(parsed);
  } catch {
    return null;
  }
}

export function saveDocument(doc: GddDocument): void {
  const updated = { ...doc, lastModified: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}
