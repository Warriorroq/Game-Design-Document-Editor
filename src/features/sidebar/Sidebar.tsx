import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useLocale } from "@/shared/context/LocaleContext";
import { useLinkContext } from "@/features/links/LinkContext";
import { restoreAppFocus } from "@/shared/lib/desktop";
import { buildSectionHref } from "@/features/links/lib/links";
import {
  childItems,
  type SectionDropPosition,
  type SidebarDropTarget,
} from "@/features/sidebar/lib/sidebarOrder";
import type { GddSection, GddSectionFolder } from "@/shared/types";
import { isSpace3DSection } from "@/domain/space3d/space3d";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";

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
  onRemoveFolder: (id: string) => void;
  onUpdateFolder: (id: string, patch: Partial<GddSectionFolder>) => void;
  onToggleFolder: (id: string) => void;
  onReorder: (
    drag: { kind: "section" | "folder"; id: string },
    target: SidebarDropTarget
  ) => void;
}

type DragPayload = { kind: "section" | "folder"; id: string };

type PendingRemove =
  | { kind: "section"; id: string; title: string }
  | { kind: "folder"; id: string; title: string };

function sectionHasContent(section: GddSection): boolean {
  if (isSpace3DSection(section)) {
    return (section.space3d?.objects.length ?? 0) > 0;
  }
  return section.content.trim().length > 40 || section.board.length > 0;
}

function dropPositionFromEvent(
  e: React.DragEvent<HTMLElement>
): SectionDropPosition {
  const rect = e.currentTarget.getBoundingClientRect();
  return e.clientY < rect.top + rect.height / 2 ? "before" : "after";
}

function folderDropPositionFromEvent(
  e: React.DragEvent<HTMLElement>
): SectionDropPosition | "inside" {
  const rect = e.currentTarget.getBoundingClientRect();
  const relativeY = e.clientY - rect.top;
  if (relativeY < rect.height * 0.25) return "before";
  if (relativeY > rect.height * 0.75) return "after";
  return "inside";
}

function parseDragPayload(raw: string): DragPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DragPayload;
    if (
      parsed &&
      (parsed.kind === "section" || parsed.kind === "folder") &&
      typeof parsed.id === "string"
    ) {
      return parsed;
    }
  } catch {
    if (raw.startsWith("section:")) {
      return { kind: "section", id: raw.slice("section:".length) };
    }
  }
  return null;
}

