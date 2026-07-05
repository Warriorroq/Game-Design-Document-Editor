import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  buildShiftGroupSelection,
  getOpenSectionGroupSelectMode,
  includesOpenSectionOnGroupSelectStart,
  withOpenSectionOnGroupSelectStart
} from "@/domain/sidebar/sidebarSettings";
import { isSpace3DSection } from "@/domain/space3d/space3d";
import { buildSectionHref } from "@/features/links/lib/links";
import { type ContextMenuAction, useLinkContext } from "@/features/links/LinkContext";
import {
  childItems,
  type SectionDropPosition,
  type SidebarDropTarget,
  visibleSectionIdsInOrder
} from "@/features/sidebar/lib/sidebarOrder";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { useLocale } from "@/shared/context/LocaleContext";
import { useShortcuts } from "@/shared/context/ShortcutsContext";
import { restoreAppFocus } from "@/shared/lib/desktop";
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

type DragPayload = { kind: "section" | "folder"; id: string } | { kind: "group"; sectionIds: string[] };

type GroupDropTarget = { kind: "folder"; folderId: string } | { kind: "root" };

type PendingRemove =
  | { kind: "section"; id: string; title: string }
  | { kind: "folder"; id: string; title: string }
  | { kind: "group"; count: number };

function sectionHasContent(section: GddSection): boolean {
  if (isSpace3DSection(section)) {
    return (section.space3d?.objects.length ?? 0) > 0;
  }
  return section.content.trim().length > 40 || section.board.length > 0;
}

function dropPositionFromEvent(e: React.DragEvent<HTMLElement>): SectionDropPosition {
  const rect = e.currentTarget.getBoundingClientRect();
  return e.clientY < rect.top + rect.height / 2 ? "before" : "after";
}

