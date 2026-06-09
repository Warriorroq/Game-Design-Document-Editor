import type { CSSProperties } from "react";
import { BOARD_TEXT_COLORS } from "@/features/board/lib/boardTextColors";

interface TextColorSwatchesProps {
  activeColor: string | null;
  onPick: (color: string) => void;
  label?: string;
}

export function TextColorSwatches({
  activeColor,
  onPick,
  label = "Text color",
}: TextColorSwatchesProps) {
  return (
    <div className="text-color-toolbar">
      <span className="text-color-toolbar-label">{label}</span>
      <div className="text-color-swatches" role="group" aria-label={label}>
        {BOARD_TEXT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`text-color-swatch ${activeColor === color ? "active" : ""}`}
            style={{ "--swatch": color } as CSSProperties}
            aria-label={`Color ${color}`}
            aria-pressed={activeColor === color}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(color)}
          />
        ))}
      </div>
    </div>
  );
}
