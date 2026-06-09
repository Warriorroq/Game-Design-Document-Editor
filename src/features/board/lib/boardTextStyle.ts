import type { BoardText } from "@/shared/types";

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

export function nextUniformFlag(current: boolean | null): boolean {
  return current !== true;
}

export function boardTextStyleProps(text: BoardText): {
  fontWeight?: number;
  fontStyle?: string;
  textDecoration?: string;
} {
  return {
    fontWeight: text.bold ? 700 : undefined,
    fontStyle: text.italic ? "italic" : undefined,
    textDecoration: text.strikethrough ? "line-through" : undefined,
  };
}
