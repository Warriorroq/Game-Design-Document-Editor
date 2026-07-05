import type { RefObject } from "react";

import { SidebarCreateMenu } from "@/features/sidebar/components/SidebarCreateMenu";
import { useLocale } from "@/shared/context/LocaleContext";

interface SidebarCreateButtonProps {
  parentFolderId: string | null;
  compact?: boolean;
  open: boolean;
  menuRef?: RefObject<HTMLDivElement | null>;
  onToggle: (parentFolderId: string | null) => void;
  onClose: () => void;
  onAddSection: (folderId?: string) => void;
  onAddSpace3DSection: (folderId?: string) => void;
  onAddFolder: (parentFolderId?: string) => void;
}

export function SidebarCreateButton({
  parentFolderId,
  compact = false,
  open,
  menuRef,
  onToggle,
  onClose,
  onAddSection,
  onAddSpace3DSection,
  onAddFolder
}: SidebarCreateButtonProps) {
  const { t } = useLocale();

  return (
    <div
      className={`sidebar-create-wrap ${compact ? "sidebar-create-wrap--compact" : ""}`}
      ref={open ? menuRef : undefined}
    >
      <button
        type="button"
        className={compact ? "folder-add-section" : "btn btn-icon"}
        onClick={() => onToggle(parentFolderId)}
        title={t("sidebar.createItem")}
        aria-label={t("sidebar.createItem")}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        +
      </button>
      {open && (
        <SidebarCreateMenu
          parentFolderId={parentFolderId}
          onAddSection={onAddSection}
          onAddSpace3DSection={onAddSpace3DSection}
          onAddFolder={onAddFolder}
          onClose={onClose}
        />
      )}
    </div>
  );
}
