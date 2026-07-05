import type { SidebarPendingRemove } from "@/features/sidebar/lib/sidebarTypes";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { useLocale } from "@/shared/context/LocaleContext";

interface SidebarRemoveDialogProps {
  pendingRemove: SidebarPendingRemove | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function SidebarRemoveDialog({ pendingRemove, onClose, onConfirm }: SidebarRemoveDialogProps) {
  const { t } = useLocale();

  return (
    <ConfirmDialog
      open={pendingRemove !== null}
      title={
        pendingRemove?.kind === "folder"
          ? t("sidebar.removeFolder")
          : pendingRemove?.kind === "group"
            ? t("sidebar.deleteGroupSections")
            : t("sidebar.removeSection")
      }
      message={
        pendingRemove
          ? pendingRemove.kind === "folder"
            ? t("sidebar.confirmRemoveFolder", { title: pendingRemove.title })
            : pendingRemove.kind === "group"
              ? t("sidebar.confirmDeleteGroupSections", { count: pendingRemove.count })
              : t("sidebar.confirmRemove", { title: pendingRemove.title })
          : ""
      }
      confirmLabel={
        pendingRemove?.kind === "folder"
          ? t("sidebar.removeFolder")
          : pendingRemove?.kind === "group"
            ? t("sidebar.deleteGroupSections")
            : t("sidebar.removeSection")
      }
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
