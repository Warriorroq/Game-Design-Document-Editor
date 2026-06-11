import { removeMembersFromGroups } from "@/domain/board/deskGroups";
import { reorderDeskLayer } from "@/domain/board/deskLayerOrder";
import {
  deleteBoardImageAsset,
  prepareBoardItemForDoc,
  prepareBoardItemsForDoc,
  updateBoardImageAssetName,
} from "@/domain/board/boardImageRegistry";
import {
  deleteSpace3DModelAsset,
  registerSpace3DModel,
  updateSpace3DModelAssetName,
} from "@/domain/space3d/modelRegistry";
import {
  applySidebarDrop,
  nextChildOrder,
  removeFolderFromDoc,
  removeSectionFromDoc,
  type SidebarDropTarget,
} from "@/domain/sidebar/sidebarOrder";
import type { DeskClipboard, DeskSelection } from "@/domain/board/deskClipboard";
import type {
  BoardGroup,
  BoardItem,
  BoardShape,
  BoardStroke,
  BoardText,
  GddDocument,
  GddSection,
  GddSectionFolder,
} from "@/domain/types";

export function patchDocument(
  doc: GddDocument,
  patch: Partial<GddDocument>
): GddDocument {
  return { ...doc, ...patch };
}

export function patchSection(
  doc: GddDocument,
  id: string,
  patch: Partial<GddSection>
): GddDocument {
  return {
    ...doc,
    sections: doc.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
  };
}

export function addSection(
  doc: GddDocument,
  folderId?: string,
  kind: GddSection["kind"] = "document"
): { doc: GddDocument; sectionId: string } {
  const id = crypto.randomUUID();
  const order = nextChildOrder(doc, folderId ?? null);
  const isSpace3D = kind === "space3d";
  return {
    sectionId: id,
    doc: {
      ...doc,
      sections: [
        ...doc.sections,
        {
          id,
          title: isSpace3D ? "3D Space" : "New Section",
          description: "",
          content: "",
          order,
          folderId,
          kind: isSpace3D ? "space3d" : undefined,
          space3d: isSpace3D ? { objects: [] } : undefined,
          board: [],
          shapes: [],
          strokes: [],
          texts: [],
          groups: [],
        },
      ],
    },
  };
}

export function addFolder(
  doc: GddDocument,
  parentFolderId?: string
): GddDocument {
  const id = crypto.randomUUID();
  return {
    ...doc,
    folders: [
      ...(doc.folders ?? []),
      {
        id,
        title: "New Folder",
        order: nextChildOrder(doc, parentFolderId ?? null),
        parentFolderId,
      },
    ],
  };
}

export function patchFolder(
  doc: GddDocument,
  id: string,
  patch: Partial<GddSectionFolder>
): GddDocument {
  return {
    ...doc,
    folders: (doc.folders ?? []).map((folder) =>
      folder.id === id ? { ...folder, ...patch } : folder
    ),
  };
}

export function toggleFolderCollapsed(doc: GddDocument, id: string): GddDocument {
  return {
    ...doc,
    folders: (doc.folders ?? []).map((folder) =>
      folder.id === id ? { ...folder, collapsed: !folder.collapsed } : folder
    ),
  };
}

export function removeFolder(doc: GddDocument, id: string): GddDocument {
  return removeFolderFromDoc(doc, id);
}

export function reorderSidebar(
  doc: GddDocument,
  drag: { kind: "section" | "folder"; id: string },
  target: SidebarDropTarget
): GddDocument {
  return applySidebarDrop(doc, drag, target) ?? doc;
}

export function removeSection(doc: GddDocument, id: string): GddDocument {
  return removeSectionFromDoc(doc, id);
}

export function patchBoardItem(
  doc: GddDocument,
  sectionId: string,
  itemId: string,
  patch: Partial<BoardItem>
): GddDocument {
  return {
    ...doc,
    sections: doc.sections.map((s) =>
      s.id === sectionId
        ? {
            ...s,
            board: s.board.map((item) =>
              item.id === itemId ? { ...item, ...patch } : item
            ),
          }
        : s
    ),
  };
}

export function addBoardItem(
  doc: GddDocument,
  sectionId: string,
  item: BoardItem
): GddDocument {
  const { doc: withAsset, item: normalized } = prepareBoardItemForDoc(doc, item);
  return {
    ...withAsset,
    sections: withAsset.sections.map((s) =>
      s.id === sectionId ? { ...s, board: [...s.board, normalized] } : s
    ),
  };
}

