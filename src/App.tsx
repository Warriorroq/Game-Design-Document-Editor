import { useCallback, useEffect, useMemo, useState } from "react";
import "./components/App.css";
import { DocumentMeta } from "./components/DocumentMeta";
import { ImageBoard } from "./components/ImageBoard";
import { LinkContextMenu } from "./components/LinkContextMenu";
import { LinkPasteDialog } from "./components/LinkPasteDialog";
import { LinkPreviewLayer } from "./components/LinkPreviewLayer";
import { PanelSplitter } from "./components/PanelSplitter";
import { SectionEditor } from "./components/SectionEditor";
import { SettingsPage } from "./components/SettingsPage";
import { Sidebar } from "./components/Sidebar";
import { Toolbar } from "./components/Toolbar";
import { BoardSizeProvider } from "./context/BoardSizeContext";
import { LinkProvider, useLinkContext } from "./context/LinkContext";
import { LocaleProvider, useLocale } from "./context/LocaleContext";
import { ShortcutsProvider, useShortcuts } from "./context/ShortcutsContext";
import { useGddDocument } from "./hooks/useGddDocument";
import { useProjectFolder } from "./hooks/useProjectFolder";
import {
  panelFlexStyle,
  useResizablePanels,
} from "./hooks/useResizablePanels";
import {
  searchDocument,
  type GlobalSearchResult,
  type SearchFocusTarget,
} from "./lib/globalSearch";
import { useSidebarVisible } from "./hooks/useSidebarVisible";
import { restoreAppFocus } from "./lib/desktop";
import { importAsNewProject } from "./lib/document";
import type { GddDocument } from "./types";

type AppView = "editor" | "settings";

type GddState = ReturnType<typeof useGddDocument>;

