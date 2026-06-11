import { useCallback, useEffect, useRef, useState } from "react";
import {
  folderLabel,
  getStoredProjectFolder,
  loadProjectFromFolder,
  pickProjectFolder,
  saveProjectToFolder,
  setStoredProjectFolder,
} from "@/infrastructure/project/projectFolder";
import { getGitStatus, type GitStatus } from "@/infrastructure/git";
import { isDesktopApp } from "@/infrastructure/desktop/desktop";
import type { GddDocument } from "@/domain/types";

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

  const pickFolder = useCallback(async () => {
    return pickProjectFolder();
  }, []);

  const bindProjectFolder = useCallback(
    (path: string | null) => {
      bindFolder(path);
    },
    [bindFolder]
  );

  const loadFromFolder = useCallback(async (path: string) => {
    return loadProjectFromFolder(path);
  }, []);

  const saveDocTo = useCallback(
    async (path: string, doc: GddDocument) => {
      await saveProjectToFolder(path, doc);
      await refreshGitStatus(path);
    },
    [refreshGitStatus]
  );

  const saveDoc = useCallback(
    async (doc: GddDocument) => {
      if (!folderPath) return;
      await saveDocTo(folderPath, doc);
    },
    [folderPath, saveDocTo]
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
    pickFolder,
    bindProjectFolder,
    loadFromFolder,
    saveDoc,
    saveDocTo,
    scheduleSaveDoc,
    closeFolder,
    refreshGitStatus,
  };
}
