import { useRef } from "react";

import { isSpace3DSection } from "@/domain/space3d/space3d";
import { buildSectionHref } from "@/features/links/lib/links";
import { type ContextMenuAction, useLinkContext } from "@/features/links/LinkContext";
import { SidebarCreateButton } from "@/features/sidebar/components/SidebarCreateButton";
import { SidebarRemoveDialog } from "@/features/sidebar/components/SidebarRemoveDialog";
import { useCreateMenu } from "@/features/sidebar/hooks/useCreateMenu";
import { useFolderRename } from "@/features/sidebar/hooks/useFolderRename";
import { useSidebarDragDrop } from "@/features/sidebar/hooks/useSidebarDragDrop";
import { useSidebarGroupSelection } from "@/features/sidebar/hooks/useSidebarGroupSelection";
import { useSidebarRemoveConfirm } from "@/features/sidebar/hooks/useSidebarRemoveConfirm";
import { sectionHasContent } from "@/features/sidebar/lib/sectionMeta";
import { dropPositionFromEvent, folderDropPositionFromEvent } from "@/features/sidebar/lib/sidebarDrag";
import { childItems, type SidebarDropTarget } from "@/features/sidebar/lib/sidebarOrder";
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

  const {
    selectedGroupIds,
    selectedGroupSet,
    hasGroupSelection,
    selectionAnchorRef,
    toggleGroupSection,
    selectSectionRange,
    buildGroupActions
  } = groupSelection;

  const dragDrop = useSidebarDragDrop({ onReorder, onMoveSectionsToFolder });
  const {
    dragging,
    dropTarget,
    groupDropTarget,
    draggingGroup,
    setDropTarget,
    setGroupDropTarget,
    clearDragState,
    handleDragStart,
    handleGroupDragStart,
    handleDrop,
    handleGroupDropFromEvent
  } = dragDrop;

  const folderRename = useFolderRename({ onUpdateFolder });
  const { renamingFolderId, renameValue, setRenameValue, startRenameFolder, commitRenameFolder, onRenameKeyDown } =
    folderRename;

  const { menuRef, toggleCreateMenu, closeCreateMenu, isCreateMenuOpen } = useCreateMenu();

  const docLike = { folders, sections };

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

  const renderSectionRow = (section: GddSection, depth: number) => {
    const filled = sectionHasContent(section);
    const active = section.id === activeId;
    const space3d = isSpace3DSection(section);
    const inGroup = selectedGroupSet.has(section.id);
    const isDragging = draggingGroup && inGroup ? true : dragging?.kind === "section" && dragging.id === section.id;
    const dropBefore =
      dropTarget?.kind === "section" && dropTarget.id === section.id && dropTarget.position === "before";
    const dropAfter = dropTarget?.kind === "section" && dropTarget.id === section.id && dropTarget.position === "after";

    return (
      <div
        key={section.id}
        className={[
          "sidebar-row",
          "section-item",
          space3d ? "section-item--space3d" : "",
          depth > 0 ? "section-item--nested" : "",
          active ? "active" : "",
          hasGroupSelection && inGroup ? "section-item--group-selected" : "",
          isDragging ? "section-item--dragging" : "",
          dropBefore ? "section-item--drop-before" : "",
          dropAfter ? "section-item--drop-after" : ""
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ ["--sidebar-depth" as string]: depth }}
        onContextMenu={(e) => {
          e.preventDefault();
          const actions: ContextMenuAction[] = [];

          if (hasGroupSelection) {
            actions.push({
              id: "toggle-group-section",
              label: inGroup ? t("sidebar.removeFromGroup") : t("sidebar.addToGroup"),
              onClick: () => {
                toggleGroupSection(section.id);
                selectionAnchorRef.current = section.id;
              }
            });
            actions.push(...buildGroupActions());
          } else {
            actions.push({
              id: "select-group",
              label: t("sidebar.selectGroup"),
              onClick: () => {
                toggleGroupSection(section.id);
                selectionAnchorRef.current = section.id;
              }
            });
          }

          openContextMenu({
            x: e.clientX,
            y: e.clientY,
            copyHref: buildSectionHref(section.id),
            actions
          });
        }}
        onDragOver={(e) => {
          if (draggingGroup) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          if (dragging?.kind === "section" && dragging.id === section.id) {
            setDropTarget(null);
            return;
          }
          setDropTarget({
            kind: "section",
            id: section.id,
            position: dropPositionFromEvent(e)
          });
        }}
        onDrop={(e) =>
          handleDrop(e, {
            kind: "section",
            id: section.id,
            position: dropPositionFromEvent(e)
          })
        }
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
          setDropTarget((current) => (current?.kind === "section" && current.id === section.id ? null : current));
        }}
      >
        <span
          className="section-drag-handle"
          draggable
          role="button"
          tabIndex={-1}
          aria-label={
            hasGroupSelection && inGroup
              ? t("sidebar.dragGroup", { count: selectedGroupIds.length })
              : t("sidebar.reorderSection", { title: section.title })
          }
          title={
            hasGroupSelection && inGroup
              ? t("sidebar.dragGroup", { count: selectedGroupIds.length })
              : t("sidebar.reorderSection", { title: section.title })
          }
          onDragStart={(e) => {
            if (hasGroupSelection && inGroup) {
              handleGroupDragStart(e, selectedGroupIds);
              return;
            }
            handleDragStart(e, { kind: "section", id: section.id });
          }}
          onDragEnd={clearDragState}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="section-drag-grip" aria-hidden />
        </span>
        <button
          type="button"
          className="section-link"
          onClick={(e) => {
            if (e.shiftKey) {
              selectSectionRange(section.id, e.ctrlKey || e.metaKey);
              return;
            }
            if (e.ctrlKey || e.metaKey) {
              toggleGroupSection(section.id);
              selectionAnchorRef.current = section.id;
              return;
            }
            selectionAnchorRef.current = section.id;
            onSelect(section.id);
          }}
        >
          <span className={`section-dot ${filled ? "filled" : ""}`} />
          <span className="section-link-text">
            <span className="section-name">{section.title}</span>
            {section.description && <span className="section-desc">{section.description}</span>}
          </span>
          {space3d && (
            <span className="section-kind-badge" title={t("sidebar.space3dBadge")}>
              {t("sidebar.space3dBadgeLabel")}
            </span>
          )}
          {!space3d && section.board.length > 0 && <span className="section-image-count">{section.board.length}</span>}
        </button>
        <button
          type="button"
          className="section-remove"
          onClick={() => requestRemoveSection(section.id, section.title)}
          title={t("sidebar.removeSection")}
          aria-label={`${t("sidebar.removeSection")} ${section.title}`}
        >
          ×
        </button>
      </div>
    );
  };

  const renderFolderBlock = (folder: GddSectionFolder, depth: number) => {
    const isDragging = dragging?.kind === "folder" && dragging.id === folder.id;
    const dropTargetActive = dropTarget?.kind === "folder" && dropTarget.id === folder.id;
    const dropBefore = !draggingGroup && dropTargetActive && dropTarget.position === "before";
    const dropAfter = !draggingGroup && dropTargetActive && dropTarget.position === "after";
    const dropInside =
      (draggingGroup && groupDropTarget?.kind === "folder" && groupDropTarget.folderId === folder.id) ||
      (dropTargetActive && dropTarget.position === "inside");
    const childCount = childItems(docLike, folder.id).length;
    const renaming = renamingFolderId === folder.id;

    return (
      <div key={folder.id} className="sidebar-folder-block" style={{ ["--sidebar-depth" as string]: depth }}>
        <div
          className={[
            "sidebar-row",
            "folder-item",
            depth > 0 ? "section-item--nested" : "",
            isDragging ? "section-item--dragging" : "",
            dropBefore ? "section-item--drop-before" : "",
            dropAfter ? "section-item--drop-after" : "",
            dropInside ? "folder-item--drop-inside" : ""
          ]
            .filter(Boolean)
            .join(" ")}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (draggingGroup) {
              setDropTarget(null);
              setGroupDropTarget({ kind: "folder", folderId: folder.id });
              return;
            }
            if (dragging?.kind === "folder" && dragging.id === folder.id) {
              setDropTarget(null);
              return;
            }
            setGroupDropTarget(null);
            setDropTarget({
              kind: "folder",
              id: folder.id,
              position: folderDropPositionFromEvent(e)
            });
          }}
          onDrop={(e) => {
            if (draggingGroup) {
              handleGroupDropFromEvent(e, { kind: "folder", folderId: folder.id });
              return;
            }
            handleDrop(e, {
              kind: "folder",
              id: folder.id,
              position: folderDropPositionFromEvent(e)
            });
          }}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
            setDropTarget((current) => (current?.kind === "folder" && current.id === folder.id ? null : current));
            setGroupDropTarget((current) =>
              current?.kind === "folder" && current.folderId === folder.id ? null : current
            );
          }}
          onContextMenu={(e) => {
            if (!hasGroupSelection) return;
            e.preventDefault();
            openContextMenu({
              x: e.clientX,
              y: e.clientY,
              actions: buildGroupActions()
            });
          }}
        >
          <span
            className="section-drag-handle"
            draggable
            role="button"
            tabIndex={-1}
            aria-label={t("sidebar.reorderFolder", { title: folder.title })}
            title={t("sidebar.reorderFolder", { title: folder.title })}
            onDragStart={(e) => handleDragStart(e, { kind: "folder", id: folder.id })}
            onDragEnd={clearDragState}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="section-drag-grip" aria-hidden />
          </span>
          <button
            type="button"
            className="folder-toggle"
            onClick={() => onToggleFolder(folder.id)}
            aria-expanded={!folder.collapsed}
            title={t("sidebar.toggleFolder")}
          >
            <span className={`folder-chevron ${folder.collapsed ? "folder-chevron--collapsed" : ""}`} aria-hidden />
          </button>
          {renaming ? (
            <input
              className="folder-rename-input"
              value={renameValue}
              autoFocus
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => commitRenameFolder(folder.id)}
              onKeyDown={(e) => onRenameKeyDown(e, folder.id)}
              aria-label={t("sidebar.renameFolder")}
            />
          ) : (
            <button
              type="button"
              className="folder-link"
              onClick={() => onToggleFolder(folder.id)}
              onDoubleClick={() => startRenameFolder(folder)}
              title={t("sidebar.renameFolderHint")}
            >
              <span className="folder-name">{folder.title}</span>
              <span className="folder-count">{childCount}</span>
            </button>
          )}
          {renderCreateButton(folder.id, true)}
          <button
            type="button"
            className="section-remove"
            onClick={() => requestRemoveFolder(folder.id, folder.title)}
            title={t("sidebar.removeFolder")}
            aria-label={`${t("sidebar.removeFolder")} ${folder.title}`}
          >
            ×
          </button>
        </div>
        {!folder.collapsed &&
          childItems(docLike, folder.id).map((entry) =>
            entry.kind === "folder" ? renderFolderBlock(entry.item, depth + 1) : renderSectionRow(entry.item, depth + 1)
          )}
      </div>
    );
  };

  return (
    <>
      <aside className={`sidebar ${hidden ? "sidebar--hidden" : ""}`} aria-hidden={hidden}>
        <div className="sidebar-header">
          <h2>{t("sidebar.sections")}</h2>
          <div className="sidebar-header-actions">{renderCreateButton(null)}</div>
        </div>
        <nav
          className={[
            "section-list",
            draggingGroup && groupDropTarget?.kind === "root" ? "section-list--group-drop-target" : ""
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label={t("sidebar.sectionsAria")}
          onDragOver={(e) => {
            if (!draggingGroup) return;
            if ((e.target as HTMLElement).closest(".sidebar-row")) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setDropTarget(null);
            setGroupDropTarget({ kind: "root" });
          }}
          onDrop={(e) => {
            if (!draggingGroup) return;
            if ((e.target as HTMLElement).closest(".sidebar-row")) return;
            handleGroupDropFromEvent(e, { kind: "root" });
          }}
          onDragLeave={(e) => {
            if (!draggingGroup) return;
            if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
            setGroupDropTarget((current) => (current?.kind === "root" ? null : current));
          }}
          onContextMenu={(e) => {
            if (!hasGroupSelection) return;
            if ((e.target as HTMLElement).closest(".sidebar-row")) return;
            e.preventDefault();
            openContextMenu({
              x: e.clientX,
              y: e.clientY,
              actions: buildGroupActions()
            });
          }}
        >
          {childItems(docLike, null).map((entry) =>
            entry.kind === "folder" ? renderFolderBlock(entry.item, 0) : renderSectionRow(entry.item, 0)
          )}
        </nav>
      </aside>

      <SidebarRemoveDialog pendingRemove={pendingRemove} onClose={closeRemoveConfirm} onConfirm={confirmRemove} />
    </>
  );
}
