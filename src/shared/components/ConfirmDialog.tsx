import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "@/shared/context/LocaleContext";
import "@/shared/styles/LinkMenus.css";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  const { t } = useLocale();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => confirmRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
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

  const dialog = (
    <div className="link-dialog-backdrop" onPointerDown={onClose}>
      <div
        className="link-paste-dialog"
        role="alertdialog"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-dialog-title" className="link-paste-title">
          {title}
        </h3>
        <p id="confirm-dialog-message" className="confirm-dialog-message">
          {message}
        </p>
        <div className="link-paste-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("link.cancel")}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="btn"
            onClick={onConfirm}
          >
            {confirmLabel ?? t("dialog.confirm")}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
