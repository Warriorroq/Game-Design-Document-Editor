import { EDGE_STYLES } from "@/domain/graph/graph";
import type { GraphEdgeStyle, GraphSettings } from "@/domain/types";
import { useLocale } from "@/shared/context/LocaleContext";

const EDGE_STYLE_LABEL_KEYS: Record<GraphEdgeStyle, "graph.edgeSolid" | "graph.edgeDotted" | "graph.edgeGhost"> = {
  solid: "graph.edgeSolid",
  dotted: "graph.edgeDotted",
  ghost: "graph.edgeGhost"
};

interface GraphSettingsPanelProps {
  settings: GraphSettings;
  onChange: (partial: Partial<GraphSettings>) => void;
  onReset: () => void;
  onClose: () => void;
}

export function GraphSettingsPanel({ settings, onChange, onReset, onClose }: GraphSettingsPanelProps) {
  const { t } = useLocale();

  return (
    <aside className="graph-settings" aria-label={t("graph.settings")}>
      <div className="graph-settings__header">
        <h3>{t("graph.settings")}</h3>
        <button type="button" className="graph-settings__close" onClick={onClose}>
          ✕
        </button>
      </div>

      <section className="graph-settings__section">
        <h4>{t("graph.ink")}</h4>
        <label className="graph-settings__row graph-settings__toggle">
          <span>{t("graph.inkSpread")}</span>
          <input
            type="checkbox"
            checked={settings.inkSpread}
            onChange={(e) => onChange({ inkSpread: e.target.checked })}
          />
        </label>
        <label className="graph-settings__row">
          <span>
            {t("graph.inkHops")} <em>{settings.inkHops}</em>
          </span>
          <input
            type="range"
            min={0}
            max={8}
            step={1}
            value={settings.inkHops}
            onChange={(e) => onChange({ inkHops: Number(e.target.value) })}
          />
        </label>
        <label className="graph-settings__row">
          <span>
            {t("graph.inkSoftness")} <em>{settings.inkSoftness.toFixed(2)}</em>
          </span>
          <input
            type="range"
            min={0.15}
            max={2}
            step={0.05}
            value={settings.inkSoftness}
            onChange={(e) => onChange({ inkSoftness: Number(e.target.value) })}
          />
        </label>
        <label className="graph-settings__row">
          <span>
            {t("graph.inkIntensity")} <em>{settings.inkIntensity.toFixed(2)}</em>
          </span>
          <input
            type="range"
            min={0.5}
            max={2.5}
            step={0.05}
            value={settings.inkIntensity}
            onChange={(e) => onChange({ inkIntensity: Number(e.target.value) })}
          />
        </label>
      </section>

      <section className="graph-settings__section">
        <h4>{t("graph.physics")}</h4>
        <label className="graph-settings__row">
          <span>
            {t("graph.expand")} <em>{settings.expand.toFixed(1)}</em>
          </span>
          <input
            type="range"
            min={0}
            max={6}
            step={0.1}
            value={settings.expand}
            onChange={(e) => onChange({ expand: Number(e.target.value) })}
          />
        </label>
        <label className="graph-settings__row">
          <span>
            {t("graph.repulsion")} <em>{settings.repulsion.toFixed(1)}</em>
          </span>
          <input
            type="range"
            min={1}
            max={20}
            step={0.5}
            value={settings.repulsion}
            onChange={(e) => onChange({ repulsion: Number(e.target.value) })}
          />
        </label>
        <label className="graph-settings__row">
          <span>
            {t("graph.springStrength")} <em>{settings.springStrength.toFixed(1)}</em>
          </span>
          <input
            type="range"
            min={1}
            max={20}
            step={0.5}
            value={settings.springStrength}
            onChange={(e) => onChange({ springStrength: Number(e.target.value) })}
          />
        </label>
        <label className="graph-settings__row">
          <span>
            {t("graph.springLength")} <em>{settings.springLength.toFixed(1)}</em>
          </span>
          <input
            type="range"
            min={1}
            max={6}
            step={0.1}
            value={settings.springLength}
            onChange={(e) => onChange({ springLength: Number(e.target.value) })}
          />
        </label>
        <label className="graph-settings__row">
          <span>
            {t("graph.orphanPull")} <em>{settings.orphanPull.toFixed(1)}</em>
          </span>
          <input
            type="range"
            min={0}
            max={12}
            step={0.5}
            value={settings.orphanPull}
            onChange={(e) => onChange({ orphanPull: Number(e.target.value) })}
          />
        </label>
        <label className="graph-settings__row">
          <span>{t("graph.defaultEdgeStyle")}</span>
          <select
            className="graph-settings__select"
            value={settings.edgeStyle}
            onChange={(e) => onChange({ edgeStyle: e.target.value as GraphEdgeStyle })}
          >
            {EDGE_STYLES.map((style) => (
              <option key={style} value={style}>
                {t(EDGE_STYLE_LABEL_KEYS[style])}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn graph-settings__reset" onClick={onReset}>
          {t("graph.resetSettings")}
        </button>
      </section>
    </aside>
  );
}