export function removeBoardItem(
  doc: GddDocument,
  sectionId: string,
  itemId: string
): GddDocument {
  return {
    ...doc,
    sections: doc.sections.map((s) =>
      s.id === sectionId
        ? {
            ...s,
            board: s.board.filter((item) => item.id !== itemId),
            groups: removeMembersFromGroups(s.groups, [itemId], [], [], []),
            shapes: s.shapes.map((shape) => ({
              ...shape,
              start:
                shape.start.attach?.itemId === itemId
                  ? { x: shape.start.x, y: shape.start.y }
                  : shape.start,
              end:
                shape.end.attach?.itemId === itemId
                  ? { x: shape.end.x, y: shape.end.y }
                  : shape.end,
            })),
          }
        : s
    ),
  };
}

export function addBoardShape(
  doc: GddDocument,
  sectionId: string,
  shape: BoardShape
): GddDocument {
  return {
    ...doc,
    sections: doc.sections.map((s) =>
      s.id === sectionId ? { ...s, shapes: [...s.shapes, shape] } : s
    ),
  };
}

export function patchBoardShape(
  doc: GddDocument,
  sectionId: string,
  shapeId: string,
  patch: Partial<BoardShape>
): GddDocument {
  return {
    ...doc,
    sections: doc.sections.map((s) =>
      s.id === sectionId
        ? {
            ...s,
            shapes: s.shapes.map((sh) =>
              sh.id === shapeId ? { ...sh, ...patch } : sh
            ),
          }
        : s
    ),
  };
}

export function removeBoardShape(
  doc: GddDocument,
  sectionId: string,
  shapeId: string
): GddDocument {
  return {
    ...doc,
    sections: doc.sections.map((s) =>
      s.id === sectionId
        ? {
            ...s,
            shapes: s.shapes.filter((sh) => sh.id !== shapeId),
            groups: removeMembersFromGroups(s.groups, [], [shapeId], [], []),
          }
        : s
    ),
  };
}

export function addBoardGroup(
  doc: GddDocument,
  sectionId: string,
  group: BoardGroup
): GddDocument {
  return {
    ...doc,
    sections: doc.sections.map((s) =>
      s.id === sectionId
        ? {
            ...s,
            groups: [
              ...removeMembersFromGroups(
                s.groups,
                group.memberItemIds,
                group.memberShapeIds,
                group.memberTextIds,
                group.memberStrokeIds
              ),
              group,
            ],
          }
        : s
    ),
  };
}

export function removeBoardGroup(
  doc: GddDocument,
  sectionId: string,
  groupId: string
): GddDocument {
  return {
    ...doc,
    sections: doc.sections.map((s) =>
      s.id === sectionId
        ? { ...s, groups: s.groups.filter((g) => g.id !== groupId) }
        : s
    ),
  };
}

export function addBoardText(
  doc: GddDocument,
  sectionId: string,
  text: BoardText
): GddDocument {
  return {
    ...doc,
    sections: doc.sections.map((s) =>
      s.id === sectionId ? { ...s, texts: [...s.texts, text] } : s
    ),
  };
}

export function patchBoardText(
  doc: GddDocument,
  sectionId: string,
  textId: string,
  patch: Partial<BoardText>
): GddDocument {
  return {
    ...doc,
    sections: doc.sections.map((s) =>
      s.id === sectionId
        ? {
            ...s,
            texts: s.texts.map((t) =>
              t.id === textId ? { ...t, ...patch } : t
            ),
          }
        : s
    ),
  };
}

export function removeBoardText(
  doc: GddDocument,
  sectionId: string,
  textId: string
): GddDocument {
  return {
    ...doc,
    sections: doc.sections.map((s) =>
      s.id === sectionId
        ? {
            ...s,
            texts: s.texts.filter((t) => t.id !== textId),
            groups: removeMembersFromGroups(s.groups, [], [], [textId], []),
          }
        : s
    ),
  };
}

export function addBoardStroke(
  doc: GddDocument,
  sectionId: string,
  stroke: BoardStroke
): GddDocument {
  return {
    ...doc,
    sections: doc.sections.map((s) =>
      s.id === sectionId ? { ...s, strokes: [...s.strokes, stroke] } : s
    ),
  };
}

