import { useState } from "react";
import { useLocale } from "../context/LocaleContext";
import { useLinkContext } from "../context/LinkContext";
import { restoreAppFocus } from "../lib/desktop";
import { buildSectionHref } from "../lib/links";
import type { GddSection } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";

interface SidebarProps {
  hidden: boolean;
  sections: GddSection[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}

function sectionHasContent(section: GddSection): boolean {
  return section.content.trim().length > 40 || section.board.length > 0;
}

export function Sidebar({
  hidden,
  sections,
  activeId,
  onSelect,
  onAdd,
  onRemove,
}: SidebarProps) {
  const { t } = useLocale();
  const { openContextMenu } = useLinkContext();
  const [pendingRemove, setPendingRemove] = useState<{
    id: string;
    title: string;
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
            return (
              <div
                key={section.id}
                className={`section-item ${active ? "active" : ""}`}
                onContextMenu={(e) => {
                  e.preventDefault();
                  openContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    copyHref: buildSectionHref(section.id),
                  });
                }}
              >
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
