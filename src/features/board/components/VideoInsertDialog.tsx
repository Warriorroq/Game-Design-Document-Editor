import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { parseVideoEmbed } from "@/domain/board/videoEmbed";
import { useLocale } from "@/shared/context/LocaleContext";
import "@/shared/styles/LinkMenus.css";

interface VideoInsertDialogProps {
  open: boolean;
  onClose: () => void;
  onInsert: (url: string) => void;
}

export function VideoInsertDialog({ open, onClose, onInsert }: VideoInsertDialogProps) {
  const { t } = useLocale();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setUrl("");
    setError(null);
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = () => {
    const value = url.trim();
    if (!value) {
      setError(t("desk.videoUrlRequired"));
      return;
    }
    if (!parseVideoEmbed(value)) {
      setError(t("desk.videoUrlInvalid"));
      return;
    }
    onInsert(value);
    onClose();
  };

  const dialog = (
    <div className="link-dialog-backdrop" onPointerDown={onClose}>
      <div
        className="link-paste-dialog"
        role="dialog"
        aria-labelledby="video-insert-title"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <h3 id="video-insert-title" className="link-paste-title">
          {t("desk.videoDialogTitle")}
        </h3>
        <p className="link-paste-hint">{t("desk.videoDialogHint")}</p>
        <label className="link-paste-field">
          <span>{t("desk.videoUrl")}</span>
          <input
            ref={inputRef}
            type="url"
            value={url}
            placeholder={t("desk.videoUrlPlaceholder")}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />
        </label>
        {error && <p className="link-paste-error">{error}</p>}
        <div className="link-paste-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("link.cancel")}
          </button>
          <button type="button" className="btn" onClick={submit}>
            {t("desk.videoInsert")}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
