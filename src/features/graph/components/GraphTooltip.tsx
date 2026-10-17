import { useEffect } from "react";

import type { GraphTooltipState } from "@/features/graph/hooks/useGraphScene";
import { LinkifiedText } from "@/features/links/components/LinkifiedText";
import { useLocale } from "@/shared/context/LocaleContext";

interface GraphTooltipProps {
  tooltip: NonNullable<GraphTooltipState>;
  /** True after the point was hovered long enough for the card to stay. */
  stayed: boolean;
  holdMs: number;
  onHoldComplete: () => void;
  onDescriptionHoverChange: (hovered: boolean) => void;
}

export function GraphTooltip({ tooltip, stayed, holdMs, onHoldComplete, onDescriptionHoverChange }: GraphTooltipProps) {
  const { t } = useLocale();
  const hasDescription = tooltip.description.trim().length > 0;

  useEffect(() => {
    if (stayed) return;
    const timer = window.setTimeout(() => onHoldComplete(), holdMs);
    return () => window.clearTimeout(timer);
  }, [stayed, holdMs, onHoldComplete, tooltip.nodeId]);

  return (
    <div
      className={[
        "graph-tooltip",
        stayed ? "graph-tooltip--stayed" : "graph-tooltip--holding",
        stayed ? "graph-tooltip--interactive" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        {
          left: tooltip.x,
          top: tooltip.y,
          "--graph-hold-ms": `${holdMs}ms`
        } as React.CSSProperties
      }
      onMouseEnter={() => {
        if (stayed) onDescriptionHoverChange(true);
      }}
      onMouseLeave={() => {
        if (stayed) onDescriptionHoverChange(false);
      }}
    >
      <strong>{tooltip.name}</strong>
      <p className={hasDescription ? undefined : "graph-tooltip__empty"}>
        {hasDescription ? <LinkifiedText text={tooltip.description} /> : t("graph.noDescription")}
      </p>
    </div>
  );
}
