import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useLocale } from "@/shared/context/LocaleContext";
import { isDesktopApp } from "@/shared/lib/desktop";
import { downloadGdeArchive, parseGdeArchive } from "@/features/project/lib/gdeArchive";
import type { GitStatus } from "@/features/git/lib/git";
import type { GddDocument } from "@/shared/types";
import { useGitActions } from "@/features/git/hooks/useGitActions";
import { GitIndicators } from "@/features/git/components/GitIndicators";
import { GitPromptDialog } from "@/features/git/components/GitPromptDialog";
import { GitPullConfirmDialog } from "@/features/git/components/GitPullConfirmDialog";
import { GitProgressDialog } from "@/features/git/components/GitProgressDialog";

interface ProjectMenuProps {
  doc: GddDocument;
  onNewProject?: () => void;
  onImport: (doc: GddDocument) => void;
  folderName?: string | null;
  folderPath?: string | null;
  gitStatus?: GitStatus | null;
  gitAvailable?: boolean;
  onOpenFolder?: () => void;
  onRefreshGitStatus?: () => void;
  onAfterGitPull?: () => void;
  onFlushProject?: () => Promise<void>;
  onOpenImageAssets?: () => void;
}

export function ProjectMenu({
  doc,
  onNewProject,
  onImport,
  folderName,
  folderPath = null,
  gitStatus = null,
  gitAvailable = false,
  onOpenFolder,
  onRefreshGitStatus,
  onAfterGitPull,
  onFlushProject,
  onOpenImageAssets,
}: ProjectMenuProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const git = useGitActions({
    folderPath,
    gitStatus,
    gitAvailable,
    onRefreshStatus: () => onRefreshGitStatus?.(),
    onAfterPull: onAfterGitPull,
    onFlushProject,
    onCloseMenu: () => setOpen(false),
  });

  const showGitIndicators =
    isDesktopApp && Boolean(folderPath) && gitAvailable;

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, [open]);

  const handleExport = () => {
    void downloadGdeArchive(doc);
    setOpen(false);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
    setOpen(false);
  };

  const handleNewProject = () => {
    onNewProject?.();
    setOpen(false);
  };

  const handleOpenFolder = () => {
    onOpenFolder?.();
    setOpen(false);
  };

  const handleOpenImageAssets = () => {
    onOpenImageAssets?.();
    setOpen(false);
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".gde")) {
      window.alert(t("project.invalidFile"));
      return;
    }

    try {
      const imported = await parseGdeArchive(file);
      const ok = window.confirm(t("project.confirmImport"));
      if (!ok) return;
      onImport(imported);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("project.readError");
      window.alert(message);
    }
  };

  return (
    <>
      <div className="project-menu" ref={rootRef}>
        <button
          type="button"
          className={`btn btn-ghost project-menu-trigger ${open ? "active" : ""} ${git.dirty ? "project-menu-trigger--dirty" : ""}`}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {t("project.menu")}
          {showGitIndicators && (
            <GitIndicators
              branch={git.branch}
              dirty={git.dirty}
              uncommittedLabel={t("git.uncommitted")}
            />
          )}
          <span className="project-menu-chevron" aria-hidden />
        </button>
        {open && (
          <div className="project-menu-dropdown" role="menu">
            {onNewProject && (
              <button
                type="button"
                className="project-menu-item"
                role="menuitem"
                onClick={handleNewProject}
              >
                {t("project.new")}
              </button>
            )}
            {onNewProject && (
              <div className="project-menu-separator" role="separator" />
            )}
            {isDesktopApp && onOpenFolder && (
              <>
                <button
                  type="button"
                  className="project-menu-item"
                  role="menuitem"
                  onClick={handleOpenFolder}
                >
                  {t("project.folder")}
                </button>
                {folderName && (
                  <div className="project-menu-folder" title={folderName}>
                    {t("project.folderActive", { name: folderName })}
                  </div>
                )}
                <div className="project-menu-separator" role="separator" />
              </>
            )}
            <button
              type="button"
              className="project-menu-item"
              role="menuitem"
              onClick={handleExport}
            >
              {t("project.export")}
            </button>
            <button
              type="button"
              className="project-menu-item"
              role="menuitem"
              onClick={handleImportClick}
            >
              {t("project.import")}
            </button>
            {onOpenImageAssets && (
              <button
                type="button"
                className="project-menu-item"
                role="menuitem"
                onClick={handleOpenImageAssets}
              >
                {t("project.imageAssets")}
              </button>
            )}

            {isDesktopApp && (
              <>
                <div className="project-menu-separator" role="separator" />
                <div className="project-menu-section" role="presentation">
                  {t("git.menuTitle")}
                </div>
                {!folderPath && (
                  <p className="project-menu-hint">{t("git.needFolder")}</p>
                )}
                {folderPath && !git.gitAvailable && (
                  <p className="project-menu-hint">{t("git.notAvailable")}</p>
                )}
                {folderPath && git.gitAvailable && !git.isRepo && (
                  <button
                    type="button"
                    className="project-menu-item project-menu-item--nested"
                    role="menuitem"
                    disabled={git.busy}
                    onClick={git.handleInit}
                  >
                    {t("git.init")}
                  </button>
                )}
                {folderPath && git.gitAvailable && git.isRepo && (
                  <>
                    <button
                      type="button"
                      className="project-menu-item project-menu-item--nested"
                      role="menuitem"
                      disabled={git.busy || git.syncProgress?.status === "running"}
                      onClick={git.handleCommitClick}
                    >
                      {t("git.commit")}
                    </button>
                    <button
                      type="button"
                      className="project-menu-item project-menu-item--nested"
                      role="menuitem"
                      disabled={git.busy || git.syncProgress?.status === "running"}
                      onClick={() => void git.handleSetRemoteClick()}
                    >
                      {t("git.setRemote")}
                    </button>
                    <button
                      type="button"
                      className="project-menu-item project-menu-item--nested"
                      role="menuitem"
                      disabled={git.busy || git.syncProgress?.status === "running"}
                      onClick={git.handlePush}
                    >
                      {t("git.push")}
                    </button>
                    <button
                      type="button"
                      className="project-menu-item project-menu-item--nested"
                      role="menuitem"
                      disabled={git.busy || git.syncProgress?.status === "running"}
                      onClick={git.handlePull}
                    >
                      {t("git.pull")}
                    </button>
                    {git.dirty && gitStatus?.files && gitStatus.files.length > 0 && (
                      <div className="git-menu-changes">
                        <span className="git-menu-changes-label">
                          {t("git.changes")}
                        </span>
                        <ul>
                          {gitStatus.files.slice(0, 6).map((file) => (
                            <li key={`${file.status}-${file.path}`}>
                              <span className="git-file-status">{file.status}</span>
                              {file.path}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".gde,application/zip,application/json"
          hidden
          onChange={handleFileChange}
        />
      </div>

      <GitPromptDialog
        kind={git.promptKind}
        initialValue={git.promptInitial}
        onClose={() => git.setPromptKind(null)}
        onSubmit={git.handlePromptSubmit}
      />
      <GitPullConfirmDialog
        open={Boolean(git.pullConfirmFiles)}
        files={git.pullConfirmFiles ?? []}
        busy={git.busy || git.syncProgress?.status === "running"}
        onClose={git.handlePullConfirmClose}
        onConfirm={git.handlePullConfirm}
      />
      <GitProgressDialog
        state={git.syncProgress}
        onClose={() => git.setSyncProgress(null)}
      />
    </>
  );
}