function AppMain({
  doc,
  activeSection,
  activeSectionId,
  setActiveSectionId,
  updateDoc,
  updateSection,
  addSection,
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
  pasteDeskContent,
  reorderDeskLayerOrder,
  removeDeskSelection,
  undo,
  beginTransient,
  endTransient,
  replaceDocument,
  newProject,
}: GddState) {
  const [view, setView] = useState<AppView>("editor");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocus, setSearchFocus] = useState<SearchFocusTarget | null>(null);
  const { language, t } = useLocale();
  const projectFolder = useProjectFolder();
  const { matches: shortcutMatches } = useShortcuts();
  const { sidebarVisible, toggleSidebar } = useSidebarVisible();
  const searchResults = useMemo(
    () => searchDocument(doc, searchQuery, language),
    [doc, searchQuery, language]
  );
  const {
    mainRef,
    editorWidth,
    boardWidth,
    editorHidden,
    boardHidden,
    draggingEditor,
    draggingBoard,
    onEditorSplitterDown,
    onBoardSplitterDown,
    onEditorSplitterDoubleClick,
    onBoardSplitterDoubleClick,
  } = useResizablePanels(sidebarVisible);

  const { linkTarget, clearLinkTarget, navigateToHref } = useLinkContext();

  const handleSelectSearchResult = useCallback(
    (result: GlobalSearchResult) => {
      const q = searchQuery.trim();
      if (!result.sectionId) {
        setSearchFocus(null);
        return;
      }
      navigateToHref(result.href);
      if (!q) {
        setSearchFocus(null);
        return;
      }
      if (
        result.kind === "section-title" ||
        result.kind === "section-description" ||
        result.kind === "section-content" ||
        result.kind === "anchor"
      ) {
        setSearchFocus({
          sectionId: result.sectionId,
          query: q,
          kind: result.kind,
          anchorId: result.anchorId,
        });
      } else {
        setSearchFocus(null);
      }
    },
    [navigateToHref, searchQuery]
  );

  useEffect(() => {
    projectFolder.scheduleSaveDoc(doc);
  }, [doc, projectFolder.scheduleSaveDoc]);

  const handleNewProject = useCallback(() => {
    const ok = window.confirm(t("project.confirmNew"));
    if (!ok) return;
    projectFolder.closeFolder();
    newProject();
  }, [newProject, projectFolder, t]);

  const handleImportProject = useCallback(
    (incoming: GddDocument) => {
      projectFolder.closeFolder();
      replaceDocument(importAsNewProject(incoming));
    },
    [projectFolder, replaceDocument]
  );

  const handleOpenProjectFolder = useCallback(async () => {
    if (projectFolder.folderPath) {
      try {
        await projectFolder.saveDoc(doc);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : t("project.readError");
        window.alert(message);
        return;
      }
    }

    const picked = await projectFolder.pickFolder();
    if (!picked) return;

    if (picked.hasProject) {
      const ok = window.confirm(t("project.confirmLoadFolder"));
      if (!ok) return;
      try {
        projectFolder.bindProjectFolder(picked.folderPath);
        const imported = await projectFolder.loadFromFolder(picked.folderPath);
        replaceDocument(imported);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : t("project.readError");
        window.alert(message);
      }
      return;
    }

    const ok = window.confirm(t("project.confirmSaveToEmptyFolder"));
    if (!ok) return;

    try {
      projectFolder.bindProjectFolder(picked.folderPath);
      await projectFolder.saveDocTo(picked.folderPath, doc);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("project.readError");
      window.alert(message);
    }
  }, [doc, projectFolder, replaceDocument, t]);

  const handleAfterGitPull = useCallback(async () => {
    if (!projectFolder.folderPath) return;
    try {
      const imported = await projectFolder.loadFromFolder(projectFolder.folderPath);
      replaceDocument(imported);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("project.readError");
      window.alert(message);
    }
  }, [projectFolder, replaceDocument, t]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (view !== "editor") return;
      if (!shortcutMatches("undo", e)) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      // In-board label edit: let the browser undo typing inside the field.
      if (target.closest(".board-text-editor")) return;
      e.preventDefault();
      undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcutMatches, undo, view]);

  const scrollAnchorId =
    linkTarget?.anchorId && linkTarget.sectionId === activeSection?.id
      ? linkTarget.anchorId
      : undefined;

  const highlightMediaId =
    linkTarget?.mediaId && linkTarget.sectionId === activeSection?.id
      ? linkTarget.mediaId
      : undefined;

  const highlightTextId =
    linkTarget?.textId && linkTarget.sectionId === activeSection?.id
      ? linkTarget.textId
      : undefined;

  return (
    <div className="app">
      <Toolbar
        sidebarVisible={sidebarVisible}
        onToggleSidebar={toggleSidebar}
        doc={doc}
        onImportProject={handleImportProject}
        onNewProject={handleNewProject}
        settingsOpen={view === "settings"}
        onOpenSettings={() => setView("settings")}
        onBackFromSettings={() => setView("editor")}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searchResults={searchResults}
        onSelectSearchResult={handleSelectSearchResult}
        projectFolderName={projectFolder.folderName}
        projectFolderPath={projectFolder.folderPath}
        gitStatus={projectFolder.gitStatus}
        gitAvailable={projectFolder.gitAvailable}
        onOpenProjectFolder={() => void handleOpenProjectFolder()}
        onRefreshGitStatus={() =>
          void projectFolder.refreshGitStatus(projectFolder.folderPath)
        }
        onAfterGitPull={() => void handleAfterGitPull()}
        onFlushProject={() => projectFolder.saveDoc(doc)}
      />
      {view === "settings" ? (
        <SettingsPage
          projectFolderPath={projectFolder.folderPath}
          gitAvailable={projectFolder.gitAvailable}
          gitStatus={projectFolder.gitStatus}
          onRefreshGitStatus={() =>
            void projectFolder.refreshGitStatus(projectFolder.folderPath)
          }
        />
      ) : (
        <div className="app-body">
          <Sidebar
            hidden={!sidebarVisible}
            folders={doc.folders ?? []}
            sections={doc.sections}
            activeId={activeSectionId}
            onSelect={setActiveSectionId}
            onAddSection={addSection}
            onAddFolder={addFolder}
            onRemove={removeSection}
            onRemoveFolder={removeFolder}
            onUpdateFolder={updateFolder}
            onToggleFolder={toggleFolderCollapsed}
            onReorder={reorderSidebar}
          />
          <div ref={mainRef} className="main-panel">
            <PanelSplitter
              edge="start"
              hidden={editorHidden}
              dragging={draggingEditor}
              onPointerDown={onEditorSplitterDown}
              onDoubleClick={onEditorSplitterDoubleClick}
            />

            <div
              className={`content-column ${editorHidden ? "content-column--hidden" : ""}`}
              style={panelFlexStyle(editorHidden, editorWidth, 280)}
            >
              {!editorHidden && (
                <div className="content-column-scroll">
                  <DocumentMeta doc={doc} onChange={updateDoc} />
                  <div
                    className="editor-pane"
                    key={activeSection?.id ?? "no-section"}
                  >
                    {activeSection ? (
                      <SectionEditor
                        key={activeSection.id}
                        section={activeSection}
                        scrollToAnchorId={scrollAnchorId}
                        onScrollAnchorDone={clearLinkTarget}
                        searchFocus={
                          searchFocus?.sectionId === activeSection.id
                            ? searchFocus
                            : null
                        }
                        onSearchFocusDone={() => setSearchFocus(null)}
                        onChange={(patch) =>
                          updateSection(activeSection.id, patch)
                        }
                      />
                    ) : (
                      <div className="editor-empty">
                        <p>{t("editor.empty")}</p>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => {
                            addSection();
                            restoreAppFocus();
                          }}
                        >
                          {t("editor.addSection")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <PanelSplitter
              edge="end"
              hidden={boardHidden}
              dragging={draggingBoard}
              onPointerDown={onBoardSplitterDown}
              onDoubleClick={onBoardSplitterDoubleClick}
            />

            <div
              className={`board-pane ${boardHidden ? "board-pane--hidden" : ""}`}
              style={panelFlexStyle(boardHidden, boardWidth, 160)}
            >
              {!boardHidden &&
                (activeSection ? (
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
                    onHighlightDone={clearLinkTarget}
                    onAdd={(item) => addBoardItem(activeSection.id, item)}
                    onUpdate={(itemId, patch) =>
                      updateBoardItem(activeSection.id, itemId, patch)
                    }
                    onRemove={(itemId) =>
                      removeBoardItem(activeSection.id, itemId)
                    }
                    onAddShape={(shape) =>
                      addBoardShape(activeSection.id, shape)
                    }
                    onUpdateShape={(shapeId, patch) =>
                      updateBoardShape(activeSection.id, shapeId, patch)
                    }
                    onRemoveShape={(shapeId) =>
                      removeBoardShape(activeSection.id, shapeId)
                    }
                    onAddText={(text) => addBoardText(activeSection.id, text)}
                    onUpdateText={(textId, patch, options) =>
                      updateBoardText(activeSection.id, textId, patch, options)
                    }
                    onRemoveText={(textId) =>
                      removeBoardText(activeSection.id, textId)
                    }
                    onAddStroke={(stroke) =>
                      addBoardStroke(activeSection.id, stroke)
                    }
                    onUpdateStroke={(strokeId, patch) =>
                      updateBoardStroke(activeSection.id, strokeId, patch)
                    }
                    onRemoveStroke={(strokeId) =>
                      removeBoardStroke(activeSection.id, strokeId)
                    }
                    onAddGroup={(group) =>
                      addBoardGroup(activeSection.id, group)
                    }
                    onRemoveGroup={(groupId) =>
                      removeBoardGroup(activeSection.id, groupId)
                    }
                    onPasteDesk={(payload) =>
                      pasteDeskContent(activeSection.id, payload)
                    }
                    onReorderLayer={(selection, direction) =>
                      reorderDeskLayerOrder(activeSection.id, selection, direction)
                    }
                    onRemoveSelection={(itemIds, shapeIds, textIds, strokeIds) =>
                      removeDeskSelection(
                        activeSection.id,
                        itemIds,
                        shapeIds,
                        textIds,
                        strokeIds
                      )
                    }
                    onBeginTransientEdit={beginTransient}
                    onEndTransientEdit={endTransient}
                  />
                ) : (
                  <div className="board-empty" aria-hidden />
                ))}
            </div>
          </div>
        </div>
      )}

      {view === "editor" && (
        <>
          <LinkContextMenu />
          <LinkPasteDialog />
          <LinkPreviewLayer />
        </>
      )}
    </div>
  );
}

export default function App() {
  const gdd = useGddDocument();

  return (
    <LocaleProvider>
      <BoardSizeProvider>
        <ShortcutsProvider>
          <LinkProvider doc={gdd.doc} setActiveSectionId={gdd.setActiveSectionId}>
            <AppMain {...gdd} />
          </LinkProvider>
        </ShortcutsProvider>
      </BoardSizeProvider>
    </LocaleProvider>
  );
}
