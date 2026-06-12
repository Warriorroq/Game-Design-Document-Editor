import type { RefObject } from "react";
import { DocumentMeta } from "@/features/editor/DocumentMeta";
import { ImageBoard } from "@/features/board/ImageBoard";
import { CompactPaneToggle } from "@/shared/components/CompactPaneToggle";
import { PanelSplitter } from "@/shared/components/PanelSplitter";
import { useCompactPane } from "@/shared/hooks/useCompactPane";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { COMPACT_LAYOUT_MEDIA } from "@/shared/lib/panelLayout";
import { SectionEditor } from "@/features/editor/SectionEditor";
import { Sidebar } from "@/features/sidebar/Sidebar";
import { Space3DView } from "@/features/space3d/Space3DView";
import { isSpace3DSection } from "@/domain/space3d/space3d";
import { resolveBoardItemSrc } from "@/domain/board/boardImageRegistry";
import { restoreAppFocus } from "@/infrastructure/desktop/desktop";
import { panelFlexStyle } from "@/shared/hooks/useResizablePanels";
import type { DocumentStore } from "@/application/document/useDocumentStore";
import type { SearchFocusTarget } from "@/features/search/lib/globalSearch";
import type { GddSection, GddSectionFolder } from "@/domain/types";
import type { DeskClipboard } from "@/domain/board/deskClipboard";
import "@/features/space3d/Space3D.css";

export interface EditorLayoutProps {
  doc: DocumentStore["doc"];
  activeSection: GddSection | undefined;
  activeSectionId: string;
  folders: GddSectionFolder[];
  sidebarVisible: boolean;
  mainRef: RefObject<HTMLDivElement | null>;
  editorWidth: number;
  boardWidth: number;
  editorHidden: boolean;
  boardHidden: boolean;
  draggingEditor: boolean;
  draggingBoard: boolean;
  scrollAnchorId: string | undefined;
  highlightMediaId: string | undefined;
  highlightTextId: string | undefined;
  searchFocus: SearchFocusTarget | null;
  deskClipboard: DeskClipboard | null;
  emptyLabel: string;
  addSectionLabel: string;
  onSelectSection: (id: string) => void;
  onAddSection: (folderId?: string) => void;
  onAddSpace3DSection: (folderId?: string) => void;
  onAddFolder: (parentFolderId?: string) => void;
  onRemoveSection: (id: string) => void;
  onRemoveFolder: (id: string) => void;
  onUpdateFolder: DocumentStore["updateFolder"];
  onToggleFolder: DocumentStore["toggleFolderCollapsed"];
  onReorderSidebar: DocumentStore["reorderSidebar"];
  onEditorSplitterDown: (e: React.PointerEvent) => void;
  onBoardSplitterDown: (e: React.PointerEvent) => void;
  onEditorSplitterDoubleClick: () => void;
  onBoardSplitterDoubleClick: () => void;
  onUpdateDoc: DocumentStore["updateDoc"];
  onUpdateSection: DocumentStore["updateSection"];
  onScrollAnchorDone: () => void;
  onSearchFocusDone: () => void;
  onHighlightDone: () => void;
  onAddBoardItem: DocumentStore["addBoardItem"];
  onUpdateBoardItem: DocumentStore["updateBoardItem"];
  onRemoveBoardItem: DocumentStore["removeBoardItem"];
  onAddBoardShape: DocumentStore["addBoardShape"];
  onUpdateBoardShape: DocumentStore["updateBoardShape"];
  onRemoveBoardShape: DocumentStore["removeBoardShape"];
  onAddBoardText: DocumentStore["addBoardText"];
  onUpdateBoardText: DocumentStore["updateBoardText"];
  onRemoveBoardText: DocumentStore["removeBoardText"];
  onAddBoardStroke: DocumentStore["addBoardStroke"];
  onUpdateBoardStroke: DocumentStore["updateBoardStroke"];
  onRemoveBoardStroke: DocumentStore["removeBoardStroke"];
  onAddBoardGroup: DocumentStore["addBoardGroup"];
  onRemoveBoardGroup: DocumentStore["removeBoardGroup"];
  onPasteDesk: DocumentStore["pasteDeskContent"];
  onReorderLayer: DocumentStore["reorderDeskLayerOrder"];
  onRemoveSelection: DocumentStore["removeDeskSelection"];
  onStoreDeskClipboard: DocumentStore["storeDeskClipboard"];
  onBeginTransientEdit: DocumentStore["beginTransient"];
  onEndTransientEdit: DocumentStore["endTransient"];
  onAddSpace3DModel: DocumentStore["addSpace3DModel"];
  onRemoveSpace3DModelAsset: DocumentStore["removeSpace3DModelAsset"];
  onRenameSpace3DModelAsset: DocumentStore["updateSpace3DModelAssetName"];
}

