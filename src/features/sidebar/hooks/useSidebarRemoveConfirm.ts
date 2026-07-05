import { useCallback, useState } from "react";

import type { SidebarPendingRemove } from "@/features/sidebar/lib/sidebarTypes";
import { restoreAppFocus } from "@/shared/lib/desktop";

interface UseSidebarRemoveConfirmOptions {
  onRemoveSection: (id: string) => void;
  onRemoveFolder: (id: string) => void;
  onRemoveSections: (ids: string[]) => void;
  getSelectedGroupIds: () => string[];
  clearGroupSelection: () => void;
}

export function useSidebarRemoveConfirm({
  onRemoveSection,
  onRemoveFolder,
  onRemoveSections,
  getSelectedGroupIds,
  clearGroupSelection
}: UseSidebarRemoveConfirmOptions) {
  const [pendingRemove, setPendingRemove] = useState<SidebarPendingRemove | null>(null);

  const requestRemoveSection = useCallback((id: string, title: string) => {
    setPendingRemove({ kind: "section", id, title });
  }, []);

  const requestRemoveFolder = useCallback((id: string, title: string) => {
    setPendingRemove({ kind: "folder", id, title });
  }, []);

  const requestRemoveGroup = useCallback((count: number) => {
    setPendingRemove({ kind: "group", count });
  }, []);

  const closeRemoveConfirm = useCallback(() => {
    setPendingRemove(null);
  }, []);

  const confirmRemove = useCallback(() => {
    if (!pendingRemove) return;
    if (pendingRemove.kind === "section") onRemoveSection(pendingRemove.id);
    else if (pendingRemove.kind === "folder") onRemoveFolder(pendingRemove.id);
    else {
      onRemoveSections(getSelectedGroupIds());
      clearGroupSelection();
    }
    setPendingRemove(null);
    restoreAppFocus();
  }, [clearGroupSelection, getSelectedGroupIds, onRemoveFolder, onRemoveSection, onRemoveSections, pendingRemove]);

  return {
    pendingRemove,
    requestRemoveSection,
    requestRemoveFolder,
    requestRemoveGroup,
    closeRemoveConfirm,
    confirmRemove
  };
}
