import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@/shared/context/LocaleContext";
import { resolveSpace3DModelSrc } from "@/domain/space3d/modelRegistry";
import {
  createSpace3DModelObject,
  createSpace3DPrimitive,
  normalizeSpace3DData,
  normalizeSpace3DGrid,
} from "@/domain/space3d/space3d";
import type {
  GddDocument,
  GddSection,
  Space3DData,
  Space3DEditMode,
  Space3DObject,
} from "@/shared/types";
import { useSpace3DScene } from "@/features/space3d/hooks/useSpace3DScene";
import { Space3DObjectInspector } from "@/features/space3d/components/Space3DObjectInspector";
import { Space3DGridPanel } from "@/features/space3d/components/Space3DGridPanel";
import { Space3DContextMenu } from "@/features/space3d/components/Space3DContextMenu";
import { Space3DModeMenu } from "@/features/space3d/components/Space3DModeMenu";
import { Space3DModelsDialog } from "@/features/space3d/components/Space3DModelsDialog";
import {
  isSupportedModelFileName,
  readModelFile,
} from "@/features/space3d/lib/space3dLoader";
import { clampTransformPatch } from "@/features/space3d/lib/space3dObject";
import { snapTransformPatch } from "@/features/space3d/lib/space3dGrid";
import "./Space3D.css";

interface Space3DViewProps {
  doc: GddDocument;
  section: GddSection;
  onChange: (patch: Partial<GddSection>) => void;
  onAddModel: (src: string, name?: string) => string;
  onRemoveModelAsset: (assetId: string) => void;
  onRenameModelAsset: (assetId: string, name: string) => void;
  onBeginTransientEdit?: () => void;
  onEndTransientEdit?: () => void;
}

export function Space3DView({
  doc,
  section,
  onChange,
  onAddModel,
  onRemoveModelAsset,
  onBeginTransientEdit,
  onEndTransientEdit,
}: Space3DViewProps) {
  const { t } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const space3d = normalizeSpace3DData(section.space3d);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<Space3DEditMode>("move");
  const [modelsOpen, setModelsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const viewportPointerRef = useRef({ x: 0, y: 0, moved: false });

  const updateSpace3d = useCallback(
    (patch: Partial<Space3DData>) => {
      onChange({
        space3d: {
          ...space3d,
          ...patch,
        },
      });
    },
    [onChange, space3d]
  );

  const onObjectChange = useCallback(
    (objectId: string, patch: Partial<Space3DObject>) => {
      const grid = normalizeSpace3DGrid(space3d.grid);
      const snapped = snapTransformPatch(clampTransformPatch(patch), grid);
      updateSpace3d({
        objects: space3d.objects.map((obj) =>
          obj.id === objectId ? { ...obj, ...snapped } : obj
        ),
      });
    },
    [space3d.objects, space3d.grid, updateSpace3d]
  );

  const selectedObject =
    selectedId != null
      ? space3d.objects.find((obj) => obj.id === selectedId) ?? null
      : null;

  useEffect(() => {
    if (selectedId && !space3d.objects.some((obj) => obj.id === selectedId)) {
      setSelectedId(null);
    }
  }, [space3d.objects, selectedId]);

  const { setEditMode: applyEditMode } = useSpace3DScene({
    containerRef,
    doc,
    space3d,
    selectedId,
    editMode,
    onSelect: setSelectedId,
    onObjectChange,
    onCameraChange: (camera) => updateSpace3d({ camera }),
    onBeginTransientEdit,
    onEndTransientEdit,
  });

  useEffect(() => {
    applyEditMode(editMode);
  }, [editMode, applyEditMode]);

  const addPrimitive = (type: "box" | "sphere") => {
    const obj = createSpace3DPrimitive(type, space3d.objects.length);
    updateSpace3d({ objects: [...space3d.objects, obj] });
    setSelectedId(obj.id);
  };

  const placeModel = (assetId: string) => {
    if (!resolveSpace3DModelSrc(doc, assetId)) return;
    const obj = createSpace3DModelObject(assetId, space3d.objects.length);
    updateSpace3d({ objects: [...space3d.objects, obj] });
    setSelectedId(obj.id);
    setModelsOpen(false);
  };

  const importModel = async (file: File) => {
    if (!isSupportedModelFileName(file.name)) return;
    const src = await readModelFile(file);
    const assetId = onAddModel(src, file.name.replace(/\.[^.]+$/, ""));
    placeModel(assetId);
  };

  const removeSelected = useCallback(() => {
    if (!selectedId) return;
    updateSpace3d({
      objects: space3d.objects.filter((obj) => obj.id !== selectedId),
    });
    setSelectedId(null);
  }, [selectedId, space3d.objects, updateSpace3d]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Delete") return;
      if (e.target instanceof HTMLElement && e.target.isContentEditable) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      removeSelected();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [removeSelected]);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const handleViewportPointerDown = (e: React.PointerEvent) => {
    viewportPointerRef.current = { x: e.clientX, y: e.clientY, moved: false };
  };

  const handleViewportPointerMove = (e: React.PointerEvent) => {
    if (e.buttons === 0) return;
    const start = viewportPointerRef.current;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (dx * dx + dy * dy > 36) {
      start.moved = true;
    }
  };

  const handleViewportContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (viewportPointerRef.current.moved) {
      viewportPointerRef.current.moved = false;
      return;
    }
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <div className="space3d-panel">
      <header className="space3d-header">
        <div className="space3d-header-main">
          <h2 className="space3d-title">{t("space3d.title")}</h2>
          <input
            className="space3d-section-title"
            value={section.title}
            aria-label={t("space3d.sectionTitleAria")}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </div>
        <div className="space3d-meta">
          <span>{t("space3d.objects", { count: space3d.objects.length })}</span>
          <span>{t("space3d.modelsCount", { count: Object.keys(doc.space3DModels ?? {}).length })}</span>
          <span className="space3d-hint-inline">{t("space3d.hint")}</span>
        </div>
      </header>

      <div className="space3d-body">
        <div
          className="space3d-viewport"
          onPointerDown={handleViewportPointerDown}
          onPointerMove={handleViewportPointerMove}
          onContextMenu={handleViewportContextMenu}
        >
          <div ref={containerRef} className="space3d-canvas-host" />
          <div className="space3d-viewport-overlays">
            <Space3DGridPanel
              grid={space3d.grid!}
              onChange={(patch) =>
                updateSpace3d({
                  grid: { ...space3d.grid, ...patch },
                })
              }
            />
            <Space3DModeMenu mode={editMode} onChange={setEditMode} />
          </div>
        </div>
        <Space3DObjectInspector
          object={selectedObject}
          onChange={(patch) => {
            if (!selectedId) return;
            onObjectChange(selectedId, patch);
          }}
        />
      </div>

      {contextMenu && (
        <Space3DContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          canRemove={Boolean(selectedId)}
          onAddBox={() => {
            addPrimitive("box");
            closeContextMenu();
          }}
          onAddSphere={() => {
            addPrimitive("sphere");
            closeContextMenu();
          }}
          onOpenModels={() => {
            setModelsOpen(true);
            closeContextMenu();
          }}
          onRemove={() => {
            removeSelected();
            closeContextMenu();
          }}
          onClose={closeContextMenu}
        />
      )}

      <Space3DModelsDialog
        open={modelsOpen}
        doc={doc}
        onClose={() => setModelsOpen(false)}
        onImport={(file) => void importModel(file)}
        onPlace={placeModel}
        onDelete={onRemoveModelAsset}
      />
    </div>
  );
}
