import { useEffect } from "react";
import { parseGdeArchive } from "@/infrastructure/project/gdeArchive";
import type { GddDocument } from "@/domain/types";

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function useDesktopArchiveOpen(
  onImport: (doc: GddDocument) => void,
  onError: (message: string) => void
) {
  useEffect(() => {
    const projectApi = window.gddDesktop?.project;
    if (!projectApi?.onOpenArchive || !projectApi.readArchive) return;

    const handleOpen = async (filePath: string) => {
      try {
        const result = await projectApi.readArchive(filePath);
        if (!result.ok || !result.dataBase64) {
          onError(result.error ?? "read_failed");
          return;
        }
        const doc = await parseGdeArchive(base64ToArrayBuffer(result.dataBase64));
        onImport(doc);
      } catch (err) {
        onError(err instanceof Error ? err.message : "read_failed");
      }
    };

    return projectApi.onOpenArchive((filePath) => {
      void handleOpen(filePath);
    });
  }, [onImport, onError]);
}
