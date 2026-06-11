import { normalizeDocument } from "@/domain/document/document";
import type { GddDocument } from "@/domain/types";

const STORAGE_KEY = "gdd-editor-document";

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
