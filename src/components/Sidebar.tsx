import { useCallback, useState } from "react";
import { useLocale } from "../context/LocaleContext";
import { useLinkContext } from "../context/LinkContext";
import { restoreAppFocus } from "../lib/desktop";
import { buildSectionHref } from "../lib/links";
import type { SectionDropPosition } from "../lib/sectionOrder";
import type { GddSection } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";

interface SidebarProps {
  hidden: boolean;
  sections: GddSection[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onReorder: (activeId: string, overId: string, position: SectionDropPosition) => void;
}

function sectionHasContent(section: GddSection): boolean {
  return section.content.trim().length > 40 || section.board.length > 0;
}

function dropPositionFromEvent(
  e: React.DragEvent<HTMLElement>
): SectionDropPosition {
  const rect = e.currentTarget.getBoundingClientRect();
  return e.clientY < rect.top + rect.height / 2 ? "before" : "after";
}

export function Sidebar({
  hidden,
  sections,
  activeId,
  onSelect,
  onAdd,
  onRemove,
  onReorder,
}: SidebarProps) {
  const { t } = useLocale();
  const { openContextMenu } = useLinkContext();
  const [pendingRemove, setPendingRemove] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    position: SectionDropPosition;
  } | null>(null);
  const sorted = [...sections].sort((a, b) => a.order - b.order);

  const handleAdd = () => {
    onAdd();
    restoreAppFocus();
  };

  const confirmRemove = () => {
    if (!pendingRemove) return;
    onRemove(pendingRemove.id);
    setPendingRemove(null);
    restoreAppFocus();
  };

  const clearDragState = useCallback(() => {
    setDraggingId(null);
    setDropTarget(null);
  }, []);

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLSpanElement>, sectionId: string) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", sectionId);
      const item = e.currentTarget.closest(".section-item");
      if (item instanceof HTMLElement) {
        e.dataTransfer.setDragImage(item, 16, 16);
      }
      setDraggingId(sectionId);
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, sectionId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (sectionId === draggingId) {
        setDropTarget(null);
        return;
      }
      setDropTarget({ id: sectionId, position: dropPositionFromEvent(e) });
    },
    [draggingId]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
      e.preventDefault();
      const sourceId = e.dataTransfer.getData("text/plain");
      if (sourceId && sourceId !== targetId) {
        onReorder(sourceId, targetId, dropPositionFromEvent(e));
      }
      clearDragState();
    },
    [clearDragState, onReorder]
  );

  return (
    <>
      <aside className={`sidebar ${hidden ? "sidebar--hidden" : ""}`} aria-hidden={hidden}>
        <div className="sidebar-header">
          <h2>{t("sidebar.sections")}</h2>
          <button
            type="button"
            className="btn btn-icon"
            onClick={handleAdd}
            title={t("sidebar.addSection")}
          >
            +
          </button>
        </div>
        <nav className="section-list" aria-label={t("sidebar.sectionsAria")}>
          {sorted.map((section) => {
            const filled = sectionHasContent(section);
            const active = section.id === activeId;
            const dragging = section.id === draggingId;
            const dropBefore =
              dropTarget?.id === section.id && dropTarget.position === "before";
            const dropAfter =
              dropTarget?.id === section.id && dropTarget.position === "after";
            return (
              <div
                key={section.id}
                className={[
                  "section-item",
                  active ? "active" : "",
                  dragging ? "section-item--dragging" : "",
                  dropBefore ? "section-item--drop-before" : "",
                  dropAfter ? "section-item--drop-after" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onContextMenu={(e) => {
                  e.preventDefault();
                  openContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    copyHref: buildSectionHref(section.id),
                  });
                }}
                onDragOver={(e) => handleDragOver(e, section.id)}
                onDrop={(e) => handleDrop(e, section.id)}
                onDragLeave={(e) => {
                  if (e.currentTarget.contains(e.relatedTarget as Node | null)) {
                    return;
                  }
                  setDropTarget((current) =>
                    current?.id === section.id ? null : current
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
                  onDragStart={(e) => handleDragStart(e, section.id)}
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
                  {section.board.length > 0 && (
                    <span className="section-image-count">{section.board.length}</span>
                  )}
                </button>
                {sorted.length > 0 && (
                  <button
                    type="button"
                    className="section-remove"
                    onClick={() =>
                      setPendingRemove({
                        id: section.id,
                        title: section.title,
                      })
                    }
                    title={t("sidebar.removeSection")}
                    aria-label={`${t("sidebar.removeSection")} ${section.title}`}
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      <ConfirmDialog
        open={pendingRemove !== null}
        title={t("sidebar.removeSection")}
        message={
          pendingRemove
            ? t("sidebar.confirmRemove", { title: pendingRemove.title })
            : ""
        }
        confirmLabel={t("sidebar.removeSection")}
        onClose={() => setPendingRemove(null)}
        onConfirm={confirmRemove}
      />
    </>
  );
}
