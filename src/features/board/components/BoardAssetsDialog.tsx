import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  countBoardImageAssetUsage,
  displayBoardImageAssetName,
  listBoardImageAssetDesks,
} from "@/features/board/lib/boardImageRegistry";
import {
  buildAssetDeskClipboard,
  type DeskClipboard,
} from "@/features/board/lib/deskClipboard";
import { useLinkContext } from "@/features/links/LinkContext";
import { buildMediaHref } from "@/features/links/lib/links";
import { useLocale } from "@/shared/context/LocaleContext";
import { restoreAppFocus } from "@/shared/lib/desktop";
import { loadImageDimensions } from "@/shared/lib/imageUtils";
import type { GddDocument } from "@/shared/types";
import "@/shared/styles/LinkMenus.css";
import "./BoardAssetsDialog.css";

interface BoardAssetsDialogProps {
  open: boolean;
  doc: GddDocument;
  onClose: () => void;
  onDeleteAsset: (assetId: string) => void;
  onUpdateAssetName: (assetId: string, name: string) => void;
  onCopyAsset: (clip: DeskClipboard) => void;
}

export function BoardAssetsDialog({
  open,
  doc,
  onClose,
  onDeleteAsset,
  onUpdateAssetName,
  onCopyAsset,
}: BoardAssetsDialogProps) {
  const { t } = useLocale();
  const { navigateToHref } = useLinkContext();
  const renameInputRef = useRef<HTMLInputElement>(null);
  const skipRenameBlurSubmit = useRef(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [expandedRefsId, setExpandedRefsId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);

  const assets = useMemo(() => {
    const entries = Object.values(doc.boardImages ?? {});
    return entries.sort((a, b) =>
      displayBoardImageAssetName(a).localeCompare(displayBoardImageAssetName(b))
    );
  }, [doc.boardImages]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (renamingId) {
        setRenamingId(null);
        setRenameError(null);
        return;
      }
      if (expandedRefsId) {
        setExpandedRefsId(null);
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, renamingId, expandedRefsId]);

  useEffect(() => {
    if (!renamingId) return;
    const timer = window.setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [renamingId]);

  useEffect(() => {
    if (!open) {
      setCopiedId(null);
      setCopyError(null);
      setExpandedRefsId(null);
      setRenamingId(null);
      setRenameError(null);
      const timer = window.setTimeout(() => restoreAppFocus(), 0);
      return () => window.clearTimeout(timer);
    }
  }, [open]);

  if (!open) return null;

  const handleCopy = (assetId: string, src: string) => {
    setCopyError(null);
    loadImageDimensions(src)
      .then((dims) => {
        onCopyAsset(buildAssetDeskClipboard(assetId, dims));
        void navigator.clipboard.writeText("").catch(() => {});
        setCopiedId(assetId);
        window.setTimeout(() => {
          setCopiedId((current) => (current === assetId ? null : current));
        }, 1500);
      })
      .catch(() => {
        setCopyError(t("desk.imageAssetCopyFailed"));
      });
  };

  const startRename = (assetId: string, currentName?: string) => {
    setRenamingId(assetId);
    setRenameDraft(currentName?.trim() ?? "");
    setRenameError(null);
    setExpandedRefsId(null);
  };

  const cancelRename = () => {
    skipRenameBlurSubmit.current = true;
    setRenamingId(null);
    setRenameError(null);
  };

  const submitRename = (assetId: string) => {
    if (renameDraft.trim().length > 200) {
      setRenameError(t("desk.imageAssetRenameInvalid"));
      return;
    }
    try {
      onUpdateAssetName(assetId, renameDraft);
    } catch {
      setRenameError(t("desk.imageAssetRenameInvalid"));
      return;
    }
    setRenamingId(null);
    setRenameError(null);
  };

  const goToReference = (sectionId: string, itemId: string) => {
    navigateToHref(buildMediaHref(sectionId, itemId));
    onClose();
  };

  const dialog = (
    <div className="link-dialog-backdrop" onPointerDown={onClose}>
      <div
        className="board-assets-dialog"
        role="dialog"
        aria-labelledby="board-assets-title"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <header className="board-assets-header">
          <h3 id="board-assets-title" className="link-paste-title">
            {t("desk.imageAssetsTitle")}
          </h3>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("link.cancel")}
          </button>
        </header>

        {copyError && (
          <p className="board-assets-copy-error" role="alert">
            {copyError}
          </p>
        )}

        {assets.length === 0 ? (
          <p className="board-assets-empty">{t("desk.imageAssetsEmpty")}</p>
        ) : (
          <ul className="board-assets-list">
            {assets.map((asset) => {
              const desks = listBoardImageAssetDesks(doc, asset.id);
              const usage = countBoardImageAssetUsage(doc, asset.id);
              const inUse = usage > 0;
              const refsOpen = expandedRefsId === asset.id;
              const isRenaming = renamingId === asset.id;

              return (
                <li key={asset.id} className="board-assets-item">
                  <div className="board-assets-item-row">
                    <div className="board-assets-thumb-wrap">
                      <img
                        className="board-assets-thumb"
                        src={asset.src}
                        alt=""
                        draggable={false}
                      />
                    </div>
                    <div className="board-assets-meta">
                      {isRenaming ? (
                        <div className="board-assets-rename">
                          <input
                            ref={renameInputRef}
                            className="board-assets-rename-input"
                            value={renameDraft}
                            onChange={(e) => {
                              setRenameDraft(e.target.value);
                              setRenameError(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                submitRename(asset.id);
                              }
                              if (e.key === "Escape") {
                                e.preventDefault();
                                cancelRename();
                              }
                            }}
                            onBlur={() => {
                              if (skipRenameBlurSubmit.current) {
                                skipRenameBlurSubmit.current = false;
                                return;
                              }
                              submitRename(asset.id);
                            }}
                          />
                          {renameError && (
                            <span className="board-assets-rename-error" role="alert">
                              {renameError}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="board-assets-labels">
                          <span
                            className="board-assets-name board-assets-name--editable"
                            title={t("desk.imageAssetRenameHint")}
                            onDoubleClick={() => startRename(asset.id, asset.name)}
                          >
                            {displayBoardImageAssetName(asset)}
                          </span>
                          {asset.name?.trim() && (
                            <span className="board-assets-id" title={asset.id}>
                              {asset.id}
                            </span>
                          )}
                        </div>
                      )}
                      {inUse ? (
                        <button
                          type="button"
                          className={`board-assets-usage-btn ${refsOpen ? "active" : ""}`}
                          aria-expanded={refsOpen}
                          onClick={() =>
                            setExpandedRefsId(refsOpen ? null : asset.id)
                          }
                        >
                          {t("desk.imageAssetsUsage", { count: usage })}
                        </button>
                      ) : (
                        <span className="board-assets-usage">
                          {t("desk.imageAssetsUnused")}
                        </span>
                      )}
                    </div>
                    <div className="board-assets-actions">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => handleCopy(asset.id, asset.src)}
                      >
                        {copiedId === asset.id
                          ? t("desk.imageAssetCopied")
                          : t("desk.imageAssetCopy")}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost board-assets-delete"
                        disabled={inUse}
                        title={inUse ? t("desk.imageAssetInUse") : undefined}
                        onClick={() => onDeleteAsset(asset.id)}
                      >
                        {t("desk.imageAssetDelete")}
                      </button>
                    </div>
                  </div>
                  {refsOpen && (
                    <ul className="board-assets-refs">
                      {desks.map((desk) => (
                        <li key={desk.sectionId}>
                          <button
                            type="button"
                            className="board-assets-ref-item"
                            onClick={() =>
                              goToReference(desk.sectionId, desk.itemId)
                            }
                          >
                            <span className="board-assets-ref-title">
                              {desk.sectionTitle}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
