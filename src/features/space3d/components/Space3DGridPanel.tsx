import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/shared/context/LocaleContext";
import type { Space3DGrid } from "@/shared/types";

interface Space3DGridPanelProps {
  grid: Space3DGrid;
  onChange: (patch: Partial<Space3DGrid>) => void;
}

function NumRow({
  label,
  value,
  step,
  min,
  max,
  onCommit,
}: {
  label: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
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
    const clamped =
      min != null && max != null
        ? Math.min(max, Math.max(min, parsed))
        : min != null
          ? Math.max(min, parsed)
          : max != null
            ? Math.min(max, parsed)
            : parsed;
    onCommit(clamped);
  };

  return (
    <label className="space3d-grid-field">
      <span className="space3d-grid-label">{label}</span>
      <input
        className="space3d-grid-input"
        type="number"
        step={step ?? 0.01}
        min={min}
        max={max}
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

export function Space3DGridPanel({ grid, onChange }: Space3DGridPanelProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const step = grid.step ?? 1;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="space3d-grid-panel-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`space3d-grid-toggle ${open ? "active" : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        {t("space3d.gridTitle")}
      </button>
      {open && (
        <div
          className="space3d-grid-panel"
          role="dialog"
          aria-label={t("space3d.gridTitle")}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <NumRow
            label={t("space3d.gridStep")}
            value={step}
            step={0.01}
            min={0}
            max={10}
            onCommit={(nextStep) => onChange({ step: nextStep })}
          />
          <label className="space3d-grid-field space3d-grid-field--check">
            <input
              type="checkbox"
              checked={grid.enabled === true}
              onChange={(e) => onChange({ enabled: e.target.checked })}
            />
            <span>{t("space3d.gridEnable")}</span>
          </label>
        </div>
      )}
    </div>
  );
}
