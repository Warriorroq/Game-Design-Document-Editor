export type SidebarDragPayload = { kind: "section" | "folder"; id: string } | { kind: "group"; sectionIds: string[] };

export type SidebarGroupDropTarget = { kind: "folder"; folderId: string } | { kind: "root" };

export type SidebarPendingRemove =
  | { kind: "section"; id: string; title: string }
  | { kind: "folder"; id: string; title: string }
  | { kind: "group"; count: number };
