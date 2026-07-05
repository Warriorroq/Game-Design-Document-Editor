import { useLocale } from "@/shared/context/LocaleContext";
import { restoreAppFocus } from "@/shared/lib/desktop";

interface SidebarCreateMenuProps {
  parentFolderId: string | null;
  onAddSection: (folderId?: string) => void;
  onAddSpace3DSection: (folderId?: string) => void;
  onAddFolder: (parentFolderId?: string) => void;
  onClose: () => void;
}

export function SidebarCreateMenu({
  parentFolderId,
  onAddSection,
  onAddSpace3DSection,
  onAddFolder,
  onClose
}: SidebarCreateMenuProps) {
  const { t } = useLocale();

  const pickSection = () => {
    onAddSection(parentFolderId ?? undefined);
    onClose();
    restoreAppFocus();
  };

  const pickSpace3D = () => {
    onAddSpace3DSection(parentFolderId ?? undefined);
    onClose();
    restoreAppFocus();
  };

  const pickFolder = () => {
    onAddFolder(parentFolderId ?? undefined);
    onClose();
    restoreAppFocus();
  };

  return (
    <div className="sidebar-create-menu" role="menu">
      <button type="button" className="sidebar-create-menu-item" role="menuitem" onClick={pickSection}>
        {t("sidebar.createSection")}
      </button>
      <button type="button" className="sidebar-create-menu-item" role="menuitem" onClick={pickSpace3D}>
        {t("sidebar.createSpace3D")}
      </button>
      <button type="button" className="sidebar-create-menu-item" role="menuitem" onClick={pickFolder}>
        {t("sidebar.createFolder")}
      </button>
    </div>
  );
}
