import type { ShortcutActionId } from "../shortcuts";
import type { MessageKey } from "./messages";

export function shortcutLabelKey(id: ShortcutActionId): MessageKey {
  return `shortcut.${id}.label` as MessageKey;
}

export function shortcutDescKey(id: ShortcutActionId): MessageKey {
  return `shortcut.${id}.desc` as MessageKey;
}
