import { useCallback, useEffect, useRef, useState } from "react";
import {
  folderLabel,
  getStoredProjectFolder,
  loadProjectFromFolder,
  pickProjectFolder,
  saveProjectToFolder,
  setStoredProjectFolder,
} from "../lib/projectFolder";
import { getGitStatus, type GitStatus } from "../lib/git";
import { isDesktopApp } from "../lib/desktop";
import type { GddDocument } from "../types";

export function useProjectFolder() {
  const [folderPath, setFolderPath] = useState<string | null>(() =>
    isDesktopApp ? getStoredProjectFolder() : null
  );
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [gitAvailable, setGitAvailable] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshGitStatus = useCallback(async (path: string | null) => {
    if (!path || !isDesktopApp) {
      setGitStatus(null);
      return;
    }
    try {
      const status = await getGitStatus(path);
      setGitStatus(status);
    } catch {
      setGitStatus(null);
    }
  }, []);

  useEffect(() => {
    if (!isDesktopApp || !window.gddDesktop?.git) return;
    void window.gddDesktop.git.isAvailable().then(setGitAvailable);
  }, []);

  useEffect(() => {
    void refreshGitStatus(folderPath);
  }, [folderPath, refreshGitStatus]);

  const bindFolder = useCallback(
    (path: string | null) => {
      setFolderPath(path);
      setStoredProjectFolder(path);
      void refreshGitStatus(path);
    },
    [refreshGitStatus]
  );

  const openFolder = useCallback(async () => {
    const picked = await pickProjectFolder();
    if (!picked) return null;
    bindFolder(picked.folderPath);
    return picked;
  }, [bindFolder]);

  const loadFromFolder = useCallback(async (path: string) => {
    return loadProjectFromFolder(path);
  }, []);

  const saveDoc = useCallback(
    async (doc: GddDocument) => {
      if (!folderPath) return;
      await saveProjectToFolder(folderPath, doc);
      await refreshGitStatus(folderPath);
    },
    [folderPath, refreshGitStatus]
  );

  const scheduleSaveDoc = useCallback(
    (doc: GddDocument) => {
      if (!folderPath) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void saveDoc(doc);
      }, 600);
    },
    [folderPath, saveDoc]
  );

  const closeFolder = useCallback(() => {
    bindFolder(null);
  }, [bindFolder]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  return {
    folderPath,
    folderName: folderPath ? folderLabel(folderPath) : null,
    gitStatus,
    gitAvailable,
    openFolder,
    loadFromFolder,
    saveDoc,
    scheduleSaveDoc,
    closeFolder,
    refreshGitStatus,
  };
}
