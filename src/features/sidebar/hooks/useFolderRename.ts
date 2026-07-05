import { type KeyboardEvent, useCallback, useState } from "react";

import { restoreAppFocus } from "@/shared/lib/desktop";
import type { GddSectionFolder } from "@/shared/types";

interface UseFolderRenameOptions {
  onUpdateFolder: (id: string, patch: Partial<GddSectionFolder>) => void;
}

export function useFolderRename({ onUpdateFolder }: UseFolderRenameOptions) {
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const startRenameFolder = useCallback((folder: GddSectionFolder) => {
    setRenamingFolderId(folder.id);
    setRenameValue(folder.title);
  }, []);

  const commitRenameFolder = useCallback(
    (folderId: string) => {
      const title = renameValue.trim();
      if (title) onUpdateFolder(folderId, { title });
      setRenamingFolderId(null);
      setRenameValue("");
      restoreAppFocus();
    },
    [onUpdateFolder, renameValue]
  );

  const cancelRenameFolder = useCallback(() => {
    setRenamingFolderId(null);
    setRenameValue("");
  }, []);

  const onRenameKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>, folderId: string) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitRenameFolder(folderId);
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelRenameFolder();
      }
    },
    [cancelRenameFolder, commitRenameFolder]
  );

  return {
    renamingFolderId,
    renameValue,
    setRenameValue,
    startRenameFolder,
    commitRenameFolder,
    cancelRenameFolder,
    onRenameKeyDown
  };
}
