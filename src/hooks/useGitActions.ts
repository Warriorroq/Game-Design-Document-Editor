import { useState } from "react";
import { useLocale } from "../context/LocaleContext";
import {
  applyGitIdentity,
  commitGitChanges,
  discardGitProjectChanges,
  formatGitError,
  getGitRemote,
  getGitStatus,
  initGitRepo,
  pullGitChanges,
  pushGitChanges,
  setGitRemote,
  stashGitChanges,
  type GitFileStatus,
  type GitStatus,
} from "../lib/git";
import type { GitPromptKind } from "../components/GitPromptDialog";
import type { GitPullConfirmAction } from "../components/GitPullConfirmDialog";
import {
  parseGitProgressPercent,
  type GitSyncOperation,
  type GitSyncProgressState,
} from "../components/GitProgressDialog";

interface UseGitActionsOptions {
  folderPath: string | null;
  gitStatus: GitStatus | null;
  gitAvailable: boolean;
  onRefreshStatus: () => void;
  onAfterPull?: () => void;
  onFlushProject?: () => Promise<void>;
  onCloseMenu?: () => void;
}

export function useGitActions({
  folderPath,
  gitStatus,
  gitAvailable,
  onRefreshStatus,
  onAfterPull,
  onFlushProject,
  onCloseMenu,
}: UseGitActionsOptions) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  const [promptKind, setPromptKind] = useState<GitPromptKind | null>(null);
  const [promptInitial, setPromptInitial] = useState("");
  const [syncProgress, setSyncProgress] =
    useState<GitSyncProgressState | null>(null);
  const [pullConfirmFiles, setPullConfirmFiles] = useState<
    GitFileStatus[] | null
  >(null);

  const isRepo = Boolean(gitStatus?.isRepo);
  const dirty = Boolean(gitStatus?.dirty);
  const branch = gitStatus?.branch ?? "—";

  const runAction = async (action: () => Promise<void>) => {
    if (busy || !folderPath) return;
    setBusy(true);
    try {
      await action();
      onRefreshStatus();
    } finally {
      setBusy(false);
    }
  };

  const appendProgressLine = (line: string) => {
    setSyncProgress((prev) => {
      if (!prev) return prev;
      const percent = parseGitProgressPercent(line) ?? prev.percent;
      return {
        ...prev,
        lines: [...prev.lines.slice(-80), line],
        percent,
      };
    });
  };

  const runSync = async (operation: GitSyncOperation) => {
    if (!folderPath) return;
    onCloseMenu?.();
    setSyncProgress({
      operation,
      lines: [],
      percent: null,
      status: "running",
    });

    const onProgress = (event: { line: string }) => {
      appendProgressLine(event.line);
    };

    const result =
      operation === "push"
        ? await pushGitChanges(folderPath, onProgress)
        : await pullGitChanges(folderPath, onProgress);

    if (result.ok) {
      setSyncProgress((prev) =>
        prev ? { ...prev, status: "success", percent: 100 } : prev
      );
      onRefreshStatus();
      if (operation === "pull") {
        onAfterPull?.();
      }
      return;
    }

    setSyncProgress((prev) =>
      prev
        ? {
            ...prev,
            status: "error",
            error: formatGitError(result.error, t),
          }
        : prev
    );
  };

  const handleInit = () => {
    if (!folderPath) return;
    void runAction(async () => {
      const result = await initGitRepo(folderPath);
      if (!result.ok) {
        window.alert(formatGitError(result.error, t));
        return;
      }
      await applyGitIdentity(folderPath);
      onCloseMenu?.();
    });
  };

  const openPrompt = (kind: GitPromptKind, initial = "") => {
    onCloseMenu?.();
    setPromptKind(kind);
    setPromptInitial(initial);
  };

  const handleCommitClick = () => {
    openPrompt("commit");
  };

  const handleSetRemoteClick = async () => {
    if (!folderPath) return;
    const current = await getGitRemote(folderPath);
    openPrompt("remote", current ?? "");
  };

  const handlePromptSubmit = (value: string) => {
    const kind = promptKind;
    setPromptKind(null);
    if (!kind || !folderPath) return;

    if (kind === "commit") {
      void runAction(async () => {
        await onFlushProject?.();
        const result = await commitGitChanges(folderPath, value);
        if (!result.ok) {
          window.alert(formatGitError(result.error, t));
        }
      });
      return;
    }

    void runAction(async () => {
      const result = await setGitRemote(folderPath, value);
      if (!result.ok) {
        window.alert(formatGitError(result.error, t));
      }
    });
  };

  const handlePush = () => {
    if (busy || syncProgress?.status === "running") return;
    void runSync("push");
  };

  const handlePull = () => {
    if (busy || syncProgress?.status === "running") return;
    void (async () => {
      await onFlushProject?.();
      onRefreshStatus();

      if (!folderPath) return;
      let status: GitStatus;
      try {
        status = await getGitStatus(folderPath);
      } catch {
        void runSync("pull");
        return;
      }

      if (status.dirty && status.files && status.files.length > 0) {
        onCloseMenu?.();
        setPullConfirmFiles(status.files);
        return;
      }

      void runSync("pull");
    })();
  };

  const handlePullConfirm = (action: GitPullConfirmAction) => {
    if (!folderPath || busy || syncProgress?.status === "running") return;
    const files = pullConfirmFiles;
    setPullConfirmFiles(null);

    void (async () => {
      const prep =
        action === "stash"
          ? await stashGitChanges(folderPath)
          : await discardGitProjectChanges(folderPath);

      if (!prep.ok) {
        window.alert(formatGitError(prep.error, t));
        if (files) setPullConfirmFiles(files);
        return;
      }

      onRefreshStatus();
      void runSync("pull");
    })();
  };

  const handlePullConfirmClose = () => {
    if (busy || syncProgress?.status === "running") return;
    setPullConfirmFiles(null);
  };

  return {
    branch,
    dirty,
    isRepo,
    busy,
    gitAvailable,
    promptKind,
    promptInitial,
    syncProgress,
    setPromptKind,
    setSyncProgress,
    handleInit,
    handleCommitClick,
    handleSetRemoteClick,
    handlePromptSubmit,
    handlePush,
    handlePull,
    pullConfirmFiles,
    handlePullConfirm,
    handlePullConfirmClose,
  };
}
