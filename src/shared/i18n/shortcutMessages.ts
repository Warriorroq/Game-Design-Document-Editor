import type { ShortcutActionId } from "@/shared/lib/shortcuts";
import type { MessageKey } from "@/shared/i18n/messages";

export function shortcutLabelKey(id: ShortcutActionId): MessageKey {
  return `shortcut.${id}.label` as MessageKey;
}

export function shortcutDescKey(id: ShortcutActionId): MessageKey {
  return `shortcut.${id}.desc` as MessageKey;
}
