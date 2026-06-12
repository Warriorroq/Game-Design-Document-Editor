import { useLocale } from "@/shared/context/LocaleContext";
import type { CompactPane } from "@/shared/hooks/useCompactPane";

interface CompactPaneToggleProps {
  value: CompactPane;
  onChange: (pane: CompactPane) => void;
}

export function CompactPaneToggle({ value, onChange }: CompactPaneToggleProps) {
  const { t } = useLocale();

  return (
    <div
      className="compact-pane-switch"
      role="tablist"
      aria-label={t("layout.compactSwitchAria")}
    >
      <button
        type="button"
        role="tab"
        className={`compact-pane-switch-btn ${value === "editor" ? "active" : ""}`}
        aria-selected={value === "editor"}
        onClick={() => onChange("editor")}
      >
        {t("layout.compactEditor")}
      </button>
      <button
        type="button"
        role="tab"
        className={`compact-pane-switch-btn ${value === "board" ? "active" : ""}`}
        aria-selected={value === "board"}
        onClick={() => onChange("board")}
      >
        {t("layout.compactBoard")}
      </button>
    </div>
  );
}
