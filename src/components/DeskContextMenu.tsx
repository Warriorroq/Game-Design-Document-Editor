import { useEffect, useRef } from "react";
import { useLocale } from "../context/LocaleContext";
import { createPortal } from "react-dom";
import type { BoardDrawTool } from "../types";
import "./LinkMenus.css";

interface DeskContextMenuProps {
  x: number;
  y: number;
  canGroup: boolean;
  canUngroup: boolean;
  canCopy: boolean;
  canPaste: boolean;
  canLock: boolean;
  canUnlock: boolean;
  onPick: (type: BoardDrawTool) => void;
  onAddText: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onLock: () => void;
  onUnlock: () => void;
  onClose: () => void;
}

export function DeskContextMenu({
  x,
  y,
  canGroup,
  canUngroup,
  canCopy,
  canPaste,
  canLock,
  canUnlock,
  onPick,
  onAddText,
  onGroup,
  onUngroup,
  onCopy,
  onPaste,
  onLock,
  onUnlock,
  onClose,
}: DeskContextMenuProps) {
  const { t } = useLocale();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPointer = (e: PointerEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, [onClose]);

  const menu = (
    <div
      ref={menuRef}
      className="link-context-menu desk-context-menu"
      style={{ left: x, top: y }}
      role="menu"
    >
      <button
        type="button"
        className="link-menu-item"
        role="menuitem"
        onClick={() => onPick("arrow")}
      >
        {t("menu.addArrow")}
      </button>
      <button
        type="button"
        className="link-menu-item"
        role="menuitem"
        onClick={() => onPick("line")}
      >
        {t("menu.addLine")}
      </button>
      <button
        type="button"
        className="link-menu-item"
        role="menuitem"
        onClick={() => onPick("box")}
      >
        {t("menu.addBox")}
      </button>
      <button
        type="button"
        className="link-menu-item"
        role="menuitem"
        onClick={onAddText}
      >
        {t("menu.addText")}
      </button>
      <div className="board-menu-sep" role="separator" />
      {canCopy && (
        <button type="button" className="link-menu-item" role="menuitem" onClick={onCopy}>
          {t("menu.copy")}
        </button>
      )}
      {canPaste && (
        <button type="button" className="link-menu-item" role="menuitem" onClick={onPaste}>
          {t("menu.paste")}
        </button>
      )}
      {canLock && (
        <button type="button" className="link-menu-item" role="menuitem" onClick={onLock}>
          {t("desk.lock")}
        </button>
      )}
      {canUnlock && (
        <button type="button" className="link-menu-item" role="menuitem" onClick={onUnlock}>
          {t("desk.unlock")}
        </button>
      )}
      {canGroup && (
        <button type="button" className="link-menu-item" role="menuitem" onClick={onGroup}>
          {t("desk.group")}
        </button>
      )}
      {canUngroup && (
        <button type="button" className="link-menu-item" role="menuitem" onClick={onUngroup}>
          {t("desk.ungroup")}
        </button>
      )}
    </div>
  );

  return createPortal(menu, document.body);
}
