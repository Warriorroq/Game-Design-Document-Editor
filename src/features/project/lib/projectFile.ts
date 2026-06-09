import { normalizeDocument } from "@/features/project/lib/document";
import type { GddDocument } from "@/shared/types";

/** @deprecated Legacy single-file JSON format. Use gdeArchive for export. */
export const GDE_FORMAT = "gdd-editor-project" as const;
export const GDE_VERSION = 1;

export interface GdeProjectFile {
  format: typeof GDE_FORMAT;
  version: number;
  exportedAt: string;
  document: GddDocument;
}

/** Legacy JSON serialization kept for importing old .gde files. */
export function serializeGdeProject(doc: GddDocument): string {
  const payload: GdeProjectFile = {
    format: GDE_FORMAT,
    version: GDE_VERSION,
    exportedAt: new Date().toISOString(),
    document: { ...doc, lastModified: new Date().toISOString() },
  };
  return JSON.stringify(payload, null, 2);
}

export function parseGdeProject(raw: string): GddDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("This file is not valid JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid .gde project file.");
  }

  const record = parsed as Record<string, unknown>;
  let document: unknown;

  if (record.format === GDE_FORMAT && record.document) {
    document = record.document;
  } else if (Array.isArray(record.sections)) {
    document = parsed;
  } else {
    throw new Error("Invalid .gde project file.");
  }

  const doc = document as GddDocument;
  if (typeof doc.id !== "string" || !Array.isArray(doc.sections)) {
    throw new Error("Invalid .gde project file.");
  }

  return normalizeDocument(doc);
}
