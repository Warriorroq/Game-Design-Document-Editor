import { SidebarSectionRow } from "@/features/sidebar/components/SidebarSectionRow";
import { useSidebarInteraction } from "@/features/sidebar/hooks/useSidebarInteraction";
import { folderDropPositionFromEvent } from "@/features/sidebar/lib/sidebarDrag";
import { childItems } from "@/features/sidebar/lib/sidebarOrder";
import { useLocale } from "@/shared/context/LocaleContext";
import type { GddSectionFolder } from "@/shared/types";

interface SidebarFolderBlockProps {
  folder: GddSectionFolder;
  depth: number;
}

export function SidebarFolderBlock({ folder, depth }: SidebarFolderBlockProps) {
  const { t } = useLocale();
  const {
    docLike,
    onToggleFolder,
    requestRemoveFolder,
    openContextMenu,
    hasGroupSelection,
    buildGroupActions,
    dragging,
    dropTarget,
    groupDropTarget,
    draggingGroup,
    setDropTarget,
    setGroupDropTarget,
    clearDragState,
    handleDragStart,
    handleDrop,
    handleGroupDropFromEvent,
    renamingFolderId,
    renameValue,
    setRenameValue,
    startRenameFolder,
    commitRenameFolder,
    onRenameKeyDown,
    renderCreateButton
  } = useSidebarInteraction();

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
    <div className="sidebar-folder-block" style={{ ["--sidebar-depth" as string]: depth }}>
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
          entry.kind === "folder" ? (
            <SidebarFolderBlock key={entry.item.id} folder={entry.item} depth={depth + 1} />
          ) : (
            <SidebarSectionRow key={entry.item.id} section={entry.item} depth={depth + 1} />
          )
        )}
    </div>
  );
}
