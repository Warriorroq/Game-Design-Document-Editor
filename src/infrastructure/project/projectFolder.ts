import { isDesktopApp } from "@/infrastructure/desktop/desktop";
import { documentFromLegacyJson } from "@/infrastructure/project/gdeArchive";
import {
  documentToFolderPayload,
  folderPayloadToDocument,
  type FolderProjectPayload,
} from "@/infrastructure/project/projectLayout";
import type { GddDocument } from "@/domain/types";

const FOLDER_STORAGE_KEY = "gdd-editor-project-folder";

export interface PickFolderResult {
  folderPath: string;
  hasProject: boolean;
}

export function getStoredProjectFolder(): string | null {
  try {
    const value = localStorage.getItem(FOLDER_STORAGE_KEY);
    return value || null;
  } catch {
    return null;
  }
}

export function setStoredProjectFolder(folderPath: string | null): void {
  if (!folderPath) {
    localStorage.removeItem(FOLDER_STORAGE_KEY);
    return;
  }
  localStorage.setItem(FOLDER_STORAGE_KEY, folderPath);
}

export function folderLabel(folderPath: string): string {
  const parts = folderPath.replace(/[/\\]+$/, "").split(/[/\\]/);
  return parts[parts.length - 1] || folderPath;
}

export async function pickProjectFolder(): Promise<PickFolderResult | null> {
  if (!isDesktopApp || !window.gddDesktop?.project) return null;

  const result = await window.gddDesktop.project.pickFolder();
  if (!result.ok || result.canceled || !result.folderPath) return null;

  return {
    folderPath: result.folderPath,
    hasProject: Boolean(result.hasProject),
  };
}

async function readFolderPayload(
  folderPath: string
): Promise<FolderProjectPayload> {
  if (!window.gddDesktop?.project) {
    throw new Error("Desktop project API is unavailable.");
  }

  const result = await window.gddDesktop.project.readFolder(folderPath);
  if (!result.ok) {
    throw new Error(result.error ?? "Could not read project folder.");
  }

  if (result.legacy && result.content) {
    const doc = documentFromLegacyJson(result.content);
    return documentToFolderPayload(doc);
  }

  if (!result.payload) {
    throw new Error("Could not read project folder.");
  }

  return result.payload;
}

export async function loadProjectFromFolder(
  folderPath: string
): Promise<GddDocument> {
  const payload = await readFolderPayload(folderPath);
  return folderPayloadToDocument(payload);
}

export async function saveProjectToFolder(
  folderPath: string,
  doc: GddDocument
): Promise<void> {
  if (!window.gddDesktop?.project) return;

  const payload = documentToFolderPayload(doc);
  const result = await window.gddDesktop.project.writeFolder(folderPath, payload);
  if (!result.ok) {
    throw new Error(result.error ?? "Could not save project folder.");
  }
}
