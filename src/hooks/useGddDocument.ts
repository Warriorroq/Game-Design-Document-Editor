import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadDocument,
  normalizeDocument,
  saveDocument,
} from "../lib/document";
import { createDemoDocument } from "../lib/demoDocument";
import { removeMembersFromGroups } from "../lib/deskGroups";
import { reorderDeskLayer } from "../lib/deskLayerOrder";
import type { DeskSelection } from "../lib/deskClipboard";
import type {
  BoardGroup,
  BoardItem,
  BoardShape,
  BoardStroke,
  BoardText,
  GddDocument,
  GddSection,
} from "../types";

const MAX_UNDO = 50;
const CONTENT_UNDO_GAP_MS = 1000;

function cloneDoc(doc: GddDocument): GddDocument {
  return structuredClone(doc);
}

export function useGddDocument() {
  const [doc, setDoc] = useState<GddDocument>(() => {
    const loaded = loadDocument();
    if (loaded && loaded.sections.length > 0) return loaded;
    const demo = createDemoDocument();
    saveDocument(demo);
    return demo;
  });
  const [activeSectionId, setActiveSectionId] = useState<string>(
    () => doc.sections[0]?.id ?? ""
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const docRef = useRef(doc);
  const undoStack = useRef<GddDocument[]>([]);
  const transientDepth = useRef(0);
  const contentUndoArmed = useRef(false);
  const contentUndoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  docRef.current = doc;

  const pushUndo = useCallback((snapshot: GddDocument) => {
    undoStack.current.push(cloneDoc(snapshot));
    if (undoStack.current.length > MAX_UNDO) {
      undoStack.current.shift();
    }
  }, []);

  const syncActiveSection = useCallback((next: GddDocument) => {
    setActiveSectionId((current) => {
      if (next.sections.some((s) => s.id === current)) return current;
      return next.sections[0]?.id ?? "";
    });
  }, []);

  const scheduleSave = useCallback((next: GddDocument) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveDocument(next);
    }, 600);
  }, []);

  const mutateDoc = useCallback(
    (
      updater: (prev: GddDocument) => GddDocument,
      options?: { recordHistory?: boolean }
    ) => {
      setDoc((prev) => {
        const next = updater(prev);
        if (next === prev) return prev;
        if (options?.recordHistory !== false && transientDepth.current === 0) {
          pushUndo(prev);
        }
        scheduleSave(next);
        return next;
      });
    },
    [pushUndo, scheduleSave]
  );

  const armContentUndo = useCallback(() => {
    if (!contentUndoArmed.current) {
      pushUndo(docRef.current);
      contentUndoArmed.current = true;
    }
    if (contentUndoTimer.current) clearTimeout(contentUndoTimer.current);
    contentUndoTimer.current = setTimeout(() => {
      contentUndoArmed.current = false;
    }, CONTENT_UNDO_GAP_MS);
  }, [pushUndo]);

  const beginTransient = useCallback(() => {
    if (transientDepth.current === 0) {
      pushUndo(docRef.current);
    }
    transientDepth.current += 1;
  }, [pushUndo]);

  const endTransient = useCallback(() => {
    transientDepth.current = Math.max(0, transientDepth.current - 1);
  }, []);

  const undo = useCallback(() => {
    const snapshot = undoStack.current.pop();
    if (!snapshot) return false;
    contentUndoArmed.current = false;
    if (contentUndoTimer.current) {
      clearTimeout(contentUndoTimer.current);
      contentUndoTimer.current = null;
    }
    setDoc(snapshot);
    scheduleSave(snapshot);
    syncActiveSection(snapshot);
    return true;
  }, [scheduleSave, syncActiveSection]);

  const updateDoc = useCallback(
    (patch: Partial<GddDocument>) => {
      mutateDoc((prev) => ({ ...prev, ...patch }));
    },
    [mutateDoc]
  );

  const updateSection = useCallback(
    (id: string, patch: Partial<GddSection>) => {
      const contentOnly =
        Object.keys(patch).length === 1 && "content" in patch;
      if (contentOnly) {
        armContentUndo();
        setDoc((prev) => {
          const next = {
            ...prev,
            sections: prev.sections.map((s) =>
              s.id === id ? { ...s, ...patch } : s
            ),
          };
          scheduleSave(next);
          return next;
        });
        return;
      }
      mutateDoc((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === id ? { ...s, ...patch } : s
        ),
      }));
    },
    [armContentUndo, mutateDoc, scheduleSave]
  );

  const addSection = useCallback(() => {
    const id = crypto.randomUUID();
    mutateDoc((prev) => ({
      ...prev,
      sections: [
        ...prev.sections,
        {
          id,
          title: "New Section",
          description: "",
          content: "",
          order: prev.sections.length,
          board: [],
          shapes: [],
          strokes: [],
          texts: [],
          groups: [],
        },
      ],
    }));
    setActiveSectionId(id);
  }, [mutateDoc]);

  const removeSection = useCallback(
    (id: string) => {
      const sections = docRef.current.sections
        .filter((s) => s.id !== id)
        .map((s, i) => ({ ...s, order: i }));

      mutateDoc((prev) => ({
        ...prev,
        sections: prev.sections
          .filter((s) => s.id !== id)
          .map((s, i) => ({ ...s, order: i })),
      }));

      setActiveSectionId((current) => {
        if (sections.length === 0) return "";
        if (current !== id) return current;
        return sections[0]?.id ?? "";
      });
    },
    [mutateDoc]
  );

  const updateBoardItem = useCallback(
    (sectionId: string, itemId: string, patch: Partial<BoardItem>) => {
      mutateDoc(
        (prev) => ({
          ...prev,
          sections: prev.sections.map((s) =>
            s.id === sectionId
              ? {
                  ...s,
                  board: s.board.map((item) =>
                    item.id === itemId ? { ...item, ...patch } : item
                  ),
                }
              : s
          ),
        }),
        { recordHistory: false }
      );
    },
    [mutateDoc]
  );

  const addBoardItem = useCallback(
    (sectionId: string, item: BoardItem) => {
      mutateDoc((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sectionId ? { ...s, board: [...s.board, item] } : s
        ),
      }));
    },
    [mutateDoc]
  );

  const removeBoardItem = useCallback(
    (sectionId: string, itemId: string) => {
      mutateDoc((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
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
      }));
    },
    [mutateDoc]
  );

  const addBoardShape = useCallback(
    (sectionId: string, shape: BoardShape) => {
      mutateDoc((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sectionId ? { ...s, shapes: [...s.shapes, shape] } : s
        ),
      }));
    },
    [mutateDoc]
  );

  const updateBoardShape = useCallback(
    (sectionId: string, shapeId: string, patch: Partial<BoardShape>) => {
      mutateDoc(
        (prev) => ({
          ...prev,
          sections: prev.sections.map((s) =>
            s.id === sectionId
              ? {
                  ...s,
                  shapes: s.shapes.map((sh) =>
                    sh.id === shapeId ? { ...sh, ...patch } : sh
                  ),
                }
              : s
          ),
        }),
        { recordHistory: false }
      );
    },
    [mutateDoc]
  );

  const removeBoardShape = useCallback(
    (sectionId: string, shapeId: string) => {
      mutateDoc((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                shapes: s.shapes.filter((sh) => sh.id !== shapeId),
                groups: removeMembersFromGroups(s.groups, [], [shapeId], [], []),
              }
            : s
        ),
      }));
    },
    [mutateDoc]
  );

  const addBoardGroup = useCallback(
    (sectionId: string, group: BoardGroup) => {
      mutateDoc((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
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
      }));
    },
    [mutateDoc]
  );

  const removeBoardGroup = useCallback(
    (sectionId: string, groupId: string) => {
      mutateDoc((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sectionId
            ? { ...s, groups: s.groups.filter((g) => g.id !== groupId) }
            : s
        ),
      }));
    },
    [mutateDoc]
  );

  const addBoardText = useCallback(
    (sectionId: string, text: BoardText) => {
      mutateDoc((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sectionId ? { ...s, texts: [...s.texts, text] } : s
        ),
      }));
    },
    [mutateDoc]
  );

  const updateBoardText = useCallback(
    (
      sectionId: string,
      textId: string,
      patch: Partial<BoardText>,
      options?: { recordHistory?: boolean }
    ) => {
      mutateDoc(
        (prev) => ({
          ...prev,
          sections: prev.sections.map((s) =>
            s.id === sectionId
              ? {
                  ...s,
                  texts: s.texts.map((t) =>
                    t.id === textId ? { ...t, ...patch } : t
                  ),
                }
              : s
          ),
        }),
        { recordHistory: options?.recordHistory === true }
      );
    },
    [mutateDoc]
  );

  const removeBoardText = useCallback(
    (sectionId: string, textId: string) => {
      mutateDoc((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                texts: s.texts.filter((t) => t.id !== textId),
                groups: removeMembersFromGroups(s.groups, [], [], [textId], []),
              }
            : s
        ),
      }));
    },
    [mutateDoc]
  );

  const addBoardStroke = useCallback(
    (sectionId: string, stroke: BoardStroke) => {
      mutateDoc((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sectionId ? { ...s, strokes: [...s.strokes, stroke] } : s
        ),
      }));
    },
    [mutateDoc]
  );

  const updateBoardStroke = useCallback(
    (sectionId: string, strokeId: string, patch: Partial<BoardStroke>) => {
      mutateDoc(
        (prev) => ({
          ...prev,
          sections: prev.sections.map((s) =>
            s.id === sectionId
              ? {
                  ...s,
                  strokes: s.strokes.map((st) =>
                    st.id === strokeId ? { ...st, ...patch } : st
                  ),
                }
              : s
          ),
        }),
        { recordHistory: false }
      );
    },
    [mutateDoc]
  );

  const removeBoardStroke = useCallback(
    (sectionId: string, strokeId: string) => {
      mutateDoc((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                strokes: s.strokes.filter((st) => st.id !== strokeId),
                groups: removeMembersFromGroups(s.groups, [], [], [], [strokeId]),
              }
            : s
        ),
      }));
    },
    [mutateDoc]
  );

  const pasteDeskContent = useCallback(
    (
      sectionId: string,
      payload: {
        items: BoardItem[];
        shapes: BoardShape[];
        texts: BoardText[];
        strokes: BoardStroke[];
        groups: BoardGroup[];
      }
    ) => {
      mutateDoc((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                board: [...s.board, ...payload.items],
                shapes: [...s.shapes, ...payload.shapes],
                texts: [...s.texts, ...payload.texts],
                strokes: [...s.strokes, ...payload.strokes],
                groups: [...s.groups, ...payload.groups],
              }
            : s
        ),
      }));
    },
    [mutateDoc]
  );

  const reorderDeskLayerOrder = useCallback(
    (sectionId: string, selection: DeskSelection, direction: "forward" | "backward") => {
      mutateDoc((prev) => ({
        ...prev,
        sections: prev.sections.map((s) => {
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
      }));
    },
    [mutateDoc]
  );

  const removeDeskSelection = useCallback(
    (
      sectionId: string,
      itemIds: string[],
      shapeIds: string[],
      textIds: string[],
      strokeIds: string[]
    ) => {
      const itemSet = new Set(itemIds);
      const shapeSet = new Set(shapeIds);
      const textSet = new Set(textIds);
      const strokeSet = new Set(strokeIds);
      mutateDoc((prev) => ({
        ...prev,
        sections: prev.sections.map((s) => {
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
                  shape.end.attach?.itemId &&
                  itemSet.has(shape.end.attach.itemId)
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
      }));
    },
    [mutateDoc]
  );

  const replaceDocument = useCallback(
    (incoming: GddDocument) => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      const next = normalizeDocument(incoming);
      undoStack.current = [];
      contentUndoArmed.current = false;
      if (contentUndoTimer.current) {
        clearTimeout(contentUndoTimer.current);
        contentUndoTimer.current = null;
      }
      setDoc(next);
      saveDocument(next);
      syncActiveSection(next);
    },
    [syncActiveSection]
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (contentUndoTimer.current) clearTimeout(contentUndoTimer.current);
    };
  }, []);

  const sectionIdsKey = doc.sections.map((s) => s.id).join("\0");

  useEffect(() => {
    syncActiveSection(doc);
  }, [sectionIdsKey, doc, syncActiveSection]);

  const activeSection =
    doc.sections.find((s) => s.id === activeSectionId) ?? doc.sections[0];

  return {
    doc,
    activeSection,
    activeSectionId,
    setActiveSectionId,
    updateDoc,
    updateSection,
    addSection,
    removeSection,
    updateBoardItem,
    addBoardItem,
    removeBoardItem,
    addBoardShape,
    updateBoardShape,
    removeBoardShape,
    addBoardText,
    updateBoardText,
    removeBoardText,
    addBoardStroke,
    updateBoardStroke,
    removeBoardStroke,
    addBoardGroup,
    removeBoardGroup,
    pasteDeskContent,
    reorderDeskLayerOrder,
    removeDeskSelection,
    undo,
    beginTransient,
    endTransient,
    replaceDocument,
  };
}
