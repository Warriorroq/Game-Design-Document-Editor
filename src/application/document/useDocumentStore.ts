import { useCallback, useEffect, useRef, useState } from "react";
import { createDocument, normalizeDocument } from "@/domain/document/document";
import * as mutations from "@/domain/document/mutations";
import type { SidebarDropTarget } from "@/domain/sidebar/sidebarOrder";
import { firstSectionId } from "@/domain/sidebar/sidebarOrder";
import {
  loadDocument,
  saveDocument,
} from "@/infrastructure/persistence/webDocumentStorage";
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
import type { DeskClipboard, DeskSelection } from "@/domain/board/deskClipboard";

const MAX_UNDO = 50;
const CONTENT_UNDO_GAP_MS = 1000;

function cloneDoc(doc: GddDocument): GddDocument {
  return structuredClone(doc);
}

export function useDocumentStore() {
  const [doc, setDoc] = useState<GddDocument>(() => {
    const loaded = loadDocument();
    if (loaded) return loaded;
    const fresh = createDocument();
    saveDocument(fresh);
    return fresh;
  });
  const [activeSectionId, setActiveSectionId] = useState<string>(
    () => doc.sections[0]?.id ?? ""
  );
  const [deskClipboard, setDeskClipboard] = useState<DeskClipboard | null>(null);
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
      mutateDoc((prev) => mutations.patchDocument(prev, patch));
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
          const next = mutations.patchSection(prev, id, patch);
          scheduleSave(next);
          return next;
        });
        return;
      }
      mutateDoc((prev) => mutations.patchSection(prev, id, patch));
    },
    [armContentUndo, mutateDoc, scheduleSave]
  );

  const addSection = useCallback(
    (folderId?: string) => {
      const { doc: next, sectionId } = mutations.addSection(docRef.current, folderId);
      mutateDoc(() => next);
      setActiveSectionId(sectionId);
    },
    [mutateDoc]
  );

  const addSpace3DSection = useCallback(
    (folderId?: string) => {
      const { doc: next, sectionId } = mutations.addSection(
        docRef.current,
        folderId,
        "space3d"
      );
      mutateDoc(() => next);
      setActiveSectionId(sectionId);
    },
    [mutateDoc]
  );

  const addFolder = useCallback(
    (parentFolderId?: string) => {
      mutateDoc((prev) => mutations.addFolder(prev, parentFolderId));
    },
    [mutateDoc]
  );

  const updateFolder = useCallback(
    (id: string, patch: Partial<GddSectionFolder>) => {
      mutateDoc((prev) => mutations.patchFolder(prev, id, patch));
    },
    [mutateDoc]
  );

  const toggleFolderCollapsed = useCallback(
    (id: string) => {
      mutateDoc((prev) => mutations.toggleFolderCollapsed(prev, id));
    },
    [mutateDoc]
  );

  const removeFolder = useCallback(
    (id: string) => {
      mutateDoc((prev) => mutations.removeFolder(prev, id));
    },
    [mutateDoc]
  );

  const reorderSidebar = useCallback(
    (
      drag: { kind: "section" | "folder"; id: string },
      target: SidebarDropTarget
    ) => {
      mutateDoc((prev) => mutations.reorderSidebar(prev, drag, target));
    },
    [mutateDoc]
  );

  const removeSection = useCallback(
    (id: string) => {
      const nextDoc = mutations.removeSection(docRef.current, id);
      mutateDoc((prev) => mutations.removeSection(prev, id));
      setActiveSectionId((current) => {
        if (nextDoc.sections.length === 0) return "";
        if (current !== id) return current;
        return firstSectionId(nextDoc);
      });
    },
    [mutateDoc]
  );

  const updateBoardItem = useCallback(
    (sectionId: string, itemId: string, patch: Partial<BoardItem>) => {
      mutateDoc(
        (prev) => mutations.patchBoardItem(prev, sectionId, itemId, patch),
        { recordHistory: false }
      );
    },
    [mutateDoc]
  );

  const addBoardItem = useCallback(
    (sectionId: string, item: BoardItem) => {
      mutateDoc((prev) => mutations.addBoardItem(prev, sectionId, item));
    },
    [mutateDoc]
  );

  const removeBoardItem = useCallback(
    (sectionId: string, itemId: string) => {
      mutateDoc((prev) => mutations.removeBoardItem(prev, sectionId, itemId));
    },
    [mutateDoc]
  );

  const addBoardShape = useCallback(
    (sectionId: string, shape: BoardShape) => {
      mutateDoc((prev) => mutations.addBoardShape(prev, sectionId, shape));
    },
    [mutateDoc]
  );

  const updateBoardShape = useCallback(
    (sectionId: string, shapeId: string, patch: Partial<BoardShape>) => {
      mutateDoc(
        (prev) => mutations.patchBoardShape(prev, sectionId, shapeId, patch),
        { recordHistory: false }
      );
    },
    [mutateDoc]
  );

  const removeBoardShape = useCallback(
    (sectionId: string, shapeId: string) => {
      mutateDoc((prev) => mutations.removeBoardShape(prev, sectionId, shapeId));
    },
    [mutateDoc]
  );

  const addBoardGroup = useCallback(
    (sectionId: string, group: BoardGroup) => {
      mutateDoc((prev) => mutations.addBoardGroup(prev, sectionId, group));
    },
    [mutateDoc]
  );

  const removeBoardGroup = useCallback(
    (sectionId: string, groupId: string) => {
      mutateDoc((prev) => mutations.removeBoardGroup(prev, sectionId, groupId));
    },
    [mutateDoc]
  );

  const addBoardText = useCallback(
    (sectionId: string, text: BoardText) => {
      mutateDoc((prev) => mutations.addBoardText(prev, sectionId, text));
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
        (prev) => mutations.patchBoardText(prev, sectionId, textId, patch),
        { recordHistory: options?.recordHistory === true }
      );
    },
    [mutateDoc]
  );

  const removeBoardText = useCallback(
    (sectionId: string, textId: string) => {
      mutateDoc((prev) => mutations.removeBoardText(prev, sectionId, textId));
    },
    [mutateDoc]
  );

  const addBoardStroke = useCallback(
    (sectionId: string, stroke: BoardStroke) => {
      mutateDoc((prev) => mutations.addBoardStroke(prev, sectionId, stroke));
    },
    [mutateDoc]
  );

  const updateBoardStroke = useCallback(
    (sectionId: string, strokeId: string, patch: Partial<BoardStroke>) => {
      mutateDoc(
        (prev) => mutations.patchBoardStroke(prev, sectionId, strokeId, patch),
        { recordHistory: false }
      );
    },
    [mutateDoc]
  );

  const removeBoardStroke = useCallback(
    (sectionId: string, strokeId: string) => {
      mutateDoc((prev) => mutations.removeBoardStroke(prev, sectionId, strokeId));
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
      mutateDoc((prev) => mutations.pasteDeskContent(prev, sectionId, payload));
    },
    [mutateDoc]
  );

  const reorderDeskLayerOrder = useCallback(
    (sectionId: string, selection: DeskSelection, direction: "forward" | "backward") => {
      mutateDoc((prev) =>
        mutations.reorderDeskLayerOrder(prev, sectionId, selection, direction)
      );
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
      mutateDoc((prev) =>
        mutations.removeDeskSelection(
          prev,
          sectionId,
          itemIds,
          shapeIds,
          textIds,
          strokeIds
        )
      );
    },
    [mutateDoc]
  );

  const removeBoardImageAsset = useCallback(
    (assetId: string) => {
      mutateDoc((prev) => mutations.removeBoardImageAsset(prev, assetId));
    },
    [mutateDoc]
  );

  const updateBoardImageAssetName = useCallback(
    (assetId: string, name: string) => {
      mutateDoc((prev) => mutations.renameBoardImageAsset(prev, assetId, name));
    },
    [mutateDoc]
  );

  const addSpace3DModel = useCallback(
    (src: string, name?: string): string => {
      let assetId = "";
      mutateDoc((prev) => {
        const result = mutations.addSpace3DModel(prev, src, name);
        assetId = result.assetId;
        return result.doc;
      });
      return assetId;
    },
    [mutateDoc]
  );

  const removeSpace3DModelAsset = useCallback(
    (assetId: string) => {
      mutateDoc((prev) => mutations.removeSpace3DModelAsset(prev, assetId));
    },
    [mutateDoc]
  );

  const updateSpace3DModelAssetName = useCallback(
    (assetId: string, name: string) => {
      mutateDoc((prev) => mutations.renameSpace3DModelAsset(prev, assetId, name));
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
      setDeskClipboard(null);
    },
    [syncActiveSection]
  );

  const newProject = useCallback(() => {
    replaceDocument(createDocument());
  }, [replaceDocument]);

  const storeDeskClipboard = useCallback((clip: DeskClipboard | null) => {
    setDeskClipboard(clip);
  }, []);

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
    addSpace3DSection,
    addFolder,
    updateFolder,
    toggleFolderCollapsed,
    removeFolder,
    reorderSidebar,
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
    deskClipboard,
    storeDeskClipboard,
    pasteDeskContent,
    reorderDeskLayerOrder,
    removeDeskSelection,
    removeBoardImageAsset,
    updateBoardImageAssetName,
    addSpace3DModel,
    removeSpace3DModelAsset,
    updateSpace3DModelAssetName,
    undo,
    beginTransient,
    endTransient,
    replaceDocument,
    newProject,
  };
}

export type DocumentStore = ReturnType<typeof useDocumentStore>;
