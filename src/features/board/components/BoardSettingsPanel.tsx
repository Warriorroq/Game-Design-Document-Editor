import { useEffect, useState } from "react";
import { useLocale } from "@/shared/context/LocaleContext";
import { useBoardSize } from "@/shared/context/BoardSizeContext";
import {
  BOARD_SIZE_PRESET_IDS,
  BOARD_SIZE_PRESETS,
  boardSizeMatchesPreset,
  normalizeBoardSize,
  type BoardSizePresetId,
} from "@/features/board/lib/boardSettings";
import { boardPresetDescKey, boardPresetNameKey } from "@/shared/i18n";

export function BoardSettingsPanel() {
  const { t } = useLocale();
  const { width, height, setBoardSize } = useBoardSize();
  const [customWidth, setCustomWidth] = useState(String(width));
  const [customHeight, setCustomHeight] = useState(String(height));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCustomWidth(String(width));
    setCustomHeight(String(height));
  }, [width, height]);

  const applyPreset = (presetId: BoardSizePresetId) => {
    const preset = BOARD_SIZE_PRESETS[presetId];
    setBoardSize(preset);
    setCustomWidth(String(preset.width));
    setCustomHeight(String(preset.height));
    setError(null);
  };

  const applyCustom = () => {
    const w = Number.parseInt(customWidth, 10);
    const h = Number.parseInt(customHeight, 10);
    if (!Number.isFinite(w) || !Number.isFinite(h)) {
      setError(t("settings.boardInvalid"));
      return;
    }
    const normalized = normalizeBoardSize(w, h);
    setBoardSize(normalized);
    setCustomWidth(String(normalized.width));
    setCustomHeight(String(normalized.height));
    setError(null);
  };

  return (
    <div className="settings-board">
      <p className="settings-hint">{t("settings.boardHint")}</p>
      <p className="settings-board-current">
        {t("settings.boardCurrent", { width, height })}
      </p>

      <div className="board-preset-grid">
        {BOARD_SIZE_PRESET_IDS.map((id) => {
          const preset = BOARD_SIZE_PRESETS[id];
          const active = boardSizeMatchesPreset({ width, height }, id);
          return (
            <button
              key={id}
              type="button"
              className={`board-preset-card ${active ? "active" : ""}`}
              aria-pressed={active}
              onClick={() => applyPreset(id)}
            >
              <span className="board-preset-label">
                {t(boardPresetNameKey(id))}
              </span>
              <span className="board-preset-size">
                {preset.width} × {preset.height}
              </span>
              <span className="board-preset-desc">
                {t(boardPresetDescKey(id))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="settings-board-custom">
        <h3 className="settings-git-block-title">{t("settings.boardCustom")}</h3>
        <div className="settings-board-custom-fields">
          <label className="settings-field">
            <span>{t("settings.boardWidth")}</span>
            <input
              type="number"
              min={800}
              max={8000}
              step={100}
              value={customWidth}
              onChange={(e) => setCustomWidth(e.target.value)}
            />
          </label>
          <label className="settings-field">
            <span>{t("settings.boardHeight")}</span>
            <input
              type="number"
              min={800}
              max={8000}
              step={100}
              value={customHeight}
              onChange={(e) => setCustomHeight(e.target.value)}
            />
          </label>
        </div>
        {error && <p className="settings-git-error">{error}</p>}
        <button type="button" className="btn" onClick={applyCustom}>
          {t("settings.boardApply")}
        </button>
      </div>
    </div>
  );
}
