import type { BoardText, BoardTextAlign } from "@/domain/types";

/** `true` / `false` when uniform; `null` when mixed across selection. */
export function uniformFlag(
  texts: BoardText[],
  key: "bold" | "italic" | "strikethrough"
): boolean | null {
  if (texts.length === 0) return null;
  const values = texts.map((t) => Boolean(t[key]));
  if (values.every((v) => v)) return true;
  if (values.every((v) => !v)) return false;
  return null;
}

export function uniformTextAlign(texts: BoardText[]): BoardTextAlign | null {
  if (texts.length === 0) return null;
  const values = texts.map((t) => t.textAlign ?? "left");
  const first = values[0]!;
  if (values.every((v) => v === first)) return first;
  return null;
}

export function nextUniformFlag(current: boolean | null): boolean {
  return current !== true;
}

export function boardTextStyleProps(text: BoardText): {
  fontWeight?: number;
  fontStyle?: string;
  textDecoration?: string;
  textAlign?: BoardTextAlign;
} {
  const textAlign = text.textAlign ?? "left";
  return {
    fontWeight: text.bold ? 700 : undefined,
    fontStyle: text.italic ? "italic" : undefined,
    textDecoration: text.strikethrough ? "line-through" : undefined,
    textAlign: textAlign === "left" ? undefined : textAlign,
  };
}
