import JSZip from "jszip";
import { normalizeDocument } from "@/domain/document/document";
import { parseGdeProject } from "@/infrastructure/project/projectFile";
import {
  documentToFolderFiles,
  folderFilesToDocument,
  MANIFEST_FILE,
} from "@/infrastructure/project/projectLayout";
import type { GddDocument } from "@/domain/types";

const ZIP_MAGIC = [0x50, 0x4b];

function isZipArchive(data: Uint8Array): boolean {
  return data.length >= 2 && data[0] === ZIP_MAGIC[0] && data[1] === ZIP_MAGIC[1];
}

function projectArchiveName(doc: GddDocument): string {
  const base =
    doc.title
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-") || "project";
  return `${base}.gde`;
}

async function readZipFiles(blob: Blob): Promise<Map<string, string | Uint8Array>> {
  const zip = await JSZip.loadAsync(blob);
  const files = new Map<string, string | Uint8Array>();

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "");
    if (normalized.endsWith(".json") || normalized === MANIFEST_FILE) {
      files.set(normalized, await entry.async("string"));
    } else {
      files.set(normalized, await entry.async("uint8array"));
    }
  }

  return files;
}

export async function buildGdeArchive(doc: GddDocument): Promise<Blob> {
  const zip = new JSZip();
  const files = documentToFolderFiles(doc);

  for (const [path, content] of files) {
    zip.file(path, content);
  }

  return zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export async function parseGdeArchive(input: Blob | ArrayBuffer): Promise<GddDocument> {
  const blob = input instanceof Blob ? input : new Blob([input]);
  const bytes = new Uint8Array(await blob.arrayBuffer());

  if (isZipArchive(bytes)) {
    const files = await readZipFiles(blob);
    return folderFilesToDocument(files);
  }

  const text = new TextDecoder().decode(bytes);
  return parseGdeProject(text);
}

export async function downloadGdeArchive(doc: GddDocument): Promise<void> {
  const blob = await buildGdeArchive(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = projectArchiveName(doc);
  link.click();
  URL.revokeObjectURL(url);
}

export function documentFromLegacyJson(raw: string): GddDocument {
  return normalizeDocument(parseGdeProject(raw));
}
