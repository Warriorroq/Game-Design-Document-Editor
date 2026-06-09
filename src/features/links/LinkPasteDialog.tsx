import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "@/shared/context/LocaleContext";
import { useLinkContext } from "@/features/links/LinkContext";
import "@/shared/styles/LinkMenus.css";

export function LinkPasteDialog() {
  const { t } = useLocale();
  const { pasteDialog, closePasteDialog } = useLinkContext();
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pasteDialog) return;
    setText(pasteDialog.suggestedText);
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [pasteDialog]);

  useEffect(() => {
    if (!pasteDialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePasteDialog();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pasteDialog, closePasteDialog]);

  if (!pasteDialog) return null;

  const submit = () => {
    const label = text.trim() || pasteDialog.suggestedText;
    pasteDialog.insert(pasteDialog.href, label);
    closePasteDialog();
  };

  const dialog = (
    <div className="link-dialog-backdrop" onPointerDown={closePasteDialog}>
      <div
        className="link-paste-dialog"
        role="dialog"
        aria-labelledby="link-paste-title"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <h3 id="link-paste-title" className="link-paste-title">
          {t("link.dialogTitle")}
        </h3>
        <label className="link-paste-field">
          <span>{t("link.url")}</span>
          <input type="text" value={pasteDialog.href} readOnly />
        </label>
        <label className="link-paste-field">
          <span>{t("link.text")}</span>
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />
        </label>
        <div className="link-paste-actions">
          <button type="button" className="btn btn-ghost" onClick={closePasteDialog}>
            {t("link.cancel")}
          </button>
          <button type="button" className="btn" onClick={submit}>
            {t("link.insert")}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
