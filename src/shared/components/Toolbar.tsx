import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/shared/context/LocaleContext";
import { GlobalSearch } from "@/features/search/GlobalSearch";
import type { GlobalSearchResult } from "@/features/search/lib/globalSearch";
import { ProjectMenu } from "@/features/project/ProjectMenu";
import { isWindowsDesktopApp } from "@/shared/lib/desktop";
import type { GitStatus } from "@/features/git/lib/git";
import type { GddDocument } from "@/shared/types";

interface ToolbarProps {
  sidebarVisible: boolean;
  onToggleSidebar: () => void;
  doc: GddDocument;
  onImportProject: (doc: GddDocument) => void;
  onNewProject?: () => void;
  settingsOpen?: boolean;
  onOpenSettings?: () => void;
  onBackFromSettings?: () => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  searchResults?: GlobalSearchResult[];
  onSelectSearchResult?: (result: GlobalSearchResult) => void;
  projectFolderName?: string | null;
  projectFolderPath?: string | null;
  gitStatus?: GitStatus | null;
  gitAvailable?: boolean;
  onOpenProjectFolder?: () => void;
  onRefreshGitStatus?: () => void;
  onAfterGitPull?: () => void;
  onFlushProject?: () => Promise<void>;
}

export function Toolbar({
  sidebarVisible,
  onToggleSidebar,
  doc,
  onImportProject,
  onNewProject,
  settingsOpen = false,
  onOpenSettings,
  onBackFromSettings,
  searchQuery = "",
  onSearchQueryChange,
  searchResults = [],
  onSelectSearchResult,
  projectFolderName = null,
  projectFolderPath = null,
  gitStatus = null,
  gitAvailable = false,
  onOpenProjectFolder,
  onRefreshGitStatus,
  onAfterGitPull,
  onFlushProject,
}: ToolbarProps) {
  const { t } = useLocale();
  const [isMaximized, setIsMaximized] = useState(false);

  const desktopWindow = useMemo(() => window.gddDesktop?.window, []);

  useEffect(() => {
    if (!isWindowsDesktopApp || !desktopWindow?.isMaximized) return;
    let unsub: (() => void) | undefined;
    desktopWindow
      .isMaximized()
      .then(setIsMaximized)
      .catch(() => setIsMaximized(false));
    if (desktopWindow.onMaximizedChanged) {
      unsub = desktopWindow.onMaximizedChanged(setIsMaximized);
    }
    return () => unsub?.();
  }, [desktopWindow]);

  return (
    <header className="toolbar">
      <div className="toolbar-brand">
        {settingsOpen ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onBackFromSettings}
          >
            {t("toolbar.back")}
          </button>
        ) : (
          <button
            type="button"
            className={`btn btn-ghost sections-toggle ${sidebarVisible ? "active" : ""}`}
            onClick={onToggleSidebar}
            aria-pressed={sidebarVisible}
            aria-label={
              sidebarVisible ? t("toolbar.hideSections") : t("toolbar.showSections")
            }
            title={
              sidebarVisible ? t("toolbar.hideSections") : t("toolbar.showSections")
            }
          >
            {t("toolbar.sections")}
          </button>
        )}
      </div>
      {!settingsOpen && onSearchQueryChange && onSelectSearchResult && (
        <div className="toolbar-search">
          <GlobalSearch
            query={searchQuery}
            onChange={onSearchQueryChange}
            results={searchResults}
            onSelectResult={onSelectSearchResult}
          />
        </div>
      )}
      <div className="toolbar-right">
        {!settingsOpen && (
          <div className="toolbar-actions">
            <ProjectMenu
              doc={doc}
              onNewProject={onNewProject}
              onImport={onImportProject}
              folderName={projectFolderName}
              folderPath={projectFolderPath}
              gitStatus={gitStatus}
              gitAvailable={gitAvailable}
              onOpenFolder={onOpenProjectFolder}
              onRefreshGitStatus={() => onRefreshGitStatus?.()}
              onAfterGitPull={onAfterGitPull}
              onFlushProject={onFlushProject}
            />
            {onOpenSettings && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onOpenSettings}
                aria-label={t("toolbar.settings")}
                title={t("toolbar.settings")}
              >
                {t("toolbar.settings")}
              </button>
            )}
          </div>
        )}

        {isWindowsDesktopApp && desktopWindow && (
          <div className="win-controls" aria-label="Window controls">
            <button
              type="button"
              className="win-control"
              onClick={() => void desktopWindow.minimize()}
              aria-label="Minimize"
              title="Minimize"
            >
              <span aria-hidden className="win-glyph win-glyph-min" />
            </button>
            <button
              type="button"
              className="win-control"
              onClick={() => void desktopWindow.toggleMaximize()}
              aria-label={isMaximized ? "Restore" : "Maximize"}
              title={isMaximized ? "Restore" : "Maximize"}
            >
              <span
                aria-hidden
                className={`win-glyph ${isMaximized ? "win-glyph-restore" : "win-glyph-max"}`}
              />
            </button>
            <button
              type="button"
              className="win-control win-control-close"
              onClick={() => void desktopWindow.close()}
              aria-label="Close"
              title="Close"
            >
              <span aria-hidden className="win-glyph win-glyph-close" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