function folderDropPositionFromEvent(e: React.DragEvent<HTMLElement>): SectionDropPosition | "inside" {
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
    if (parsed?.kind === "group" && Array.isArray(parsed.sectionIds) && parsed.sectionIds.length > 0) {
      return { kind: "group", sectionIds: parsed.sectionIds };
    }
    if (parsed && (parsed.kind === "section" || parsed.kind === "folder") && typeof parsed.id === "string") {
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
  onClose
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
  const { matches: shortcutMatches } = useShortcuts();
  const { openContextMenu } = useLinkContext();
  const createMenuRef = useRef<HTMLDivElement>(null);
  const selectionAnchorRef = useRef<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<PendingRemove | null>(null);
  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [dropTarget, setDropTarget] = useState<SidebarDropTarget | null>(null);
  const [groupDropTarget, setGroupDropTarget] = useState<GroupDropTarget | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [createMenuParent, setCreateMenuParent] = useState<string | null | false>(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  const docLike = { folders, sections };
  const selectedGroupSet = useMemo(() => new Set(selectedGroupIds), [selectedGroupIds]);
  const hasGroupSelection = selectedGroupIds.length > 0;
  const visibleSectionIds = useMemo(() => visibleSectionIdsInOrder({ folders, sections }), [folders, sections]);
  const draggingGroup = dragging?.kind === "group";

  const clearGroupSelection = useCallback(() => {
    setSelectedGroupIds([]);
  }, []);

  const toggleGroupSection = useCallback(
    (sectionId: string) => {
      setSelectedGroupIds((current) => {
        if (current.length === 0) {
          const mode = getOpenSectionGroupSelectMode();
          return withOpenSectionOnGroupSelectStart(
            [sectionId],
            activeId,
            includesOpenSectionOnGroupSelectStart(mode, "ctrl")
          );
        }
        return current.includes(sectionId) ? current.filter((id) => id !== sectionId) : [...current, sectionId];
      });
    },
    [activeId]
  );

  const selectSectionRange = useCallback(
    (toId: string, additive: boolean) => {
      const mode = getOpenSectionGroupSelectMode();
      const rangeIds = buildShiftGroupSelection(visibleSectionIds, toId, activeId, selectionAnchorRef.current, mode);
      if (rangeIds.length === 0) return;
      const includeOpenOnShift = includesOpenSectionOnGroupSelectStart(mode, "shift");
      setSelectedGroupIds((current) => {
        const next = additive ? [...new Set([...current, ...rangeIds])] : rangeIds;
        return current.length === 0 ? withOpenSectionOnGroupSelectStart(next, activeId, includeOpenOnShift) : next;
      });
    },
    [activeId, visibleSectionIds]
  );

  useEffect(() => {
    setSelectedGroupIds((current) => current.filter((id) => sections.some((section) => section.id === id)));
  }, [sections]);

  useEffect(() => {
    if (hidden || !hasGroupSelection) return;

    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!shortcutMatches("sidebar.exitGroupSelect", e)) return;
      e.preventDefault();
      clearGroupSelection();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearGroupSelection, hasGroupSelection, hidden, shortcutMatches]);

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
    else if (pendingRemove.kind === "folder") onRemoveFolder(pendingRemove.id);
    else {
      onRemoveSections(selectedGroupIds);
      clearGroupSelection();
    }
    setPendingRemove(null);
    restoreAppFocus();
  };

  const buildGroupActions = useCallback((): ContextMenuAction[] => {
    if (!hasGroupSelection) return [];

    return [
      {
        id: "remove-group-sections",
        label: t("sidebar.deleteGroupSections"),
        onClick: () => setPendingRemove({ kind: "group", count: selectedGroupIds.length })
      },
      {
        id: "exit-group-select",
        label: t("sidebar.exitGroupSelect"),
        onClick: clearGroupSelection
      }
    ];
  }, [clearGroupSelection, hasGroupSelection, selectedGroupIds.length, t]);

  const clearDragState = useCallback(() => {
    setDragging(null);
    setDropTarget(null);
    setGroupDropTarget(null);
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent<HTMLSpanElement>, payload: DragPayload) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/x-gdde-sidebar", JSON.stringify(payload));
    const item = e.currentTarget.closest(".sidebar-row");
    if (item instanceof HTMLElement) {
      e.dataTransfer.setDragImage(item, 16, 16);
    }
    setDragging(payload);
    setGroupDropTarget(null);
  }, []);

  const handleGroupDragStart = useCallback(
    (e: React.DragEvent<HTMLSpanElement>, sectionIds: string[]) => {
      handleDragStart(e, { kind: "group", sectionIds });
    },
    [handleDragStart]
  );

  const handleGroupDrop = useCallback(
    (target: GroupDropTarget, sectionIds: string[]) => {
      onMoveSectionsToFolder(sectionIds, target.kind === "root" ? null : target.folderId);
      clearDragState();
      restoreAppFocus();
    },
    [clearDragState, onMoveSectionsToFolder]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLElement>, target: SidebarDropTarget) => {
      e.preventDefault();
      const payload = parseDragPayload(e.dataTransfer.getData("application/x-gdde-sidebar"));
      if (!payload) {
        clearDragState();
        return;
      }
      if (payload.kind === "group") {
        if (target.kind === "folder" && target.position === "inside") {
          handleGroupDrop({ kind: "folder", folderId: target.id }, payload.sectionIds);
        } else {
          clearDragState();
        }
        return;
      }
      onReorder(payload, target);
      clearDragState();
    },
    [clearDragState, handleGroupDrop, onReorder]
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

  const onRenameKeyDown = (e: KeyboardEvent<HTMLInputElement>, folderId: string) => {
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
      current === false ? parentFolderId : current === parentFolderId ? false : parentFolderId
    );
  };

  const renderCreateButton = (parentFolderId: string | null, compact = false) => {
    const open = createMenuParent !== false && createMenuParent === parentFolderId;

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
          onClick={() =>
            setPendingRemove({
              kind: "section",
              id: section.id,
              title: section.title
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
              e.preventDefault();
              const payload = parseDragPayload(e.dataTransfer.getData("application/x-gdde-sidebar"));
              if (payload?.kind === "group") {
                handleGroupDrop({ kind: "folder", folderId: folder.id }, payload.sectionIds);
              } else {
                clearDragState();
              }
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
            onClick={() =>
              setPendingRemove({
                kind: "folder",
                id: folder.id,
                title: folder.title
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
            e.preventDefault();
            const payload = parseDragPayload(e.dataTransfer.getData("application/x-gdde-sidebar"));
            if (payload?.kind === "group") {
              handleGroupDrop({ kind: "root" }, payload.sectionIds);
            } else {
              clearDragState();
            }
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
        onClose={() => setPendingRemove(null)}
        onConfirm={confirmRemove}
      />
    </>
  );
}
