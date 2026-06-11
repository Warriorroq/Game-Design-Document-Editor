import { useLocale } from "@/shared/context/LocaleContext";
import type { Space3DEditMode } from "@/shared/types";

const MODES: Space3DEditMode[] = ["move", "scale", "rotate"];

interface Space3DModeMenuProps {
  mode: Space3DEditMode;
  onChange: (mode: Space3DEditMode) => void;
}

export function Space3DModeMenu({ mode, onChange }: Space3DModeMenuProps) {
  const { t } = useLocale();

  return (
    <div className="space3d-mode-menu" role="group" aria-label={t("space3d.editModeAria")}>
      {MODES.map((entry) => (
        <button
          key={entry}
          type="button"
          className={`space3d-mode-btn ${mode === entry ? "active" : ""}`}
          aria-pressed={mode === entry}
          onClick={() => onChange(entry)}
        >
          {t(`space3d.mode.${entry}`)}
        </button>
      ))}
    </div>
  );
}
