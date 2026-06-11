import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "@/shared/context/LocaleContext";
import "@/shared/styles/LinkMenus.css";

interface Space3DContextMenuProps {
  x: number;
  y: number;
  canRemove: boolean;
  onAddBox: () => void;
  onAddSphere: () => void;
  onOpenModels: () => void;
  onRemove: () => void;
  onClose: () => void;
}

export function Space3DContextMenu({
  x,
  y,
  canRemove,
  onAddBox,
  onAddSphere,
  onOpenModels,
  onRemove,
  onClose,
}: Space3DContextMenuProps) {
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

  return createPortal(
    <div
      ref={menuRef}
      className="link-context-menu space3d-context-menu"
      style={{ left: x, top: y }}
      role="menu"
    >
      <button type="button" className="link-menu-item" role="menuitem" onClick={onAddBox}>
        {t("space3d.addBox")}
      </button>
      <button type="button" className="link-menu-item" role="menuitem" onClick={onAddSphere}>
        {t("space3d.addSphere")}
      </button>
      <button type="button" className="link-menu-item" role="menuitem" onClick={onOpenModels}>
        {t("space3d.models")}
      </button>
      <div className="board-menu-sep" role="separator" />
      <button
        type="button"
        className="link-menu-item"
        role="menuitem"
        disabled={!canRemove}
        onClick={onRemove}
      >
        {t("space3d.remove")}
      </button>
    </div>,
    document.body
  );
}
