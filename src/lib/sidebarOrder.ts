import type { GddDocument, GddSection, GddSectionFolder } from "../types";

export type SidebarDoc = Pick<GddDocument, "folders" | "sections">;

export type SectionDropPosition = "before" | "after";

export type SidebarDragKind = "section" | "folder";

export type SidebarDropTarget =
  | { kind: "section"; id: string; position: SectionDropPosition }
  | { kind: "folder"; id: string; position: SectionDropPosition | "inside" };

type ChildItem =
  | { kind: "folder"; item: GddSectionFolder }
  | { kind: "section"; item: GddSection };

function foldersOf(doc: SidebarDoc): GddSectionFolder[] {
  return doc.folders ?? [];
}

function parentKey(folderId: string | null | undefined): string {
  return folderId ?? "";
}

export function childItems(
  doc: SidebarDoc,
  parentFolderId: string | null
): ChildItem[] {
  const parent = parentKey(parentFolderId);
  const folders = foldersOf(doc)
    .filter((folder) => parentKey(folder.parentFolderId) === parent)
    .map((folder) => ({
      kind: "folder" as const,
      item: folder,
      order: folder.order,
    }));
  const sections = doc.sections
    .filter((section) => parentKey(section.folderId) === parent)
    .map((section) => ({
      kind: "section" as const,
      item: section,
      order: section.order,
    }));
  return [...folders, ...sections]
    .sort((a, b) => a.order - b.order)
    .map(({ kind, item }) => ({ kind, item }) as ChildItem);
}

/** @deprecated Use childItems(doc, null) */
export function rootItems(doc: SidebarDoc): ChildItem[] {
  return childItems(doc, null);
}

export function sectionsInFolder(
  doc: SidebarDoc,
  folderId: string
): GddSection[] {
  return doc.sections
    .filter((section) => section.folderId === folderId)
    .sort((a, b) => a.order - b.order);
}

export function nextChildOrder(
  doc: SidebarDoc,
  parentFolderId: string | null
): number {
  const items = childItems(doc, parentFolderId);
  if (items.length === 0) return 0;
  return Math.max(...items.map((entry) => entry.item.order)) + 1;
}

/** @deprecated Use nextChildOrder */
export function nextRootOrder(doc: SidebarDoc): number {
  return nextChildOrder(doc, null);
}

/** @deprecated Use nextChildOrder */
export function nextFolderSectionOrder(doc: SidebarDoc, folderId: string): number {
  return nextChildOrder(doc, folderId);
}

function folderParent(doc: SidebarDoc, folderId: string): string | null {
  return foldersOf(doc).find((folder) => folder.id === folderId)?.parentFolderId ?? null;
}

function wouldCreateFolderCycle(
  doc: SidebarDoc,
  dragFolderId: string,
  newParentId: string | null
): boolean {
  if (!newParentId) return false;
  let current: string | undefined = newParentId;
  while (current) {
    if (current === dragFolderId) return true;
    current = foldersOf(doc).find((folder) => folder.id === current)?.parentFolderId;
  }
  return false;
}

function renumberSectionsInParent(
  sections: GddSection[],
  folderId: string | null
): GddSection[] {
  const siblings = sections
    .filter((section) => parentKey(section.folderId) === parentKey(folderId))
    .sort((a, b) => a.order - b.order);
  const orderMap = new Map(siblings.map((section, index) => [section.id, index]));
  return sections.map((section) => {
    const order = orderMap.get(section.id);
    return order !== undefined ? { ...section, order } : section;
  });
}

function applyChildOrders(
  doc: GddDocument,
  parentFolderId: string | null,
  ordered: ChildItem[]
): GddDocument {
  const folderOrders = new Map<string, number>();
  const sectionOrders = new Map<string, number>();
  ordered.forEach(({ kind, item }, index) => {
    if (kind === "folder") folderOrders.set(item.id, index);
    else sectionOrders.set(item.id, index);
  });

  const parent = parentKey(parentFolderId);
  return {
    ...doc,
    folders: foldersOf(doc).map((folder) => {
      if (parentKey(folder.parentFolderId) !== parent) return folder;
      const order = folderOrders.get(folder.id);
      return order !== undefined ? { ...folder, order } : folder;
    }),
    sections: doc.sections.map((section) => {
      if (parentKey(section.folderId) !== parent) return section;
      const order = sectionOrders.get(section.id);
      return order !== undefined ? { ...section, order } : section;
    }),
  };
}

