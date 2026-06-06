import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "../context/LocaleContext";
import "./LinkMenus.css";

export type GitPromptKind = "commit" | "remote";

interface GitPromptDialogProps {
  kind: GitPromptKind | null;
  initialValue?: string;
  onClose: () => void;
  onSubmit: (value: string) => void;
}

export function GitPromptDialog({
  kind,
  initialValue = "",
  onClose,
  onSubmit,
}: GitPromptDialogProps) {
  const { t } = useLocale();
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!kind) return;
    setValue(initialValue);
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [kind, initialValue]);

  useEffect(() => {
    if (!kind) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [kind, onClose]);

  if (!kind) return null;

  const title =
    kind === "commit" ? t("git.dialogCommitTitle") : t("git.dialogRemoteTitle");
  const label =
    kind === "commit" ? t("git.commitPrompt") : t("git.remotePrompt");

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  const dialog = (
    <div className="link-dialog-backdrop" onPointerDown={onClose}>
      <div
        className="link-paste-dialog"
        role="dialog"
        aria-labelledby="git-prompt-title"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <h3 id="git-prompt-title" className="link-paste-title">
          {title}
        </h3>
        <label className="link-paste-field">
          <span>{label}</span>
          <input
            ref={inputRef}
            type={kind === "remote" ? "url" : "text"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={kind === "remote" ? "https://github.com/user/repo.git" : ""}
          />
        </label>
        <div className="link-paste-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("link.cancel")}
          </button>
          <button type="button" className="btn" onClick={submit}>
            {t("git.apply")}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
