import type { ReactNode, RefObject } from "react";

import type { ContextMenuAction } from "@/features/links/LinkContext";
import type { SidebarDropTarget } from "@/features/sidebar/lib/sidebarOrder";
import type { SidebarDragPayload, SidebarGroupDropTarget } from "@/features/sidebar/lib/sidebarTypes";
import type { GddSection, GddSectionFolder } from "@/shared/types";

export type SidebarDocLike = { folders: GddSectionFolder[]; sections: GddSection[] };

export interface SidebarInteraction {
  activeId: string;
  docLike: SidebarDocLike;
  onSelect: (id: string) => void;
  onToggleFolder: (id: string) => void;
  requestRemoveSection: (id: string, title: string) => void;
  requestRemoveFolder: (id: string, title: string) => void;
  openContextMenu: (options: { x: number; y: number; copyHref?: string; actions: ContextMenuAction[] }) => void;
  selectedGroupIds: string[];
  selectedGroupSet: Set<string>;
  hasGroupSelection: boolean;
  selectionAnchorRef: RefObject<string | null>;
  toggleGroupSection: (sectionId: string) => void;
  selectSectionRange: (toId: string, additive: boolean) => void;
  buildGroupActions: () => ContextMenuAction[];
  dragging: SidebarDragPayload | null;
  dropTarget: SidebarDropTarget | null;
  groupDropTarget: SidebarGroupDropTarget | null;
  draggingGroup: boolean;
  setDropTarget: React.Dispatch<React.SetStateAction<SidebarDropTarget | null>>;
  setGroupDropTarget: React.Dispatch<React.SetStateAction<SidebarGroupDropTarget | null>>;
  clearDragState: () => void;
  handleDragStart: (e: React.DragEvent<HTMLSpanElement>, payload: SidebarDragPayload) => void;
  handleGroupDragStart: (e: React.DragEvent<HTMLSpanElement>, sectionIds: string[]) => void;
  handleDrop: (e: React.DragEvent<HTMLElement>, target: SidebarDropTarget) => void;
  handleGroupDropFromEvent: (e: React.DragEvent<HTMLElement>, target: SidebarGroupDropTarget) => void;
  renamingFolderId: string | null;
  renameValue: string;
  setRenameValue: React.Dispatch<React.SetStateAction<string>>;
  startRenameFolder: (folder: GddSectionFolder) => void;
  commitRenameFolder: (folderId: string) => void;
  onRenameKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, folderId: string) => void;
  renderCreateButton: (parentFolderId: string | null, compact?: boolean) => ReactNode;
}
