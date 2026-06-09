import type { FormatAction } from "@/features/editor/lib/editorFormat";
import type { ShortcutActionId } from "@/shared/lib/shortcuts";

export const EDITOR_FORMAT_SHORTCUT_ACTIONS: {
  id: ShortcutActionId;
  action: FormatAction;
}[] = [
  { id: "editor.format.bold", action: "bold" },
  { id: "editor.format.italic", action: "italic" },
  { id: "editor.format.h1", action: "h1" },
  { id: "editor.format.h2", action: "h2" },
  { id: "editor.format.h3", action: "h3" },
  { id: "editor.format.paragraph", action: "paragraph" },
];

export function formatActionForShortcut(
  id: ShortcutActionId
): FormatAction | null {
  return (
    EDITOR_FORMAT_SHORTCUT_ACTIONS.find((entry) => entry.id === id)?.action ??
    null
  );
}
