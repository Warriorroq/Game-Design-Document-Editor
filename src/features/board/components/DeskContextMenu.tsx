import { useEffect, useRef } from "react";
import { useLocale } from "@/shared/context/LocaleContext";
import { createPortal } from "react-dom";
import type { BoardDrawTool } from "@/shared/types";
import "@/shared/styles/LinkMenus.css";

interface DeskContextMenuProps {
  x: number;
  y: number;
  canGroup: boolean;
  canUngroup: boolean;
  canCopy: boolean;
  canPaste: boolean;
  canLock: boolean;
  canUnlock: boolean;
  canBringForward: boolean;
  canSendBackward: boolean;
  canFlipHorizontal: boolean;
  canFlipVertical: boolean;
  onPick: (type: BoardDrawTool) => void;
  onAddText: () => void;
  onInsertVideo: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onLock: () => void;
  onUnlock: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
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
  canBringForward,
  canSendBackward,
  canFlipHorizontal,
  canFlipVertical,
  onPick,
  onAddText,
  onInsertVideo,
  onGroup,
  onUngroup,
  onCopy,
  onPaste,
  onLock,
  onUnlock,
  onBringForward,
  onSendBackward,
  onFlipHorizontal,
  onFlipVertical,
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
      <button
        type="button"
        className="link-menu-item"
        role="menuitem"
        onClick={onInsertVideo}
      >
        {t("menu.insertVideo")}
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
      {(canBringForward || canSendBackward || canFlipHorizontal || canFlipVertical) && (
        <div className="board-menu-sep" role="separator" />
      )}
      {canBringForward && (
        <button
          type="button"
          className="link-menu-item"
          role="menuitem"
          onClick={onBringForward}
        >
          {t("desk.bringForward")}
        </button>
      )}
      {canSendBackward && (
        <button
          type="button"
          className="link-menu-item"
          role="menuitem"
          onClick={onSendBackward}
        >
          {t("desk.sendBackward")}
        </button>
      )}
      {canFlipHorizontal && (
        <button
          type="button"
          className="link-menu-item"
          role="menuitem"
          onClick={onFlipHorizontal}
        >
          {t("desk.flipHorizontal")}
        </button>
      )}
      {canFlipVertical && (
        <button
          type="button"
          className="link-menu-item"
          role="menuitem"
          onClick={onFlipVertical}
        >
          {t("desk.flipVertical")}
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
