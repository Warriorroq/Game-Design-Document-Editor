import { useCallback, useState } from "react";

import { readDragPayloadFromEvent, SIDEBAR_DRAG_MIME } from "@/features/sidebar/lib/sidebarDrag";
import type { SidebarDropTarget } from "@/features/sidebar/lib/sidebarOrder";
import type { SidebarDragPayload, SidebarGroupDropTarget } from "@/features/sidebar/lib/sidebarTypes";
import { restoreAppFocus } from "@/shared/lib/desktop";

interface UseSidebarDragDropOptions {
  onReorder: (drag: { kind: "section" | "folder"; id: string }, target: SidebarDropTarget) => void;
  onMoveSectionsToFolder: (ids: string[], folderId: string | null) => void;
}

export function useSidebarDragDrop({ onReorder, onMoveSectionsToFolder }: UseSidebarDragDropOptions) {
  const [dragging, setDragging] = useState<SidebarDragPayload | null>(null);
  const [dropTarget, setDropTarget] = useState<SidebarDropTarget | null>(null);
  const [groupDropTarget, setGroupDropTarget] = useState<SidebarGroupDropTarget | null>(null);

  const draggingGroup = dragging?.kind === "group";

  const clearDragState = useCallback(() => {
    setDragging(null);
    setDropTarget(null);
    setGroupDropTarget(null);
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent<HTMLSpanElement>, payload: SidebarDragPayload) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(SIDEBAR_DRAG_MIME, JSON.stringify(payload));
    const item = e.currentTarget.closest(".sidebar-row");
    if (item instanceof HTMLElement) {
      e.dataTransfer.setDragImage(item, 16, 16);
    }
    setDragging(payload);
    setGroupDropTarget(null);
  }, []);

  const handleGroupDragStart = useCallback(
    (e: React.DragEvent<HTMLSpanElement>, sectionIds: string[]) => {
      handleDragStart(e, { kind: "group", sectionIds });
    },
    [handleDragStart]
  );

  const handleGroupDrop = useCallback(
    (target: SidebarGroupDropTarget, sectionIds: string[]) => {
      onMoveSectionsToFolder(sectionIds, target.kind === "root" ? null : target.folderId);
      clearDragState();
      restoreAppFocus();
    },
    [clearDragState, onMoveSectionsToFolder]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLElement>, target: SidebarDropTarget) => {
      e.preventDefault();
      const payload = readDragPayloadFromEvent(e);
      if (!payload) {
        clearDragState();
        return;
      }
      if (payload.kind === "group") {
        if (target.kind === "folder" && target.position === "inside") {
          handleGroupDrop({ kind: "folder", folderId: target.id }, payload.sectionIds);
        } else {
          clearDragState();
        }
        return;
      }
      onReorder(payload, target);
      clearDragState();
    },
    [clearDragState, handleGroupDrop, onReorder]
  );

  const handleGroupDropFromEvent = useCallback(
    (e: React.DragEvent<HTMLElement>, target: SidebarGroupDropTarget) => {
      e.preventDefault();
      const payload = readDragPayloadFromEvent(e);
      if (payload?.kind === "group") {
        handleGroupDrop(target, payload.sectionIds);
      } else {
        clearDragState();
      }
    },
    [clearDragState, handleGroupDrop]
  );

  return {
    dragging,
    dropTarget,
    groupDropTarget,
    draggingGroup,
    setDropTarget,
    setGroupDropTarget,
    clearDragState,
    handleDragStart,
    handleGroupDragStart,
    handleGroupDrop,
    handleDrop,
    handleGroupDropFromEvent
  };
}