function SidebarCreateMenu({
  parentFolderId,
  onAddSection,
  onAddSpace3DSection,
  onAddFolder,
  onClose,
}: {
  parentFolderId: string | null;
  onAddSection: (folderId?: string) => void;
  onAddSpace3DSection: (folderId?: string) => void;
  onAddFolder: (parentFolderId?: string) => void;
  onClose: () => void;
}) {
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
      <button
        type="button"
        className="sidebar-create-menu-item"
        role="menuitem"
        onClick={pickSection}
      >
        {t("sidebar.createSection")}
      </button>
      <button
        type="button"
        className="sidebar-create-menu-item"
        role="menuitem"
        onClick={pickSpace3D}
      >
        {t("sidebar.createSpace3D")}
      </button>
      <button
        type="button"
        className="sidebar-create-menu-item"
        role="menuitem"
        onClick={pickFolder}
      >
        {t("sidebar.createFolder")}
      </button>
    </div>
  );
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
  onRemoveFolder,
  onUpdateFolder,
  onToggleFolder,
  onReorder,
}: SidebarProps) {
  const { t } = useLocale();
  const { openContextMenu } = useLinkContext();
  const createMenuRef = useRef<HTMLDivElement>(null);
  const [pendingRemove, setPendingRemove] = useState<PendingRemove | null>(null);
  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [dropTarget, setDropTarget] = useState<SidebarDropTarget | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [createMenuParent, setCreateMenuParent] = useState<string | null | false>(
    false
  );

  const docLike = { folders, sections };

  useEffect(() => {
    if (createMenuParent === false) return;

    const onPointer = (e: PointerEvent) => {
      if (createMenuRef.current?.contains(e.target as Node)) return;
      setCreateMenuParent(false);
    };

    window.addEventListener("pointerdown", onPointer, true);
    return () => window.removeEventListener("pointerdown", onPointer, true);
  }, [createMenuParent]);

  const confirmRemove = () => {
    if (!pendingRemove) return;
    if (pendingRemove.kind === "section") onRemove(pendingRemove.id);
    else onRemoveFolder(pendingRemove.id);
    setPendingRemove(null);
    restoreAppFocus();
  };

  const clearDragState = useCallback(() => {
    setDragging(null);
    setDropTarget(null);
  }, []);

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLSpanElement>, payload: DragPayload) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("application/x-gdde-sidebar", JSON.stringify(payload));
      const item = e.currentTarget.closest(".sidebar-row");
      if (item instanceof HTMLElement) {
        e.dataTransfer.setDragImage(item, 16, 16);
      }
      setDragging(payload);
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLElement>, target: SidebarDropTarget) => {
      e.preventDefault();
      const payload = parseDragPayload(
        e.dataTransfer.getData("application/x-gdde-sidebar")
      );
      if (payload) onReorder(payload, target);
      clearDragState();
    },
    [clearDragState, onReorder]
  );

  const startRenameFolder = (folder: GddSectionFolder) => {
    setRenamingFolderId(folder.id);
    setRenameValue(folder.title);
  };

  const commitRenameFolder = (folderId: string) => {
    const title = renameValue.trim();
    if (title) onUpdateFolder(folderId, { title });
    setRenamingFolderId(null);
    setRenameValue("");
    restoreAppFocus();
  };

  const cancelRenameFolder = () => {
    setRenamingFolderId(null);
    setRenameValue("");
  };

  const onRenameKeyDown = (
    e: KeyboardEvent<HTMLInputElement>,
    folderId: string
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRenameFolder(folderId);
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelRenameFolder();
    }
  };

  const toggleCreateMenu = (parentFolderId: string | null) => {
    setCreateMenuParent((current) =>
      current === false
        ? parentFolderId
        : current === parentFolderId
          ? false
          : parentFolderId
    );
  };

  const renderCreateButton = (parentFolderId: string | null, compact = false) => {
    const open =
      createMenuParent !== false && createMenuParent === parentFolderId;

    return (
      <div
        className={`sidebar-create-wrap ${compact ? "sidebar-create-wrap--compact" : ""}`}
        ref={open ? createMenuRef : undefined}
      >
        <button
          type="button"
          className={compact ? "folder-add-section" : "btn btn-icon"}
          onClick={() => toggleCreateMenu(parentFolderId)}
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
            onClose={() => setCreateMenuParent(false)}
          />
        )}
      </div>
    );
  };

  const renderSectionRow = (section: GddSection, depth: number) => {
    const filled = sectionHasContent(section);
    const active = section.id === activeId;
    const space3d = isSpace3DSection(section);
    const isDragging = dragging?.kind === "section" && dragging.id === section.id;
    const dropBefore =
      dropTarget?.kind === "section" &&
      dropTarget.id === section.id &&
      dropTarget.position === "before";
    const dropAfter =
      dropTarget?.kind === "section" &&
      dropTarget.id === section.id &&
      dropTarget.position === "after";

    return (
      <div
        key={section.id}
        className={[
          "sidebar-row",
          "section-item",
          space3d ? "section-item--space3d" : "",
          depth > 0 ? "section-item--nested" : "",
          active ? "active" : "",
          isDragging ? "section-item--dragging" : "",
          dropBefore ? "section-item--drop-before" : "",
          dropAfter ? "section-item--drop-after" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ ["--sidebar-depth" as string]: depth }}
        onContextMenu={(e) => {
          e.preventDefault();
          openContextMenu({
            x: e.clientX,
            y: e.clientY,
            copyHref: buildSectionHref(section.id),
          });
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          if (dragging?.kind === "section" && dragging.id === section.id) {
            setDropTarget(null);
            return;
          }
          setDropTarget({
            kind: "section",
            id: section.id,
            position: dropPositionFromEvent(e),
          });
        }}
        onDrop={(e) =>
          handleDrop(e, {
            kind: "section",
            id: section.id,
            position: dropPositionFromEvent(e),
          })
        }
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
          setDropTarget((current) =>
            current?.kind === "section" && current.id === section.id
              ? null
              : current
          );
        }}
      >
        <span
          className="section-drag-handle"
          draggable
          role="button"
          tabIndex={-1}
          aria-label={t("sidebar.reorderSection", { title: section.title })}
          title={t("sidebar.reorderSection", { title: section.title })}
          onDragStart={(e) =>
            handleDragStart(e, { kind: "section", id: section.id })
          }
          onDragEnd={clearDragState}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="section-drag-grip" aria-hidden />
        </span>
        <button
          type="button"
          className="section-link"
          onClick={() => onSelect(section.id)}
        >
          <span className={`section-dot ${filled ? "filled" : ""}`} />
          <span className="section-link-text">
            <span className="section-name">{section.title}</span>
            {section.description && (
              <span className="section-desc">{section.description}</span>
            )}
          </span>
          {space3d && (
            <span className="section-kind-badge" title={t("sidebar.space3dBadge")}>
              {t("sidebar.space3dBadgeLabel")}
            </span>
          )}
          {!space3d && section.board.length > 0 && (
            <span className="section-image-count">{section.board.length}</span>
          )}
        </button>
        <button
          type="button"
          className="section-remove"
          onClick={() =>
            setPendingRemove({
              kind: "section",
              id: section.id,
              title: section.title,
            })
          }
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
    const dropTargetActive =
      dropTarget?.kind === "folder" && dropTarget.id === folder.id;
    const dropBefore = dropTargetActive && dropTarget.position === "before";
    const dropAfter = dropTargetActive && dropTarget.position === "after";
    const dropInside = dropTargetActive && dropTarget.position === "inside";
    const childCount = childItems(docLike, folder.id).length;
    const renaming = renamingFolderId === folder.id;

    return (
      <div
        key={folder.id}
        className="sidebar-folder-block"
        style={{ ["--sidebar-depth" as string]: depth }}
      >
        <div
          className={[
            "sidebar-row",
            "folder-item",
            depth > 0 ? "section-item--nested" : "",
            isDragging ? "section-item--dragging" : "",
            dropBefore ? "section-item--drop-before" : "",
            dropAfter ? "section-item--drop-after" : "",
            dropInside ? "folder-item--drop-inside" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (dragging?.kind === "folder" && dragging.id === folder.id) {
              setDropTarget(null);
              return;
            }
            setDropTarget({
              kind: "folder",
              id: folder.id,
              position: folderDropPositionFromEvent(e),
            });
          }}
          onDrop={(e) =>
            handleDrop(e, {
              kind: "folder",
              id: folder.id,
              position: folderDropPositionFromEvent(e),
            })
          }
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
            setDropTarget((current) =>
              current?.kind === "folder" && current.id === folder.id
                ? null
                : current
            );
          }}
        >
          <span
            className="section-drag-handle"
            draggable
            role="button"
            tabIndex={-1}
            aria-label={t("sidebar.reorderFolder", { title: folder.title })}
            title={t("sidebar.reorderFolder", { title: folder.title })}
            onDragStart={(e) =>
              handleDragStart(e, { kind: "folder", id: folder.id })
            }
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
            <span
              className={`folder-chevron ${folder.collapsed ? "folder-chevron--collapsed" : ""}`}
              aria-hidden
            />
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
            onClick={() =>
              setPendingRemove({
                kind: "folder",
                id: folder.id,
                title: folder.title,
              })
            }
            title={t("sidebar.removeFolder")}
            aria-label={`${t("sidebar.removeFolder")} ${folder.title}`}
          >
            ×
          </button>
        </div>
        {!folder.collapsed &&
          childItems(docLike, folder.id).map((entry) =>
            entry.kind === "folder"
              ? renderFolderBlock(entry.item, depth + 1)
              : renderSectionRow(entry.item, depth + 1)
          )}
      </div>
    );
  };

  return (
    <>
      <aside className={`sidebar ${hidden ? "sidebar--hidden" : ""}`} aria-hidden={hidden}>
        <div className="sidebar-header">
          <h2>{t("sidebar.sections")}</h2>
          <div className="sidebar-header-actions">
            {renderCreateButton(null)}
          </div>
        </div>
        <nav className="section-list" aria-label={t("sidebar.sectionsAria")}>
          {childItems(docLike, null).map((entry) =>
            entry.kind === "folder"
              ? renderFolderBlock(entry.item, 0)
              : renderSectionRow(entry.item, 0)
          )}
        </nav>
      </aside>

      <ConfirmDialog
        open={pendingRemove !== null}
        title={
          pendingRemove?.kind === "folder"
            ? t("sidebar.removeFolder")
            : t("sidebar.removeSection")
        }
        message={
          pendingRemove
            ? pendingRemove.kind === "folder"
              ? t("sidebar.confirmRemoveFolder", { title: pendingRemove.title })
              : t("sidebar.confirmRemove", { title: pendingRemove.title })
            : ""
        }
        confirmLabel={
          pendingRemove?.kind === "folder"
            ? t("sidebar.removeFolder")
            : t("sidebar.removeSection")
        }
        onClose={() => setPendingRemove(null)}
        onConfirm={confirmRemove}
      />
    </>
  );
}
