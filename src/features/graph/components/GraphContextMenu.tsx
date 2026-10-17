import type { FormEvent, RefObject } from "react";

import { EDGE_STYLES } from "@/domain/graph/graph";
import type { GraphEdgeStyle } from "@/domain/types";
import type { GraphContextMenuState } from "@/features/graph/hooks/useGraphScene";
import { DescriptionLinks } from "@/features/links/components/LinkifiedText";
import { useLocale } from "@/shared/context/LocaleContext";

const EDGE_STYLE_LABEL_KEYS: Record<GraphEdgeStyle, "graph.edgeSolid" | "graph.edgeDotted" | "graph.edgeGhost"> = {
  solid: "graph.edgeSolid",
  dotted: "graph.edgeDotted",
  ghost: "graph.edgeGhost"
};

export type GraphMenuLink = {
  edgeId: string;
  otherName: string;
};

interface GraphContextMenuProps {
  menu: GraphContextMenuState;
  menuRef: RefObject<HTMLFormElement | null>;
  title: string;
  name: string;
  description: string;
  color: string;
  showFields: boolean;
  showNodeActions: boolean;
  showDelete: boolean;
  edgeFromLabel?: string;
  edgeToLabel?: string;
  edgeStyle?: GraphEdgeStyle;
  links: GraphMenuLink[];
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onColorChange: (value: string) => void;
  onCreateSubmit: (e: FormEvent) => void;
  onSaveNode: () => void;
  onDeleteNode: () => void;
  onLinkNode: () => void;
  onCutEdge: (edgeId: string) => void;
  onEdgeStyle: (edgeId: string, style: GraphEdgeStyle) => void;
}

export function GraphContextMenu({
  menu,
  menuRef,
  title,
  name,
  description,
  color,
  showFields,
  showNodeActions,
  showDelete,
  edgeFromLabel,
  edgeToLabel,
  edgeStyle,
  links,
  onNameChange,
  onDescriptionChange,
  onColorChange,
  onCreateSubmit,
  onSaveNode,
  onDeleteNode,
  onLinkNode,
  onCutEdge,
  onEdgeStyle
}: GraphContextMenuProps) {
  const { t } = useLocale();

  return (
    <form
      ref={menuRef}
      className="graph-menu"
      style={{ left: menu.x, top: menu.y }}
      onSubmit={menu.mode === "create" ? onCreateSubmit : (e) => e.preventDefault()}
    >
      <p className="graph-menu__title">{title}</p>

      {menu.mode === "edge" && (
        <>
          <p className="graph-menu__edge-info">
            {edgeFromLabel || "?"} — {edgeToLabel || "?"}
          </p>
          <div className="graph-menu__styles">
            <p className="graph-menu__styles-title">{t("graph.style")}</p>
            {EDGE_STYLES.map((style) => (
              <button
                key={style}
                type="button"
                className={`btn btn--ghost graph-menu__style-btn ${(edgeStyle || "solid") === style ? "is-active" : ""}`}
                onClick={() => onEdgeStyle(menu.edgeId, style)}
              >
                {t(EDGE_STYLE_LABEL_KEYS[style])}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn--danger" onClick={() => onCutEdge(menu.edgeId)}>
            {t("graph.cutConnection")}
          </button>
        </>
      )}

      {showFields && (
        <>
          <input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={t("graph.namePlaceholder")}
            autoFocus
          />
          <label className="graph-menu__color">
            <span>{t("graph.color")}</span>
            <input type="color" value={color} onChange={(e) => onColorChange(e.target.value)} />
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder={t("graph.descPlaceholder")}
          />
          <DescriptionLinks text={description} title={t("graph.descLinks")} />
        </>
      )}

      {menu.mode === "node" && links.length > 0 && (
        <div className="graph-menu__links">
          <p className="graph-menu__links-title">{t("graph.connections")}</p>
          {links.map((link) => (
            <div key={link.edgeId} className="graph-menu__link">
              <span>{link.otherName || t("graph.core")}</span>
              <button type="button" className="btn btn--danger btn--tiny" onClick={() => onCutEdge(link.edgeId)}>
                {t("graph.cut")}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="graph-menu__actions">
        {menu.mode === "create" && (
          <button type="submit" className="btn">
            {t("graph.create")}
          </button>
        )}
        {showNodeActions && (
          <>
            <button type="button" className="btn btn--ghost" onClick={onLinkNode}>
              {t("graph.link")}
            </button>
            {showDelete && (
              <>
                <button type="button" className="btn" onClick={onSaveNode}>
                  {t("graph.save")}
                </button>
                <button type="button" className="btn btn--danger" onClick={onDeleteNode}>
                  {t("graph.delete")}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </form>
  );
}
