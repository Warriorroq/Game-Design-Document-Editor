import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "@/shared/context/LocaleContext";
import "@/shared/styles/LinkMenus.css";

export type GitPromptKind = "commit" | "remote";

interface GitPromptDialogProps {
  kind: GitPromptKind | null;
  initialValue?: string;
  onClose: () => void;
  onSubmit: (value: string) => void;
}

function focusGitPromptInput(input: HTMLInputElement | null) {
  if (!input) return;
  input.focus({ preventScroll: true });
  input.select();
}

export function GitPromptDialog({
  kind,
  initialValue = "",
  onClose,
  onSubmit,
}: GitPromptDialogProps) {
  const { t } = useLocale();
  const [value, setValue] = useState(initialValue);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!kind) return;
    setValue(initialValue);

    focusGitPromptInput(inputRef.current);
    const raf = window.requestAnimationFrame(() => {
      focusGitPromptInput(inputRef.current);
    });
    const timer = window.setTimeout(() => {
      focusGitPromptInput(inputRef.current);
    }, 100);

    const trapFocus = (e: FocusEvent) => {
      const dialog = dialogRef.current;
      const input = inputRef.current;
      if (!dialog || !input) return;
      if (dialog.contains(e.target as Node)) return;
      focusGitPromptInput(input);
    };

    document.addEventListener("focusin", trapFocus, true);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      document.removeEventListener("focusin", trapFocus, true);
    };
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

  const closeIfBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const dialog = (
    <div
      className="link-dialog-backdrop"
      onMouseDown={closeIfBackdrop}
    >
      <div
        ref={dialogRef}
        className="link-paste-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="git-prompt-title"
        onMouseDown={(e) => e.stopPropagation()}
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
            autoFocus
            autoComplete="off"
            spellCheck={false}
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