function moveSectionToParent(
  doc: GddDocument,
  sectionId: string,
  parentFolderId: string | null,
  insertIndex: number
): GddDocument {
  const section = doc.sections.find((entry) => entry.id === sectionId);
  if (!section) return doc;

  const oldParent = section.folderId ?? null;
  let nextDoc: GddDocument = {
    ...doc,
    sections: doc.sections.map((entry) =>
      entry.id === sectionId
        ? { ...entry, folderId: parentFolderId ?? undefined }
        : entry
    ),
  };

  if (oldParent !== parentFolderId) {
    nextDoc = applyChildOrders(
      nextDoc,
      oldParent,
      childItems(nextDoc, oldParent).filter(
        (entry) => !(entry.kind === "section" && entry.item.id === sectionId)
      )
    );
  }

  const items = childItems(nextDoc, parentFolderId).filter(
    (entry) => !(entry.kind === "section" && entry.item.id === sectionId)
  );
  const moved = nextDoc.sections.find((entry) => entry.id === sectionId)!;
  const clampedIndex = Math.max(0, Math.min(insertIndex, items.length));
  items.splice(clampedIndex, 0, { kind: "section", item: moved });
  return applyChildOrders(nextDoc, parentFolderId, items);
}

function moveFolderToParent(
  doc: GddDocument,
  folderId: string,
  parentFolderId: string | null,
  insertIndex: number
): GddDocument | null {
  if (wouldCreateFolderCycle(doc, folderId, parentFolderId)) return null;

  const folder = foldersOf(doc).find((entry) => entry.id === folderId);
  if (!folder) return null;

  const oldParent = folder.parentFolderId ?? null;
  let nextDoc: GddDocument = {
    ...doc,
    folders: foldersOf(doc).map((entry) =>
      entry.id === folderId
        ? { ...entry, parentFolderId: parentFolderId ?? undefined }
        : entry
    ),
  };

  if (oldParent !== parentFolderId) {
    nextDoc = applyChildOrders(
      nextDoc,
      oldParent,
      childItems(nextDoc, oldParent).filter(
        (entry) => !(entry.kind === "folder" && entry.item.id === folderId)
      )
    );
  }

  const items = childItems(nextDoc, parentFolderId).filter(
    (entry) => !(entry.kind === "folder" && entry.item.id === folderId)
  );
  const moved = nextDoc.folders!.find((entry) => entry.id === folderId)!;
  const clampedIndex = Math.max(0, Math.min(insertIndex, items.length));
  items.splice(clampedIndex, 0, { kind: "folder", item: moved });
  return applyChildOrders(nextDoc, parentFolderId, items);
}

function insertSectionAtChildIndex(
  doc: GddDocument,
  sectionId: string,
  parentFolderId: string | null,
  insertIndex: number
): GddDocument {
  return moveSectionToParent(doc, sectionId, parentFolderId, insertIndex);
}

