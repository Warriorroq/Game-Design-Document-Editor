import { ensureHtmlContent } from "./editorContent";
import type { BoardItem, GddDocument } from "../types";

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
    return {
      ...s,
      board,
      shapes,
      texts,
      strokes,
      groups,
      content: ensureHtmlContent(s.content),
    };
  });

  if (legacyBoard.length && !migrated && sections[0]) {
    sections[0] = { ...sections[0], board: legacyBoard };
  }

  const { board: _removed, ...rest } = doc;
  return { ...rest, sections };
}

const STORAGE_KEY = "gdd-editor-document";

export function createDocument(): GddDocument {
  return {
    id: crypto.randomUUID(),
    title: "Untitled Game",
    subtitle: "Game Design Document",
    lastModified: new Date().toISOString(),
    sections: [],
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
