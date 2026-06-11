import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "@/shared/context/LocaleContext";
import {
  countSpace3DModelUsage,
  displaySpace3DModelName,
} from "@/domain/space3d/modelRegistry";
import type { GddDocument } from "@/shared/types";

interface Space3DModelsDialogProps {
  open: boolean;
  doc: GddDocument;
  onClose: () => void;
  onImport: (file: File) => void;
  onPlace: (assetId: string) => void;
  onDelete: (assetId: string) => void;
}

export function Space3DModelsDialog({
  open,
  doc,
  onClose,
  onImport,
  onPlace,
  onDelete,
}: Space3DModelsDialogProps) {
  const { t } = useLocale();
  const fileRef = useRef<HTMLInputElement>(null);
  const assets = useMemo(
    () =>
      Object.values(doc.space3DModels ?? {}).sort((a, b) =>
        displaySpace3DModelName(a).localeCompare(displaySpace3DModelName(b))
      ),
    [doc.space3DModels]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="space3d-models-backdrop" onClick={onClose}>
      <div
        className="space3d-models-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t("space3d.modelsTitle")}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="space3d-models-header">
          <h3>{t("space3d.modelsTitle")}</h3>
          <button type="button" className="space3d-models-close" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="space3d-models-body">
          <button
            type="button"
            className="space3d-tool-btn"
            onClick={() => fileRef.current?.click()}
          >
            {t("space3d.importModel")}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".glb,.gltf,.fbx,.obj"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) onImport(file);
            }}
          />
          {assets.length === 0 ? (
            <p className="space3d-models-empty">{t("space3d.modelsEmpty")}</p>
          ) : (
            <ul className="space3d-models-list">
              {assets.map((asset) => {
                const usage = countSpace3DModelUsage(doc, asset.id);
                return (
                  <li key={asset.id} className="space3d-models-item">
                    <div className="space3d-models-item-info">
                      <span className="space3d-models-item-name">
                        {displaySpace3DModelName(asset)}
                      </span>
                      <span className="space3d-models-item-usage">
                        {t("space3d.modelUsage", { count: usage })}
                      </span>
                    </div>
                    <div className="space3d-models-item-actions">
                      <button
                        type="button"
                        className="space3d-tool-btn"
                        onClick={() => onPlace(asset.id)}
                      >
                        {t("space3d.placeModel")}
                      </button>
                      <button
                        type="button"
                        className="space3d-tool-btn space3d-tool-btn--danger"
                        disabled={usage > 0}
                        title={usage > 0 ? t("space3d.modelInUse") : undefined}
                        onClick={() => onDelete(asset.id)}
                      >
                        {t("space3d.removeModel")}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