export function applySidebarDrop(
  doc: GddDocument,
  drag: { kind: SidebarDragKind; id: string },
  target: SidebarDropTarget
): GddDocument | null {
  if (drag.kind === "folder") {
    if (target.kind === "folder" && target.position === "inside") {
      const insertIndex = childItems(doc, target.id).filter(
        (entry) => !(entry.kind === "folder" && entry.item.id === drag.id)
      ).length;
      return moveFolderToParent(doc, drag.id, target.id, insertIndex);
    }

    if (target.kind === "folder") {
      const parentId = folderParent(doc, target.id);
      const items = childItems(doc, parentId);
      const targetIndex = items.findIndex(
        (entry) => entry.kind === "folder" && entry.item.id === target.id
      );
      if (targetIndex < 0) return null;
      const insertIndex =
        target.position === "before" ? targetIndex : targetIndex + 1;
      return moveFolderToParent(doc, drag.id, parentId, insertIndex);
    }

    const targetSection = doc.sections.find((section) => section.id === target.id);
    if (!targetSection) return null;
    const parentId = targetSection.folderId ?? null;
    const items = childItems(doc, parentId);
    const targetIndex = items.findIndex(
      (entry) => entry.kind === "section" && entry.item.id === target.id
    );
    if (targetIndex < 0) return null;
    const insertIndex =
      target.position === "before" ? targetIndex : targetIndex + 1;
    return moveFolderToParent(doc, drag.id, parentId, insertIndex);
  }

  const source = doc.sections.find((section) => section.id === drag.id);
  if (!source) return null;

  if (target.kind === "folder") {
    if (target.position === "inside") {
      const insertIndex = sectionsInFolder(doc, target.id).filter(
        (section) => section.id !== drag.id
      ).length;
      return moveSectionToParent(doc, drag.id, target.id, insertIndex);
    }

    const parentId = folderParent(doc, target.id);
    const items = childItems(doc, parentId);
    const targetIndex = items.findIndex(
      (entry) => entry.kind === "folder" && entry.item.id === target.id
    );
    if (targetIndex < 0) return null;
    const insertIndex =
      target.position === "before" ? targetIndex : targetIndex + 1;
    return insertSectionAtChildIndex(doc, drag.id, parentId, insertIndex);
  }

  const targetSection = doc.sections.find((section) => section.id === target.id);
  if (!targetSection || drag.id === target.id) return null;

  const parentFolderId = targetSection.folderId ?? null;
  const siblings = doc.sections
    .filter(
      (section) =>
        parentKey(section.folderId) === parentKey(parentFolderId) &&
        section.id !== drag.id
    )
    .sort((a, b) => a.order - b.order);
  let insertIndex = siblings.findIndex((section) => section.id === target.id);
  if (insertIndex < 0) return null;
  if (target.position === "after") insertIndex += 1;

  return moveSectionToParent(doc, drag.id, parentFolderId, insertIndex);
}

export function removeSectionFromDoc(
  doc: GddDocument,
  sectionId: string
): GddDocument {
  const removed = doc.sections.find((section) => section.id === sectionId);
  if (!removed) return doc;
  const parentFolderId = removed.folderId ?? null;
  const sections = doc.sections.filter((section) => section.id !== sectionId);
  return {
    ...doc,
    sections: renumberSectionsInParent(sections, parentFolderId),
  };
}

function refreshChildItem(doc: GddDocument, entry: ChildItem): ChildItem {
  if (entry.kind === "section") {
    const item = doc.sections.find((section) => section.id === entry.item.id);
    if (!item) return entry;
    return { kind: "section", item };
  }
  const item = foldersOf(doc).find((folder) => folder.id === entry.item.id);
  if (!item) return entry;
  return { kind: "folder", item };
}

export function removeFolderFromDoc(
  doc: GddDocument,
  folderId: string
): GddDocument {
  const folder = foldersOf(doc).find((entry) => entry.id === folderId);
  if (!folder) return doc;

  const parentId = folder.parentFolderId ?? null;
  const parentItems = childItems(doc, parentId);
  const folderIndex = parentItems.findIndex(
    (entry) => entry.kind === "folder" && entry.item.id === folderId
  );
  if (folderIndex < 0) return doc;

  const hoistedChildren = childItems(doc, folderId);

  let folders = foldersOf(doc).filter((entry) => entry.id !== folderId);
  let sections = doc.sections.map((section) =>
    section.folderId === folderId
      ? { ...section, folderId: parentId ?? undefined }
      : section
  );
  folders = folders.map((entry) =>
    entry.parentFolderId === folderId
      ? { ...entry, parentFolderId: parentId ?? undefined }
      : entry
  );

  const nextDoc: GddDocument = { ...doc, folders, sections };
  const before = parentItems.slice(0, folderIndex);
  const after = parentItems.slice(folderIndex + 1);
  const hoistedItems = hoistedChildren.map((entry) => refreshChildItem(nextDoc, entry));
  const newParentOrder = [
    ...before.map((entry) => refreshChildItem(nextDoc, entry)),
    ...hoistedItems,
    ...after.map((entry) => refreshChildItem(nextDoc, entry)),
  ];

  return applyChildOrders(nextDoc, parentId, newParentOrder);
}

export function firstSectionId(doc: SidebarDoc): string {
  function walk(parentId: string | null): string {
    for (const entry of childItems(doc, parentId)) {
      if (entry.kind === "section") return entry.item.id;
      const nested = walk(entry.item.id);
      if (nested) return nested;
    }
    return "";
  }
  return walk(null);
}
