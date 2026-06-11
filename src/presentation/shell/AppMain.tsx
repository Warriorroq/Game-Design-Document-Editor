import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LinkContextMenu } from "@/features/links/LinkContextMenu";
import { LinkPasteDialog } from "@/features/links/LinkPasteDialog";
import { LinkPreviewLayer } from "@/features/links/LinkPreviewLayer";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { Toolbar } from "@/shared/components/Toolbar";
import { useLinkContext } from "@/features/links/LinkContext";
import { useLocale } from "@/shared/context/LocaleContext";
import { useShortcuts } from "@/shared/context/ShortcutsContext";
import { useProjectFolder } from "@/application/project/useProjectFolder";
import { useResizablePanels } from "@/shared/hooks/useResizablePanels";
import {
  searchDocument,
  type GlobalSearchResult,
  type SearchFocusTarget,
} from "@/features/search/lib/globalSearch";
import { useSidebarVisible } from "@/shared/hooks/useSidebarVisible";
import { BoardAssetsDialog } from "@/features/board/components/BoardAssetsDialog";
import { importAsNewProject } from "@/domain/document/document";
import type { DocumentStore } from "@/application/document/useDocumentStore";
import type { GddDocument } from "@/domain/types";
import { EditorLayout } from "@/presentation/shell/EditorLayout";

type AppView = "editor" | "settings";

export function AppMain(props: DocumentStore) {
  const {
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
    deskClipboard,
    storeDeskClipboard,
    pasteDeskContent,
    reorderDeskLayerOrder,
    removeDeskSelection,
    removeBoardImageAsset,
    updateBoardImageAssetName,
    undo,
    beginTransient,
    endTransient,
    replaceDocument,
    newProject,
  } = props;

  const [view, setView] = useState<AppView>("editor");
  const [imageAssetsOpen, setImageAssetsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocus, setSearchFocus] = useState<SearchFocusTarget | null>(null);
  const lastSearchResultRef = useRef<{ key: string; matchIndex: number } | null>(
    null
  );
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

  useEffect(() => {
    lastSearchResultRef.current = null;
  }, [searchQuery]);

  const handleSelectSearchResult = useCallback(
    (result: GlobalSearchResult) => {
      const q = searchQuery.trim();
      if (!result.sectionId) {
        setSearchFocus(null);
        lastSearchResultRef.current = null;
        return;
      }
      navigateToHref(result.href);
      if (!q) {
        setSearchFocus(null);
        lastSearchResultRef.current = null;
        return;
      }
      if (
        result.kind === "section-title" ||
        result.kind === "section-description" ||
        result.kind === "section-content" ||
        result.kind === "anchor"
      ) {
        const matchCount = Math.max(1, result.matchCount);
        let matchIndex = 0;
        if (lastSearchResultRef.current?.key === result.key) {
          matchIndex =
            (lastSearchResultRef.current.matchIndex + 1) % matchCount;
        }
        lastSearchResultRef.current = { key: result.key, matchIndex };
        setSearchFocus({
          sectionId: result.sectionId,
          query: q,
          kind: result.kind,
          matchIndex,
          matchCount,
          anchorId: result.anchorId,
        });
      } else {
        setSearchFocus(null);
        lastSearchResultRef.current = null;
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
        onOpenImageAssets={() => setImageAssetsOpen(true)}
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
        <EditorLayout
          doc={doc}
          activeSection={activeSection}
          activeSectionId={activeSectionId}
          folders={doc.folders ?? []}
          sidebarVisible={sidebarVisible}
          mainRef={mainRef}
          editorWidth={editorWidth}
          boardWidth={boardWidth}
          editorHidden={editorHidden}
          boardHidden={boardHidden}
          draggingEditor={draggingEditor}
          draggingBoard={draggingBoard}
          scrollAnchorId={scrollAnchorId}
          highlightMediaId={highlightMediaId}
          highlightTextId={highlightTextId}
          searchFocus={searchFocus}
          deskClipboard={deskClipboard}
          emptyLabel={t("editor.empty")}
          addSectionLabel={t("editor.addSection")}
          onSelectSection={setActiveSectionId}
          onAddSection={addSection}
          onAddFolder={addFolder}
          onRemoveSection={removeSection}
          onRemoveFolder={removeFolder}
          onUpdateFolder={updateFolder}
          onToggleFolder={toggleFolderCollapsed}
          onReorderSidebar={reorderSidebar}
          onEditorSplitterDown={onEditorSplitterDown}
          onBoardSplitterDown={onBoardSplitterDown}
          onEditorSplitterDoubleClick={onEditorSplitterDoubleClick}
          onBoardSplitterDoubleClick={onBoardSplitterDoubleClick}
          onUpdateDoc={updateDoc}
          onUpdateSection={updateSection}
          onScrollAnchorDone={clearLinkTarget}
          onSearchFocusDone={() => setSearchFocus(null)}
          onHighlightDone={clearLinkTarget}
          onAddBoardItem={addBoardItem}
          onUpdateBoardItem={updateBoardItem}
          onRemoveBoardItem={removeBoardItem}
          onAddBoardShape={addBoardShape}
          onUpdateBoardShape={updateBoardShape}
          onRemoveBoardShape={removeBoardShape}
          onAddBoardText={addBoardText}
          onUpdateBoardText={updateBoardText}
          onRemoveBoardText={removeBoardText}
          onAddBoardStroke={addBoardStroke}
          onUpdateBoardStroke={updateBoardStroke}
          onRemoveBoardStroke={removeBoardStroke}
          onAddBoardGroup={addBoardGroup}
          onRemoveBoardGroup={removeBoardGroup}
          onPasteDesk={pasteDeskContent}
          onReorderLayer={reorderDeskLayerOrder}
          onRemoveSelection={removeDeskSelection}
          onStoreDeskClipboard={storeDeskClipboard}
          onBeginTransientEdit={beginTransient}
          onEndTransientEdit={endTransient}
        />
      )}

      {view === "editor" && (
        <>
          <LinkContextMenu />
          <LinkPasteDialog />
          <LinkPreviewLayer />
          <BoardAssetsDialog
            open={imageAssetsOpen}
            doc={doc}
            onClose={() => setImageAssetsOpen(false)}
            onDeleteAsset={removeBoardImageAsset}
            onUpdateAssetName={updateBoardImageAssetName}
            onCopyAsset={storeDeskClipboard}
          />
        </>
      )}
    </div>
  );
}