export function patchBoardStroke(
  doc: GddDocument,
  sectionId: string,
  strokeId: string,
  patch: Partial<BoardStroke>
): GddDocument {
  return {
    ...doc,
    sections: doc.sections.map((s) =>
      s.id === sectionId
        ? {
            ...s,
            strokes: s.strokes.map((st) =>
              st.id === strokeId ? { ...st, ...patch } : st
            ),
          }
        : s
    ),
  };
}

export function removeBoardStroke(
  doc: GddDocument,
  sectionId: string,
  strokeId: string
): GddDocument {
  return {
    ...doc,
    sections: doc.sections.map((s) =>
      s.id === sectionId
        ? {
            ...s,
            strokes: s.strokes.filter((st) => st.id !== strokeId),
            groups: removeMembersFromGroups(s.groups, [], [], [], [strokeId]),
          }
        : s
    ),
  };
}

export function pasteDeskContent(
  doc: GddDocument,
  sectionId: string,
  payload: {
    items: BoardItem[];
    shapes: BoardShape[];
    texts: BoardText[];
    strokes: BoardStroke[];
    groups: BoardGroup[];
  }
): GddDocument {
  const { doc: withAssets, items } = prepareBoardItemsForDoc(doc, payload.items);
  return {
    ...withAssets,
    sections: withAssets.sections.map((s) =>
      s.id === sectionId
        ? {
            ...s,
            board: [...s.board, ...items],
            shapes: [...s.shapes, ...payload.shapes],
            texts: [...s.texts, ...payload.texts],
            strokes: [...s.strokes, ...payload.strokes],
            groups: [...s.groups, ...payload.groups],
          }
        : s
    ),
  };
}

export function reorderDeskLayerOrder(
  doc: GddDocument,
  sectionId: string,
  selection: DeskSelection,
  direction: "forward" | "backward"
): GddDocument {
  return {
    ...doc,
    sections: doc.sections.map((s) => {
      if (s.id !== sectionId) return s;
      const next = reorderDeskLayer(
        {
          items: s.board,
          shapes: s.shapes,
          texts: s.texts,
          strokes: s.strokes,
        },
        selection,
        direction
      );
      return {
        ...s,
        board: next.items,
        shapes: next.shapes,
        texts: next.texts,
        strokes: next.strokes,
      };
    }),
  };
}

export function removeDeskSelection(
  doc: GddDocument,
  sectionId: string,
  itemIds: string[],
  shapeIds: string[],
  textIds: string[],
  strokeIds: string[]
): GddDocument {
  const itemSet = new Set(itemIds);
  const shapeSet = new Set(shapeIds);
  const textSet = new Set(textIds);
  const strokeSet = new Set(strokeIds);
  return {
    ...doc,
    sections: doc.sections.map((s) => {
      if (s.id !== sectionId) return s;
      return {
        ...s,
        board: s.board.filter((item) => !itemSet.has(item.id)),
        texts: s.texts.filter((t) => !textSet.has(t.id)),
        strokes: s.strokes.filter((st) => !strokeSet.has(st.id)),
        shapes: s.shapes
          .filter((sh) => !shapeSet.has(sh.id))
          .map((shape) => ({
            ...shape,
            start:
              shape.start.attach?.itemId &&
              itemSet.has(shape.start.attach.itemId)
                ? { x: shape.start.x, y: shape.start.y }
                : shape.start,
            end:
              shape.end.attach?.itemId && itemSet.has(shape.end.attach.itemId)
                ? { x: shape.end.x, y: shape.end.y }
                : shape.end,
          })),
        groups: removeMembersFromGroups(
          s.groups,
          itemIds,
          shapeIds,
          textIds,
          strokeIds
        ),
      };
    }),
  };
}

export function removeBoardImageAsset(doc: GddDocument, assetId: string): GddDocument {
  return deleteBoardImageAsset(doc, assetId);
}

export function renameBoardImageAsset(
  doc: GddDocument,
  assetId: string,
  name: string
): GddDocument {
  return updateBoardImageAssetName(doc, assetId, name);
}

export function addSpace3DModel(
  doc: GddDocument,
  src: string,
  name?: string
): { doc: GddDocument; assetId: string } {
  return registerSpace3DModel(doc, src, name);
}

export function removeSpace3DModelAsset(doc: GddDocument, assetId: string): GddDocument {
  return deleteSpace3DModelAsset(doc, assetId);
}

export function renameSpace3DModelAsset(
  doc: GddDocument,
  assetId: string,
  name: string
): GddDocument {
  return updateSpace3DModelAssetName(doc, assetId, name);
}

export type { DeskClipboard, DeskSelection };