export function EditorLayout({
  doc,
  activeSection,
  activeSectionId,
  folders,
  sidebarVisible,
  mainRef,
  editorWidth,
  boardWidth,
  editorHidden,
  boardHidden,
  draggingEditor,
  draggingBoard,
  scrollAnchorId,
  highlightMediaId,
  highlightTextId,
  searchFocus,
  deskClipboard,
  emptyLabel,
  addSectionLabel,
  onSelectSection,
  onAddSection,
  onAddSpace3DSection,
  onAddFolder,
  onRemoveSection,
  onRemoveFolder,
  onUpdateFolder,
  onToggleFolder,
  onReorderSidebar,
  onEditorSplitterDown,
  onBoardSplitterDown,
  onEditorSplitterDoubleClick,
  onBoardSplitterDoubleClick,
  onUpdateDoc,
  onUpdateSection,
  onScrollAnchorDone,
  onSearchFocusDone,
  onHighlightDone,
  onAddBoardItem,
  onUpdateBoardItem,
  onRemoveBoardItem,
  onAddBoardShape,
  onUpdateBoardShape,
  onRemoveBoardShape,
  onAddBoardText,
  onUpdateBoardText,
  onRemoveBoardText,
  onAddBoardStroke,
  onUpdateBoardStroke,
  onRemoveBoardStroke,
  onAddBoardGroup,
  onRemoveBoardGroup,
  onPasteDesk,
  onReorderLayer,
  onRemoveSelection,
  onStoreDeskClipboard,
  onBeginTransientEdit,
  onEndTransientEdit,
  onAddSpace3DModel,
  onRemoveSpace3DModelAsset,
  onRenameSpace3DModelAsset,
}: EditorLayoutProps) {
  const isSpace3D = activeSection ? isSpace3DSection(activeSection) : false;
  const resizingPanels = draggingEditor || draggingBoard;
  const compactLayout = useMediaQuery(COMPACT_LAYOUT_MEDIA);
  const { compactPane, setCompactPane } = useCompactPane();
  const showCompactSwitch = compactLayout && !isSpace3D;
  const compactEditorFull = showCompactSwitch && compactPane === "editor";
  const compactBoardFull = showCompactSwitch && compactPane === "board";
  const hideEditorPane = editorHidden || compactBoardFull;
  const hideBoardPane = (boardHidden && !isSpace3D) || compactEditorFull;

  const mainPanelClass = [
    "main-panel",
    isSpace3D ? "main-panel--space3d" : "",
    showCompactSwitch ? `main-panel--compact main-panel--compact-${compactPane}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const compactFlex = {
    flex: "1 1 auto",
    alignSelf: "stretch",
    width: "100%",
    minWidth: "0",
    flexShrink: 1,
  } as const;

  return (
    <div className="app-body">
      <Sidebar
        hidden={!sidebarVisible}
        folders={folders}
        sections={doc.sections}
        activeId={activeSectionId}
        onSelect={onSelectSection}
        onAddSection={onAddSection}
        onAddSpace3DSection={onAddSpace3DSection}
        onAddFolder={onAddFolder}
        onRemove={onRemoveSection}
        onRemoveFolder={onRemoveFolder}
        onUpdateFolder={onUpdateFolder}
        onToggleFolder={onToggleFolder}
        onReorder={onReorderSidebar}
      />
      <div ref={mainRef} className={mainPanelClass}>
        {showCompactSwitch && (
          <CompactPaneToggle value={compactPane} onChange={setCompactPane} />
        )}
        {!isSpace3D && !compactLayout && (
          <PanelSplitter
            edge="start"
            hidden={editorHidden}
            dragging={draggingEditor}
            onPointerDown={onEditorSplitterDown}
            onDoubleClick={onEditorSplitterDoubleClick}
          />
        )}

        {!isSpace3D && (
          <div
            className={`content-column ${hideEditorPane ? "content-column--hidden" : ""}`}
            style={
              compactEditorFull
                ? compactFlex
                : panelFlexStyle(editorHidden, editorWidth, 280, resizingPanels)
            }
          >
            {!hideEditorPane && (
              <div className="content-column-scroll">
                <DocumentMeta doc={doc} onChange={onUpdateDoc} />
                <div className="editor-pane" key={activeSection?.id ?? "no-section"}>
                  {activeSection ? (
                    <SectionEditor
                      key={activeSection.id}
                      section={activeSection}
                      scrollToAnchorId={scrollAnchorId}
                      onScrollAnchorDone={onScrollAnchorDone}
                      searchFocus={
                        searchFocus?.sectionId === activeSection.id
                          ? searchFocus
                          : null
                      }
                      onSearchFocusDone={onSearchFocusDone}
                      onChange={(patch) => onUpdateSection(activeSection.id, patch)}
                    />
                  ) : (
                    <div className="editor-empty">
                      <p>{emptyLabel}</p>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          onAddSection();
                          restoreAppFocus();
                        }}
                      >
                        {addSectionLabel}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {!isSpace3D && !compactLayout && (
          <PanelSplitter
            edge="end"
            hidden={boardHidden}
            dragging={draggingBoard}
            onPointerDown={onBoardSplitterDown}
            onDoubleClick={onBoardSplitterDoubleClick}
          />
        )}

        <div
          className={`board-pane ${hideBoardPane ? "board-pane--hidden" : ""}`}
          style={
            isSpace3D
              ? { flex: "1 1 auto", width: "100%" }
              : compactBoardFull
                ? compactFlex
                : panelFlexStyle(boardHidden, boardWidth, 160, resizingPanels)
          }
        >
          {(isSpace3D || !hideBoardPane) &&
            (activeSection ? (
              isSpace3D ? (
                <Space3DView
                  key={activeSection.id}
                  doc={doc}
                  section={activeSection}
                  onChange={(patch) => onUpdateSection(activeSection.id, patch)}
                  onAddModel={onAddSpace3DModel}
                  onRemoveModelAsset={onRemoveSpace3DModelAsset}
                  onRenameModelAsset={onRenameSpace3DModelAsset}
                  onBeginTransientEdit={onBeginTransientEdit}
                  onEndTransientEdit={onEndTransientEdit}
                />
              ) : (
              <ImageBoard
                key={activeSection.id}
                projectId={doc.id}
                sectionId={activeSection.id}
                items={activeSection.board}
                shapes={activeSection.shapes}
                strokes={activeSection.strokes}
                texts={activeSection.texts}
                groups={activeSection.groups}
                highlightMediaId={highlightMediaId}
                highlightTextId={highlightTextId}
                onHighlightDone={onHighlightDone}
                onAdd={(item) => onAddBoardItem(activeSection.id, item)}
                onUpdate={(itemId, patch) =>
                  onUpdateBoardItem(activeSection.id, itemId, patch)
                }
                onRemove={(itemId) => onRemoveBoardItem(activeSection.id, itemId)}
                onAddShape={(shape) => onAddBoardShape(activeSection.id, shape)}
                onUpdateShape={(shapeId, patch) =>
                  onUpdateBoardShape(activeSection.id, shapeId, patch)
                }
                onRemoveShape={(shapeId) =>
                  onRemoveBoardShape(activeSection.id, shapeId)
                }
                onAddText={(text) => onAddBoardText(activeSection.id, text)}
                onUpdateText={(textId, patch, options) =>
                  onUpdateBoardText(activeSection.id, textId, patch, options)
                }
                onRemoveText={(textId) => onRemoveBoardText(activeSection.id, textId)}
                onAddStroke={(stroke) => onAddBoardStroke(activeSection.id, stroke)}
                onUpdateStroke={(strokeId, patch) =>
                  onUpdateBoardStroke(activeSection.id, strokeId, patch)
                }
                onRemoveStroke={(strokeId) =>
                  onRemoveBoardStroke(activeSection.id, strokeId)
                }
                onAddGroup={(group) => onAddBoardGroup(activeSection.id, group)}
                onRemoveGroup={(groupId) =>
                  onRemoveBoardGroup(activeSection.id, groupId)
                }
                onPasteDesk={(payload) => onPasteDesk(activeSection.id, payload)}
                onReorderLayer={(selection, direction) =>
                  onReorderLayer(activeSection.id, selection, direction)
                }
                onRemoveSelection={(itemIds, shapeIds, textIds, strokeIds) =>
                  onRemoveSelection(
                    activeSection.id,
                    itemIds,
                    shapeIds,
                    textIds,
                    strokeIds
                  )
                }
                resolveItemSrc={(item) => resolveBoardItemSrc(doc, item)}
                deskClipboard={deskClipboard}
                onStoreDeskClipboard={onStoreDeskClipboard}
                onBeginTransientEdit={onBeginTransientEdit}
                onEndTransientEdit={onEndTransientEdit}
              />
              )
            ) : (
              <div className="board-empty" aria-hidden />
            ))}
        </div>
      </div>
    </div>
  );
}
