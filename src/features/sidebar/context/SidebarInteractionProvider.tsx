import type { ReactNode } from "react";

import { SidebarInteractionContext } from "@/features/sidebar/context/sidebarInteractionContext";
import type { SidebarInteraction } from "@/features/sidebar/lib/sidebarInteractionTypes";

interface SidebarInteractionProviderProps {
  value: SidebarInteraction;
  children: ReactNode;
}

export function SidebarInteractionProvider({ value, children }: SidebarInteractionProviderProps) {
  return <SidebarInteractionContext.Provider value={value}>{children}</SidebarInteractionContext.Provider>;
}
