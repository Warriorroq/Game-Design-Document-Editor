import { useState } from "react";
import { useLocale } from "../context/LocaleContext";
import {
  applyGitIdentity,
  commitGitChanges,
  formatGitError,
  getGitRemote,
  initGitRepo,
  pullGitChanges,
  pushGitChanges,
  setGitRemote,
  type GitStatus,
} from "../lib/git";
import type { GitPromptKind } from "../components/GitPromptDialog";
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
    void runSync("pull");
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
  };
}
