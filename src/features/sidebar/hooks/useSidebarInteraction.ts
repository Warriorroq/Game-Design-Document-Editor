import { useContext } from "react";

import { SidebarInteractionContext } from "@/features/sidebar/context/sidebarInteractionContext";
import type { SidebarInteraction } from "@/features/sidebar/lib/sidebarInteractionTypes";

export function useSidebarInteraction(): SidebarInteraction {
  const ctx = useContext(SidebarInteractionContext);
  if (!ctx) {
    throw new Error("useSidebarInteraction must be used within SidebarInteractionProvider");
  }
  return ctx;
}
