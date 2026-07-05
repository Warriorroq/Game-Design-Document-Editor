import { isSpace3DSection } from "@/domain/space3d/space3d";
import { buildSectionHref } from "@/features/links/lib/links";
import type { ContextMenuAction } from "@/features/links/LinkContext";
import { useSidebarInteraction } from "@/features/sidebar/hooks/useSidebarInteraction";
import { sectionHasContent } from "@/features/sidebar/lib/sectionMeta";
import { dropPositionFromEvent } from "@/features/sidebar/lib/sidebarDrag";
import { useLocale } from "@/shared/context/LocaleContext";
import type { GddSection } from "@/shared/types";

interface SidebarSectionRowProps {
  section: GddSection;
  depth: number;
}

export function SidebarSectionRow({ section, depth }: SidebarSectionRowProps) {
  const { t } = useLocale();
  const {
    activeId,
    onSelect,
    requestRemoveSection,
    openContextMenu,
    selectedGroupIds,
    selectedGroupSet,
    hasGroupSelection,
    selectionAnchorRef,
    toggleGroupSection,
    selectSectionRange,
    buildGroupActions,
    dragging,
    dropTarget,
    draggingGroup,
    setDropTarget,
    clearDragState,
    handleDragStart,
    handleGroupDragStart,
    handleDrop
  } = useSidebarInteraction();

  const filled = sectionHasContent(section);
  const active = section.id === activeId;
  const space3d = isSpace3DSection(section);
  const inGroup = selectedGroupSet.has(section.id);
  const isDragging = draggingGroup && inGroup ? true : dragging?.kind === "section" && dragging.id === section.id;
  const dropBefore = dropTarget?.kind === "section" && dropTarget.id === section.id && dropTarget.position === "before";
  const dropAfter = dropTarget?.kind === "section" && dropTarget.id === section.id && dropTarget.position === "after";

  const onContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
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
  };

  return (
    <div
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
      onContextMenu={onContextMenu}
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
}
