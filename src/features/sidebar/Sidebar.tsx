import { useMemo, useRef } from "react";

import { useLinkContext } from "@/features/links/LinkContext";
import { SidebarCreateButton } from "@/features/sidebar/components/SidebarCreateButton";
import { SidebarRemoveDialog } from "@/features/sidebar/components/SidebarRemoveDialog";
import { SidebarTree } from "@/features/sidebar/components/SidebarTree";
import { SidebarInteractionProvider } from "@/features/sidebar/context/SidebarInteractionProvider";
import { useCreateMenu } from "@/features/sidebar/hooks/useCreateMenu";
import { useFolderRename } from "@/features/sidebar/hooks/useFolderRename";
import { useSidebarDragDrop } from "@/features/sidebar/hooks/useSidebarDragDrop";
import { useSidebarGroupSelection } from "@/features/sidebar/hooks/useSidebarGroupSelection";
import { useSidebarRemoveConfirm } from "@/features/sidebar/hooks/useSidebarRemoveConfirm";
import type { SidebarInteraction } from "@/features/sidebar/lib/sidebarInteractionTypes";
import type { SidebarDropTarget } from "@/features/sidebar/lib/sidebarOrder";
import { useLocale } from "@/shared/context/LocaleContext";
import type { GddSection, GddSectionFolder } from "@/shared/types";

interface SidebarProps {
  hidden: boolean;
  folders: GddSectionFolder[];
  sections: GddSection[];
  activeId: string;
  onSelect: (id: string) => void;
  onAddSection: (folderId?: string) => void;
  onAddSpace3DSection: (folderId?: string) => void;
  onAddFolder: (parentFolderId?: string) => void;
  onRemove: (id: string) => void;
  onRemoveSections: (ids: string[]) => void;
  onMoveSectionsToFolder: (ids: string[], folderId: string | null) => void;
  onRemoveFolder: (id: string) => void;
  onUpdateFolder: (id: string, patch: Partial<GddSectionFolder>) => void;
  onToggleFolder: (id: string) => void;
  onReorder: (drag: { kind: "section" | "folder"; id: string }, target: SidebarDropTarget) => void;
}

export function Sidebar({
  hidden,
  folders,
  sections,
  activeId,
  onSelect,
  onAddSection,
  onAddSpace3DSection,
  onAddFolder,
  onRemove,
  onRemoveSections,
  onMoveSectionsToFolder,
  onRemoveFolder,
  onUpdateFolder,
  onToggleFolder,
  onReorder
}: SidebarProps) {
  const { t } = useLocale();
  const { openContextMenu } = useLinkContext();
  const selectedGroupIdsRef = useRef<string[]>([]);
  const clearGroupSelectionRef = useRef<() => void>(() => {});

  const {
    pendingRemove,
    requestRemoveSection,
    requestRemoveFolder,
    requestRemoveGroup,
    closeRemoveConfirm,
    confirmRemove
  } = useSidebarRemoveConfirm({
    onRemoveSection: onRemove,
    onRemoveFolder,
    onRemoveSections,
    getSelectedGroupIds: () => selectedGroupIdsRef.current,
    clearGroupSelection: () => clearGroupSelectionRef.current()
  });

  const groupSelection = useSidebarGroupSelection({
    hidden,
    folders,
    sections,
    activeId,
    onRequestRemoveGroup: requestRemoveGroup
  });

  selectedGroupIdsRef.current = groupSelection.selectedGroupIds;
  clearGroupSelectionRef.current = groupSelection.clearGroupSelection;

  const dragDrop = useSidebarDragDrop({ onReorder, onMoveSectionsToFolder });
  const folderRename = useFolderRename({ onUpdateFolder });
  const { menuRef, toggleCreateMenu, closeCreateMenu, isCreateMenuOpen } = useCreateMenu();

  const docLike = useMemo(() => ({ folders, sections }), [folders, sections]);

  const interaction = useMemo((): SidebarInteraction => {
    const renderCreateButton = (parentFolderId: string | null, compact = false) => (
      <SidebarCreateButton
        parentFolderId={parentFolderId}
        compact={compact}
        open={isCreateMenuOpen(parentFolderId)}
        menuRef={menuRef}
        onToggle={toggleCreateMenu}
        onClose={closeCreateMenu}
        onAddSection={onAddSection}
        onAddSpace3DSection={onAddSpace3DSection}
        onAddFolder={onAddFolder}
      />
    );

    return {
      activeId,
      docLike,
      onSelect,
      onToggleFolder,
      requestRemoveSection,
      requestRemoveFolder,
      openContextMenu,
      selectedGroupIds: groupSelection.selectedGroupIds,
      selectedGroupSet: groupSelection.selectedGroupSet,
      hasGroupSelection: groupSelection.hasGroupSelection,
      selectionAnchorRef: groupSelection.selectionAnchorRef,
      toggleGroupSection: groupSelection.toggleGroupSection,
      selectSectionRange: groupSelection.selectSectionRange,
      buildGroupActions: groupSelection.buildGroupActions,
      dragging: dragDrop.dragging,
      dropTarget: dragDrop.dropTarget,
      groupDropTarget: dragDrop.groupDropTarget,
      draggingGroup: dragDrop.draggingGroup,
      setDropTarget: dragDrop.setDropTarget,
      setGroupDropTarget: dragDrop.setGroupDropTarget,
      clearDragState: dragDrop.clearDragState,
      handleDragStart: dragDrop.handleDragStart,
      handleGroupDragStart: dragDrop.handleGroupDragStart,
      handleDrop: dragDrop.handleDrop,
      handleGroupDropFromEvent: dragDrop.handleGroupDropFromEvent,
      renamingFolderId: folderRename.renamingFolderId,
      renameValue: folderRename.renameValue,
      setRenameValue: folderRename.setRenameValue,
      startRenameFolder: folderRename.startRenameFolder,
      commitRenameFolder: folderRename.commitRenameFolder,
      onRenameKeyDown: folderRename.onRenameKeyDown,
      renderCreateButton
    };
  }, [
    activeId,
    docLike,
    onSelect,
    onToggleFolder,
    requestRemoveSection,
    requestRemoveFolder,
    openContextMenu,
    groupSelection,
    dragDrop,
    folderRename,
    isCreateMenuOpen,
    menuRef,
    toggleCreateMenu,
    closeCreateMenu,
    onAddSection,
    onAddSpace3DSection,
    onAddFolder
  ]);

  return (
    <>
      <aside className={`sidebar ${hidden ? "sidebar--hidden" : ""}`} aria-hidden={hidden}>
        <SidebarInteractionProvider value={interaction}>
          <div className="sidebar-header">
            <h2>{t("sidebar.sections")}</h2>
            <div className="sidebar-header-actions">{interaction.renderCreateButton(null)}</div>
          </div>
          <SidebarTree />
        </SidebarInteractionProvider>
      </aside>

      <SidebarRemoveDialog pendingRemove={pendingRemove} onClose={closeRemoveConfirm} onConfirm={confirmRemove} />
    </>
  );
}
