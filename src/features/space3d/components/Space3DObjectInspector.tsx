import { useEffect, useState } from "react";
import { useLocale } from "@/shared/context/LocaleContext";
import { clampTransformPatch, MIN_SCALE } from "@/features/space3d/lib/space3dObject";
import type { Space3DObject } from "@/shared/types";

interface Space3DObjectInspectorProps {
  object: Space3DObject | null;
  onChange: (patch: Partial<Space3DObject>) => void;
}

type NumericField =
  | "x"
  | "y"
  | "z"
  | "rotationX"
  | "rotationY"
  | "rotationZ"
  | "scaleX"
  | "scaleY"
  | "scaleZ";

function NumRow({
  label,
  value,
  step,
  min,
  onCommit,
}: {
  label: string;
  value: number;
  step?: number;
  min?: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const parsed = Number.parseFloat(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    onCommit(parsed);
  };

  return (
    <label className="space3d-inspector-field">
      <span className="space3d-inspector-label">{label}</span>
      <input
        className="space3d-inspector-input"
        type="number"
        step={step ?? 0.1}
        min={min}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
    </label>
  );
}

export function Space3DObjectInspector({ object, onChange }: Space3DObjectInspectorProps) {
  const { t } = useLocale();

  if (!object) {
    return (
      <aside className="space3d-inspector">
        <h3 className="space3d-inspector-title">{t("space3d.inspectorTitle")}</h3>
        <p className="space3d-inspector-empty">{t("space3d.inspectorEmpty")}</p>
      </aside>
    );
  }

  const commitField = (field: NumericField, raw: number) => {
    onChange(clampTransformPatch({ [field]: raw }));
  };

  return (
    <aside className="space3d-inspector">
      <h3 className="space3d-inspector-title">{t("space3d.inspectorTitle")}</h3>
      <p className="space3d-inspector-type">
        {object.type === "model"
          ? t("space3d.typeModel")
          : object.type === "sphere"
            ? t("space3d.typeSphere")
            : t("space3d.typeBox")}
      </p>

      <div className="space3d-inspector-section">
        <h4>{t("space3d.position")}</h4>
        <NumRow label="X" value={object.x} step={0.1} onCommit={(v) => commitField("x", v)} />
        <NumRow label="Y" value={object.y} step={0.1} onCommit={(v) => commitField("y", v)} />
        <NumRow label="Z" value={object.z} step={0.1} onCommit={(v) => commitField("z", v)} />
      </div>

      <div className="space3d-inspector-section">
        <h4>{t("space3d.rotation")}</h4>
        <NumRow
          label="X"
          value={object.rotationX ?? 0}
          step={1}
          onCommit={(v) => commitField("rotationX", v)}
        />
        <NumRow
          label="Y"
          value={object.rotationY ?? 0}
          step={1}
          onCommit={(v) => commitField("rotationY", v)}
        />
        <NumRow
          label="Z"
          value={object.rotationZ ?? 0}
          step={1}
          onCommit={(v) => commitField("rotationZ", v)}
        />
      </div>

      <div className="space3d-inspector-section">
        <h4>{t("space3d.scale")}</h4>
        <NumRow
          label="X"
          value={object.scaleX ?? 1}
          step={0.001}
          min={MIN_SCALE}
          onCommit={(v) => commitField("scaleX", v)}
        />
        <NumRow
          label="Y"
          value={object.scaleY ?? 1}
          step={0.001}
          min={MIN_SCALE}
          onCommit={(v) => commitField("scaleY", v)}
        />
        <NumRow
          label="Z"
          value={object.scaleZ ?? 1}
          step={0.001}
          min={MIN_SCALE}
          onCommit={(v) => commitField("scaleZ", v)}
        />
      </div>

      {object.type !== "model" && (
        <div className="space3d-inspector-section">
          <h4>{t("space3d.color")}</h4>
          <label className="space3d-inspector-field space3d-inspector-field--color">
            <input
              className="space3d-inspector-color"
              type="color"
              value={object.color ?? "#6366f1"}
              onChange={(e) => onChange({ color: e.target.value })}
            />
          </label>
        </div>
      )}
    </aside>
  );
}
