import type { CSSProperties } from "react";
import { useLocale } from "@/shared/context/LocaleContext";
import {
  BOARD_PEN_COLORS,
  BOARD_PEN_WIDTHS,
  type BoardPenWidth,
} from "@/features/board/lib/boardPen";
import { nextUniformFlag, uniformFlag } from "@/features/board/lib/boardTextStyle";
import { resolveBoardTextColor } from "@/shared/lib/textColorUtils";
import type { BoardText } from "@/shared/types";
import { TextColorSwatches } from "@/shared/components/TextColorSwatches";

interface BoardToolbarProps {
  penMode: boolean;
  onPenModeChange: (penMode: boolean) => void;
  penColor: string;
  penWidth: number;
  onPenColorChange: (color: string) => void;
  onPenWidthChange: (width: BoardPenWidth) => void;
  selectedTextIds: string[];
  texts: BoardText[];
  onTextColorChange: (textIds: string[], color: string) => void;
  onTextStyleChange: (
    textIds: string[],
    patch: Pick<BoardText, "bold" | "italic" | "strikethrough">
  ) => void;
}

export function BoardToolbar({
  penMode,
  onPenModeChange,
  penColor,
  penWidth,
  onPenColorChange,
  onPenWidthChange,
  selectedTextIds,
  texts,
  onTextColorChange,
  onTextStyleChange,
}: BoardToolbarProps) {
  const { t } = useLocale();
  const hasTextSelection = selectedTextIds.length > 0;

  const selectedTexts = hasTextSelection
    ? selectedTextIds
        .map((id) => texts.find((t) => t.id === id))
        .filter((t): t is BoardText => Boolean(t))
    : [];

  const textColors = selectedTexts.map((t) => resolveBoardTextColor(t.color));
  const activeTextColor =
    textColors.length > 0 && textColors.every((c) => c === textColors[0])
      ? textColors[0]
      : null;

  const boldState = uniformFlag(selectedTexts, "bold");
  const italicState = uniformFlag(selectedTexts, "italic");
  const strikeState = uniformFlag(selectedTexts, "strikethrough");

  return (
    <footer className="board-toolbar">
      <div className="board-toolbar-row">
        <div
          className="board-desk-mode-group"
          role="group"
          aria-label={t("desk.modeAria")}
        >
          <button
            type="button"
            className={`board-desk-mode-btn ${penMode ? "active" : ""}`}
            title={t("desk.penTitle")}
            aria-label={t("desk.pen")}
            aria-pressed={penMode}
            onClick={() => onPenModeChange(true)}
          >
            {t("desk.pen")}
          </button>
          <button
            type="button"
            className={`board-desk-mode-btn ${!penMode ? "active" : ""}`}
            title={t("desk.moveTitle")}
            aria-label={t("desk.move")}
            aria-pressed={!penMode}
            onClick={() => onPenModeChange(false)}
          >
            {t("desk.move")}
          </button>
        </div>

        {penMode && (
          <>
            <div
              className="board-pen-colors"
              role="group"
              aria-label={t("desk.penColorAria")}
            >
              {BOARD_PEN_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`text-color-swatch ${penColor === color ? "active" : ""}`}
                  style={{ "--swatch": color } as CSSProperties}
                  aria-label={`Pen color ${color}`}
                  aria-pressed={penColor === color}
                  onClick={() => onPenColorChange(color)}
                />
              ))}
            </div>
            <div
              className="board-pen-widths"
              role="group"
              aria-label={t("desk.penThicknessAria")}
            >
              {BOARD_PEN_WIDTHS.map((w) => (
                <button
                  key={w}
                  type="button"
                  className={`board-pen-width-btn ${penWidth === w ? "active" : ""}`}
                  title={`Thickness ${w}px`}
                  aria-label={`Thickness ${w}px`}
                  aria-pressed={penWidth === w}
                  onClick={() => onPenWidthChange(w)}
                >
                  <span
                    className="board-pen-width-dot"
                    style={{ width: w + 4, height: w + 4 }}
                  />
                </button>
              ))}
            </div>
          </>
        )}

        {hasTextSelection && (
          <>
            <div
              className="board-text-style-group"
              role="group"
              aria-label={t("desk.textStyleAria")}
            >
              <button
                type="button"
                className={`board-text-style-btn ${boldState === true ? "active" : ""}`}
                title="Bold"
                aria-label="Bold"
                aria-pressed={boldState === true}
                onClick={() =>
                  onTextStyleChange(selectedTextIds, {
                    bold: nextUniformFlag(boldState),
                  })
                }
              >
                B
              </button>
              <button
                type="button"
                className={`board-text-style-btn board-text-style-btn--italic ${italicState === true ? "active" : ""}`}
                title="Italic"
                aria-label="Italic"
                aria-pressed={italicState === true}
                onClick={() =>
                  onTextStyleChange(selectedTextIds, {
                    italic: nextUniformFlag(italicState),
                  })
                }
              >
                I
              </button>
              <button
                type="button"
                className={`board-text-style-btn ${strikeState === true ? "active" : ""}`}
                title="Strikethrough"
                aria-label="Strikethrough"
                aria-pressed={strikeState === true}
                onClick={() =>
                  onTextStyleChange(selectedTextIds, {
                    strikethrough: nextUniformFlag(strikeState),
                  })
                }
              >
                <span className="board-text-style-btn-strike">S</span>
              </button>
            </div>
            <TextColorSwatches
              activeColor={activeTextColor}
              onPick={(color) => onTextColorChange(selectedTextIds, color)}
            />
          </>
        )}
      </div>
    </footer>
  );
}
