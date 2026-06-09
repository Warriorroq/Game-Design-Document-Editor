import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "@/shared/context/LocaleContext";
import { useLinkContext } from "@/features/links/LinkContext";
import { isNavigableHref, suggestLinkText } from "@/features/links/lib/links";
import "@/shared/styles/LinkMenus.css";

export function LinkContextMenu() {
  const { t } = useLocale();
  const {
    contextMenu,
    closeContextMenu,
    copyHref,
    openPasteDialog,
    doc,
  } = useLinkContext();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeContextMenu();
    };
    const onPointer = (e: PointerEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      closeContextMenu();
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, [contextMenu, closeContextMenu]);

  if (!contextMenu) return null;

  const handleCopy = async () => {
    if (contextMenu.copyHref) {
      await copyHref(contextMenu.copyHref);
    }
    closeContextMenu();
  };

  const handlePaste = async () => {
    const paste = contextMenu.pasteLink;
    closeContextMenu();
    if (!paste) return;
    try {
      const clip = (await navigator.clipboard.readText()).trim();
      if (!isNavigableHref(clip)) return;
      openPasteDialog({
        ...paste,
        href: clip,
        suggestedText: suggestLinkText(doc, clip),
      });
    } catch {
      /* clipboard denied */
    }
  };

  const canCopy = Boolean(contextMenu.copyHref);
  const canPaste = Boolean(contextMenu.pasteLink);
  const actions = contextMenu.actions ?? [];
  const canActions = actions.length > 0;

  const menu = (
    <div
      ref={menuRef}
      className="link-context-menu"
      style={{ left: contextMenu.x, top: contextMenu.y }}
      role="menu"
    >
      {canCopy && (
        <button type="button" className="link-menu-item" role="menuitem" onClick={handleCopy}>
          {t("menu.copyLink")}
        </button>
      )}
      {canPaste && (
        <button type="button" className="link-menu-item" role="menuitem" onClick={handlePaste}>
          {t("menu.pasteLink")}
        </button>
      )}
      {canActions && (
        <>
          {(canCopy || canPaste) && <div className="board-menu-sep" role="separator" />}
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              className="link-menu-item"
              role="menuitem"
              disabled={action.disabled}
              onClick={() => {
                action.onClick();
                closeContextMenu();
              }}
            >
              {action.label}
            </button>
          ))}
        </>
      )}
    </div>
  );

  return createPortal(menu, document.body);
}
