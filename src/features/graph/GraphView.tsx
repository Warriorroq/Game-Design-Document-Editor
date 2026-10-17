import "./Graph.css";

import { useCallback, useEffect, useRef, useState } from "react";

import { DEFAULT_GRAPH_SETTINGS, DEFAULT_NODE_COLOR, normalizeGraphData } from "@/domain/graph/graph";
import type { GddSection, GraphData, GraphEdgeStyle, GraphSettings } from "@/domain/types";
import { GraphContextMenu } from "@/features/graph/components/GraphContextMenu";
import { GraphSettingsPanel } from "@/features/graph/components/GraphSettingsPanel";
import { GraphTooltip } from "@/features/graph/components/GraphTooltip";
import {
  type GraphContextMenuState,
  type GraphTooltipState,
  useGraphScene
} from "@/features/graph/hooks/useGraphScene";
import { useGraphTooltipHoldMs } from "@/features/graph/hooks/useGraphTooltipHoldMs";
import { useLocale } from "@/shared/context/LocaleContext";

const TOOLTIP_LEAVE_GRACE_MS = 220;

interface GraphViewProps {
  section: GddSection;
  onChange: (patch: Partial<GddSection>) => void;
}

export function GraphView({ section, onChange }: GraphViewProps) {
  const { t } = useLocale();
  const holdMs = useGraphTooltipHoldMs();
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLFormElement>(null);
  const graph = normalizeGraphData(section.graph);

  const [menu, setMenu] = useState<GraphContextMenuState | null>(null);
  const [tooltip, setTooltip] = useState<GraphTooltipState>(null);
  const [tooltipStayed, setTooltipStayed] = useState(false);
  const tooltipStayedRef = useRef(false);
  const tooltipDescHoveredRef = useRef(false);
  const tooltipNodeIdRef = useRef<string | null>(null);
  const tooltipHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<GraphSettings>(graph.settings);
  const [menuName, setMenuName] = useState("");
  const [menuDesc, setMenuDesc] = useState("");
  const [menuColor, setMenuColor] = useState(DEFAULT_NODE_COLOR);
  const [pointCount, setPointCount] = useState(graph.pointCount);

  const onGraphChange = useCallback(
    (data: GraphData) => {
      setPointCount(data.pointCount);
      setSettings(data.settings);
      onChange({ graph: data });
    },
    [onChange]
  );

  const clearTooltip = useCallback(() => {
    if (tooltipHideTimerRef.current) {
      clearTimeout(tooltipHideTimerRef.current);
      tooltipHideTimerRef.current = null;
    }
    tooltipNodeIdRef.current = null;
    tooltipStayedRef.current = false;
    tooltipDescHoveredRef.current = false;
    setTooltipStayed(false);
    setTooltip(null);
  }, []);

  const handleTooltip = useCallback(
    (next: GraphTooltipState) => {
      if (tooltipHideTimerRef.current) {
        clearTimeout(tooltipHideTimerRef.current);
        tooltipHideTimerRef.current = null;
      }

      if (next) {
        if (next.nodeId !== tooltipNodeIdRef.current) {
          tooltipNodeIdRef.current = next.nodeId;
          tooltipStayedRef.current = false;
          tooltipDescHoveredRef.current = false;
          setTooltipStayed(false);
        }
        setTooltip(next);
        return;
      }

      // Left the point — keep only if hold completed (grace to reach the card).
      if (tooltipStayedRef.current || tooltipDescHoveredRef.current) {
        tooltipHideTimerRef.current = setTimeout(() => {
          if (!tooltipDescHoveredRef.current) clearTooltip();
          tooltipHideTimerRef.current = null;
        }, TOOLTIP_LEAVE_GRACE_MS);
        return;
      }

      clearTooltip();
    },
    [clearTooltip]
  );

  const handleHoldComplete = useCallback(() => {
    tooltipStayedRef.current = true;
    setTooltipStayed(true);
  }, []);

  const handleDescriptionHoverChange = useCallback(
    (hovered: boolean) => {
      tooltipDescHoveredRef.current = hovered;
      if (hovered) {
        if (tooltipHideTimerRef.current) {
          clearTimeout(tooltipHideTimerRef.current);
          tooltipHideTimerRef.current = null;
        }
        return;
      }
      // Leaving the description always hides it.
      clearTooltip();
    },
    [clearTooltip]
  );

  useEffect(() => {
    return () => {
      if (tooltipHideTimerRef.current) clearTimeout(tooltipHideTimerRef.current);
    };
  }, []);

  const api = useGraphScene({
    containerRef,
    graphData: graph,
    onGraphChange,
    onContextMenu: setMenu,
    onTooltip: handleTooltip
  });

  useEffect(() => {
    if (!menu) return;
    const engine = api.getEngine();
    if (!engine) return;

    if (menu.mode === "create") {
      setMenuName(`point ${engine.pointCount + 1}`);
      setMenuDesc("");
      setMenuColor(DEFAULT_NODE_COLOR);
      return;
    }
    if (menu.mode === "node") {
      const node = engine.getNode(menu.nodeId);
      if (!node) return;
      setMenuName(node.name || "");
      setMenuDesc(node.description || "");
      setMenuColor(node.paintColor || node.color || DEFAULT_NODE_COLOR);
    }
    // Only re-sync form fields when the menu target changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu(null);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menu]);

  const applySettings = (next: GraphSettings) => {
    setSettings(next);
    api.getEngine()?.setSettings(next);
    api.persist();
  };

  const patchSettings = (partial: Partial<GraphSettings>) => {
    applySettings({ ...settings, ...partial });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const engine = api.getEngine();
    if (!engine || menu?.mode !== "create") return;
    engine.addNode({
      name: menuName.trim() || undefined,
      description: menuDesc.trim(),
      color: menuColor
    });
    setMenu(null);
    api.persist();
  };

  const handleSaveNode = () => {
    const engine = api.getEngine();
    if (!engine || menu?.mode !== "node") return;
    const name = menuName.trim();
    if (!name) return;
    engine.updateNode(menu.nodeId, {
      name,
      description: menuDesc.trim(),
      color: menuColor
    });
    setMenu(null);
    api.persist();
  };

  const handleDeleteNode = () => {
    const engine = api.getEngine();
    if (!engine || menu?.mode !== "node") return;
    const node = engine.getNode(menu.nodeId);
    if (node?.fixed) {
      setMenu(null);
      return;
    }
    engine.removeNode(menu.nodeId);
    setMenu(null);
    setTooltip(null);
    api.persist();
  };

  const handleLinkNode = () => {
    if (menu?.mode !== "node") return;
    api.selectNode(menu.nodeId);
    setMenu(null);
  };

  const handleCutEdge = (edgeId: string) => {
    const engine = api.getEngine();
    if (!engine) return;
    engine.removeEdge(edgeId);
    if (menu?.mode === "node") {
      setMenu({ ...menu });
    } else {
      setMenu(null);
    }
    api.persist();
  };

  const handleEdgeStyle = (edgeId: string, style: GraphEdgeStyle) => {
    const engine = api.getEngine();
    if (!engine) return;
    engine.setEdgeStyle(edgeId, style);
    setMenu(null);
    api.persist();
  };

  const engine = api.getEngine();
  const menuNode = menu?.mode === "node" ? engine?.getNode(menu.nodeId) : null;
  const menuEdge = menu?.mode === "edge" ? engine?.getEdge(menu.edgeId) : null;
  const menuLinks = menu?.mode === "node" && menu.nodeId ? (engine?.getLinksForNode(menu.nodeId) ?? []) : [];

  const menuTitle =
    menu?.mode === "create"
      ? t("graph.newPoint")
      : menu?.mode === "edge"
        ? t("graph.connection")
        : menuNode?.fixed
          ? t("graph.core")
          : menuNode?.name || t("graph.point");

  const nodeLabel = (id: string) => {
    const node = engine?.getNode(id);
    if (!node) return "?";
    return node.fixed ? t("graph.core") : node.name || "?";
  };

  return (
    <div className="graph-panel">
      <header className="graph-header">
        <div className="graph-header-main">
          <h2 className="graph-title">{t("graph.title")}</h2>
          <input
            className="graph-section-title"
            value={section.title}
            onChange={(e) => onChange({ title: e.target.value })}
            aria-label={t("graph.sectionTitleAria")}
          />
        </div>
        <div className="graph-meta">
          <span>{t("graph.points", { count: pointCount })}</span>
          <button
            type="button"
            className={`btn graph-settings-btn ${settingsOpen ? "active" : ""}`}
            onClick={() => setSettingsOpen((v) => !v)}
          >
            {t("graph.settings")}
          </button>
          <span className="graph-hint-inline">{t("graph.hint")}</span>
        </div>
      </header>

      <div className="graph-body">
        <div className="graph-viewport">
          <div ref={containerRef} className="graph-canvas-host" />

          {settingsOpen && (
            <GraphSettingsPanel
              settings={settings}
              onChange={patchSettings}
              onReset={() => applySettings({ ...DEFAULT_GRAPH_SETTINGS })}
              onClose={() => setSettingsOpen(false)}
            />
          )}

          {tooltip && (
            <GraphTooltip
              key={`${tooltip.nodeId}-${holdMs}`}
              tooltip={tooltip}
              stayed={tooltipStayed}
              holdMs={holdMs}
              onHoldComplete={handleHoldComplete}
              onDescriptionHoverChange={handleDescriptionHoverChange}
            />
          )}

          {menu && (
            <GraphContextMenu
              menu={menu}
              menuRef={menuRef}
              title={menuTitle}
              name={menuName}
              description={menuDesc}
              color={menuColor}
              showFields={menu.mode === "create" || (menu.mode === "node" && !!menuNode && !menuNode.fixed)}
              showNodeActions={menu.mode === "node"}
              showDelete={!!menuNode && !menuNode.fixed}
              edgeFromLabel={menuEdge ? nodeLabel(menuEdge.from) : undefined}
              edgeToLabel={menuEdge ? nodeLabel(menuEdge.to) : undefined}
              edgeStyle={menuEdge?.style}
              links={menuLinks}
              onNameChange={setMenuName}
              onDescriptionChange={setMenuDesc}
              onColorChange={setMenuColor}
              onCreateSubmit={handleCreateSubmit}
              onSaveNode={handleSaveNode}
              onDeleteNode={handleDeleteNode}
              onLinkNode={handleLinkNode}
              onCutEdge={handleCutEdge}
              onEdgeStyle={handleEdgeStyle}
            />
          )}
        </div>
      </div>
    </div>
  );
}
