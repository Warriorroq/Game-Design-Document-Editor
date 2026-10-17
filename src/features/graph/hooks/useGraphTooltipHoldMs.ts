import { useEffect, useState } from "react";

import { getGraphTooltipHoldMs } from "@/domain/graph/graphSettings";

/** Current description hold duration; updates when changed in Settings. */
export function useGraphTooltipHoldMs(): number {
  const [holdMs, setHoldMs] = useState(getGraphTooltipHoldMs);
  useEffect(() => {
    const onChange = () => setHoldMs(getGraphTooltipHoldMs());
    window.addEventListener("gdd-graph-tooltip-hold-ms", onChange);
    return () => window.removeEventListener("gdd-graph-tooltip-hold-ms", onChange);
  }, []);
  return holdMs;
}
