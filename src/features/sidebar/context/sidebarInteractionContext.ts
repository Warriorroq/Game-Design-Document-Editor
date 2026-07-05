import { createContext } from "react";

import type { SidebarInteraction } from "@/features/sidebar/lib/sidebarInteractionTypes";

export const SidebarInteractionContext = createContext<SidebarInteraction | null>(null);
