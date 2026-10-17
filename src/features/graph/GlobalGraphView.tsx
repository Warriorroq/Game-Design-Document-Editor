import "./Graph.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  buildGlobalGraph,
  externalUrlFromGlobalNodeId,
  globalGraphSignature,
  isExternalGlobalNodeId
} from "@/domain/graph/buildGlobalGraph";
import type { GraphData } from "@/domain/types";
import { GraphTooltip } from "@/features/graph/components/GraphTooltip";
import { type GraphTooltipState, useGraphScene } from "@/features/graph/hooks/useGraphScene";
import { useGraphTooltipHoldMs } from "@/features/graph/hooks/useGraphTooltipHoldMs";
import { useLinkContext } from "@/features/links/LinkContext";
import { useLocale } from "@/shared/context/LocaleContext";
import type { GddDocument } from "@/shared/types";

const TOOLTIP_LEAVE_GRACE_MS = 220;

interface GlobalGraphCanvasProps {
  graphData: GraphData;
  onTooltip: (tooltip: GraphTooltipState) => void;
  onNodeActivate: (nodeId: string) => void;
}

function GlobalGraphCanvas({ graphData, onTooltip, onNodeActivate }: GlobalGraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useGraphScene({
    containerRef,
    graphData,
    onGraphChange: () => {},
    onContextMenu: () => {},
    onTooltip,
    readOnly: true,
    onNodeActivate
  });
  return <div ref={containerRef} className="graph-canvas-host" />;
}

interface GlobalGraphViewProps {
  doc: GddDocument;
  onOpenSection: (sectionId: string) => void;
}

export function GlobalGraphView({ doc, onOpenSection }: GlobalGraphViewProps) {
  const { t } = useLocale();
  const { navigateToHref } = useLinkContext();
  const holdMs = useGraphTooltipHoldMs();

  const graphData = useMemo(() => buildGlobalGraph(doc), [doc]);
  const signature = useMemo(() => globalGraphSignature(graphData), [graphData]);

  const [tooltip, setTooltip] = useState<GraphTooltipState>(null);
  const [tooltipStayed, setTooltipStayed] = useState(false);
  const tooltipStayedRef = useRef(false);
  const tooltipDescHoveredRef = useRef(false);
  const tooltipNodeIdRef = useRef<string | null>(null);
  const tooltipHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      clearTooltip();
    },
    [clearTooltip]
  );

  useEffect(() => {
    return () => {
      if (tooltipHideTimerRef.current) clearTimeout(tooltipHideTimerRef.current);
    };
  }, []);

  const handleNodeActivate = useCallback(
    (nodeId: string) => {
      if (isExternalGlobalNodeId(nodeId)) {
        const url = externalUrlFromGlobalNodeId(nodeId);
        if (url) navigateToHref(url);
        return;
      }
      // Ignore core / unknown engine ids — only real section nodes navigate.
      if (!doc.sections.some((section) => section.id === nodeId)) return;
      onOpenSection(nodeId);
    },
    [doc.sections, navigateToHref, onOpenSection]
  );

  return (
    <div className="graph-panel graph-panel--global">
      <header className="graph-header">
        <div className="graph-header-main">
          <h2 className="graph-title">{t("globalGraph.title")}</h2>
        </div>
        <div className="graph-meta">
          <span>{t("globalGraph.nodes", { count: graphData.nodes.length })}</span>
          <span>{t("globalGraph.links", { count: graphData.edges.length })}</span>
        </div>
      </header>

      <div className="graph-body">
        <div className="graph-viewport">
          <GlobalGraphCanvas
            key={signature}
            graphData={graphData}
            onTooltip={handleTooltip}
            onNodeActivate={handleNodeActivate}
          />

          {graphData.nodes.length === 0 && (
            <div className="graph-global-empty">
              <p>{t("globalGraph.empty")}</p>
            </div>
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
        </div>
      </div>
    </div>
  );
}
