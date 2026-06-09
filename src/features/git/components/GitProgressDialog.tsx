import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "@/shared/context/LocaleContext";
import "@/shared/styles/LinkMenus.css";

export type GitSyncOperation = "push" | "pull";

export interface GitSyncProgressState {
  operation: GitSyncOperation;
  lines: string[];
  percent: number | null;
  status: "running" | "success" | "error";
  error?: string;
}

interface GitProgressDialogProps {
  state: GitSyncProgressState | null;
  onClose: () => void;
}

export function GitProgressDialog({ state, onClose }: GitProgressDialogProps) {
  const { t } = useLocale();
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state) return;
    const el = logRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [state?.lines, state]);

  useEffect(() => {
    if (!state || state.status === "running") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, onClose]);

  if (!state) return null;

  const title =
    state.operation === "push" ? t("git.progressPush") : t("git.progressPull");

  const statusLabel =
    state.status === "running"
      ? t("git.progressRunning")
      : state.status === "success"
        ? t("git.progressSuccess")
        : t("git.progressFailed");

  const dialog = (
    <div
      className="link-dialog-backdrop"
      onPointerDown={state.status === "running" ? undefined : onClose}
    >
      <div
        className="link-paste-dialog git-progress-dialog"
        role="dialog"
        aria-labelledby="git-progress-title"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <h3 id="git-progress-title" className="link-paste-title">
          {title}
        </h3>
        <p
          className={`git-progress-status git-progress-status--${state.status}`}
        >
          {statusLabel}
        </p>
        {state.percent !== null && state.status === "running" && (
          <div className="git-progress-bar" aria-hidden>
            <div
              className="git-progress-bar-fill"
              style={{ width: `${Math.min(100, Math.max(0, state.percent))}%` }}
            />
          </div>
        )}
        {state.percent !== null && state.status === "running" && (
          <p className="git-progress-percent">{state.percent}%</p>
        )}
        <div className="git-progress-log" ref={logRef} role="log" aria-live="polite">
          {state.lines.length === 0 ? (
            <p className="git-progress-log-empty">{t("git.progressWaiting")}</p>
          ) : (
            state.lines.map((line, index) => (
              <div key={`${index}-${line}`} className="git-progress-log-line">
                {line}
              </div>
            ))
          )}
        </div>
        {state.status === "error" && state.error && (
          <p className="git-progress-error" role="alert">
            {state.error}
          </p>
        )}
        {state.status !== "running" && (
          <div className="link-paste-actions">
            <button type="button" className="btn" onClick={onClose}>
              {t("git.progressClose")}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}

export function parseGitProgressPercent(line: string): number | null {
  const match = line.match(/(\d+)%/);
  if (match) return Number(match[1]);

  const ratio = line.match(/\((\d+)\/(\d+)\)/);
  if (ratio) {
    const current = Number(ratio[1]);
    const total = Number(ratio[2]);
    if (total > 0) return Math.round((current / total) * 100);
  }

  return null;
}
