import type { SectionDropPosition } from "@/features/sidebar/lib/sidebarOrder";

import type { SidebarDragPayload } from "./sidebarTypes";

export const SIDEBAR_DRAG_MIME = "application/x-gdde-sidebar";

export function dropPositionFromEvent(e: React.DragEvent<HTMLElement>): SectionDropPosition {
  const rect = e.currentTarget.getBoundingClientRect();
  return e.clientY < rect.top + rect.height / 2 ? "before" : "after";
}

export function folderDropPositionFromEvent(e: React.DragEvent<HTMLElement>): SectionDropPosition | "inside" {
  const rect = e.currentTarget.getBoundingClientRect();
  const relativeY = e.clientY - rect.top;
  if (relativeY < rect.height * 0.25) return "before";
  if (relativeY > rect.height * 0.75) return "after";
  return "inside";
}

export function parseDragPayload(raw: string): SidebarDragPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SidebarDragPayload;
    if (parsed?.kind === "group" && Array.isArray(parsed.sectionIds) && parsed.sectionIds.length > 0) {
      return { kind: "group", sectionIds: parsed.sectionIds };
    }
    if (parsed && (parsed.kind === "section" || parsed.kind === "folder") && typeof parsed.id === "string") {
      return parsed;
    }
  } catch {
    if (raw.startsWith("section:")) {
      return { kind: "section", id: raw.slice("section:".length) };
    }
  }
  return null;
}

export function readDragPayloadFromEvent(e: React.DragEvent<HTMLElement>): SidebarDragPayload | null {
  return parseDragPayload(e.dataTransfer.getData(SIDEBAR_DRAG_MIME));
}
