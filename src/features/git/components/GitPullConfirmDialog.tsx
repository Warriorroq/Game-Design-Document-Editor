import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "@/shared/context/LocaleContext";
import type { GitFileStatus } from "@/features/git/lib/git";
import "@/shared/styles/LinkMenus.css";

export type GitPullConfirmAction = "stash" | "discard";

interface GitPullConfirmDialogProps {
  open: boolean;
  files: GitFileStatus[];
  busy?: boolean;
  onClose: () => void;
  onConfirm: (action: GitPullConfirmAction) => void;
}

export function GitPullConfirmDialog({
  open,
  files,
  busy = false,
  onClose,
  onConfirm,
}: GitPullConfirmDialogProps) {
  const { t } = useLocale();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const dialog = (
    <div
      className="link-dialog-backdrop"
      onPointerDown={busy ? undefined : onClose}
    >
      <div
        className="link-paste-dialog git-pull-confirm-dialog"
        role="dialog"
        aria-labelledby="git-pull-confirm-title"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <h3 id="git-pull-confirm-title" className="link-paste-title">
          {t("git.pullConfirmTitle")}
        </h3>
        <p className="git-pull-confirm-message">{t("git.pullConfirmMessage")}</p>
        <div className="git-pull-confirm-changes">
          <span className="git-menu-changes-label">{t("git.changes")}</span>
          <ul>
            {files.slice(0, 12).map((file) => (
              <li key={`${file.status}-${file.path}`}>
                <span className="git-file-status">{file.status}</span>
                {file.path}
              </li>
            ))}
          </ul>
          {files.length > 12 && (
            <p className="git-pull-confirm-more">
              {t("git.pullConfirmMore", { count: files.length - 12 })}
            </p>
          )}
        </div>
        <div className="link-paste-actions git-pull-confirm-actions">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={onClose}
          >
            {t("link.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={() => onConfirm("stash")}
          >
            {t("git.pullConfirmStash")}
          </button>
          <button
            type="button"
            className="btn btn-warning"
            disabled={busy}
            onClick={() => onConfirm("discard")}
          >
            {t("git.pullConfirmDiscard")}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
