export const SHORTCUT_ACTION_IDS = [
  "undo",
  "editor.format.bold",
  "editor.format.italic",
  "editor.format.h1",
  "editor.format.h2",
  "editor.format.h3",
  "editor.format.paragraph",
  "desk.copy",
  "desk.paste",
  "desk.delete",
  "desk.cancel",
] as const;

export type ShortcutActionId = (typeof SHORTCUT_ACTION_IDS)[number];

export type ShortcutGroup = "editor" | "desk";

export interface ShortcutBinding {
  key: string;
  ctrlOrMeta: boolean;
  shift: boolean;
  alt: boolean;
}

export interface ShortcutDefinition {
  id: ShortcutActionId;
  group: ShortcutGroup;
  defaultBinding: ShortcutBinding;
}

export const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  {
    id: "undo",
    group: "editor",
    defaultBinding: { key: "z", ctrlOrMeta: true, shift: false, alt: false },
  },
  {
    id: "editor.format.bold",
    group: "editor",
    defaultBinding: { key: "b", ctrlOrMeta: true, shift: false, alt: false },
  },
  {
    id: "editor.format.italic",
    group: "editor",
    defaultBinding: { key: "i", ctrlOrMeta: true, shift: false, alt: false },
  },
  {
    id: "editor.format.h1",
    group: "editor",
    defaultBinding: { key: "1", ctrlOrMeta: true, shift: false, alt: true },
  },
  {
    id: "editor.format.h2",
    group: "editor",
    defaultBinding: { key: "2", ctrlOrMeta: true, shift: false, alt: true },
  },
  {
    id: "editor.format.h3",
    group: "editor",
    defaultBinding: { key: "3", ctrlOrMeta: true, shift: false, alt: true },
  },
  {
    id: "editor.format.paragraph",
    group: "editor",
    defaultBinding: { key: "0", ctrlOrMeta: true, shift: false, alt: true },
  },
  {
    id: "desk.copy",
    group: "desk",
    defaultBinding: { key: "c", ctrlOrMeta: true, shift: false, alt: false },
  },
  {
    id: "desk.paste",
    group: "desk",
    defaultBinding: { key: "v", ctrlOrMeta: true, shift: false, alt: false },
  },
  {
    id: "desk.delete",
    group: "desk",
    defaultBinding: { key: "Delete", ctrlOrMeta: false, shift: false, alt: false },
  },
  {
    id: "desk.cancel",
    group: "desk",
    defaultBinding: { key: "Escape", ctrlOrMeta: false, shift: false, alt: false },
  },
];

const STORAGE_KEY = "gdd-editor-shortcuts";

const MODIFIER_KEYS = new Set([
  "Control",
  "Shift",
  "Alt",
  "Meta",
  "OS",
]);

export function defaultShortcutBindings(): Record<
  ShortcutActionId,
  ShortcutBinding
> {
  const out = {} as Record<ShortcutActionId, ShortcutBinding>;
  for (const def of SHORTCUT_DEFINITIONS) {
    out[def.id] = { ...def.defaultBinding };
  }
  return out;
}

function isBinding(value: unknown): value is ShortcutBinding {
  if (!value || typeof value !== "object") return false;
  const b = value as ShortcutBinding;
  return (
    typeof b.key === "string" &&
    b.key.length > 0 &&
    typeof b.ctrlOrMeta === "boolean" &&
    typeof b.shift === "boolean" &&
    typeof b.alt === "boolean"
  );
}

export function loadShortcutBindings(): Record<ShortcutActionId, ShortcutBinding> {
  const bindings = defaultShortcutBindings();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return bindings;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const id of SHORTCUT_ACTION_IDS) {
      const stored = parsed[id];
      if (isBinding(stored)) bindings[id] = { ...stored };
    }
  } catch {
    /* ignore */
  }
  return bindings;
}

export function saveShortcutBindings(
  bindings: Record<ShortcutActionId, ShortcutBinding>
): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
  } catch {
    /* ignore */
  }
}

export function normalizeEventKey(e: KeyboardEvent): string {
  if (e.key === " ") return " ";
  if (e.key === "Backslash") return "\\";
  if (e.key.length === 1) return e.key.toLowerCase();
  return e.key;
}

export function bindingFromKeyboardEvent(
  e: KeyboardEvent
): ShortcutBinding | null {
  if (MODIFIER_KEYS.has(e.key)) return null;
  return {
    key: normalizeEventKey(e),
    ctrlOrMeta: e.ctrlKey || e.metaKey,
    shift: e.shiftKey,
    alt: e.altKey,
  };
}

export function bindingsEqual(a: ShortcutBinding, b: ShortcutBinding): boolean {
  return (
    a.key === b.key &&
    a.ctrlOrMeta === b.ctrlOrMeta &&
    a.shift === b.shift &&
    a.alt === b.alt
  );
}

export function findBindingConflict(
  bindings: Record<ShortcutActionId, ShortcutBinding>,
  actionId: ShortcutActionId,
  candidate: ShortcutBinding
): ShortcutActionId | null {
  for (const id of SHORTCUT_ACTION_IDS) {
    if (id === actionId) continue;
    if (bindingsEqual(bindings[id], candidate)) return id;
  }
  return null;
}

export function eventMatchesBinding(
  e: KeyboardEvent,
  binding: ShortcutBinding
): boolean {
  const mod = e.ctrlKey || e.metaKey;
  if (binding.ctrlOrMeta !== mod) return false;
  if (binding.shift !== e.shiftKey) return false;
  if (binding.alt !== e.altKey) return false;

  const key = normalizeEventKey(e);
  if (key === binding.key) return true;
  if (binding.key === "Delete" && key === "Backspace") return true;
  return false;
}

function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPod|iPad/i.test(navigator.platform);
}

function formatKeyLabel(key: string, mac: boolean): string {
  switch (key) {
    case " ":
      return mac ? "Space" : "Space";
    case "Escape":
      return "Esc";
    case "Delete":
      return mac ? "⌫" : "Del";
    case "Backspace":
      return mac ? "⌫" : "Backspace";
    case "\\":
      return "\\";
    default:
      return key.length === 1 ? key.toUpperCase() : key;
  }
}

export function formatShortcut(binding: ShortcutBinding): string {
  const mac = isMacPlatform();
  const parts: string[] = [];

  if (binding.ctrlOrMeta) parts.push(mac ? "⌘" : "Ctrl");
  if (binding.shift) parts.push(mac ? "⇧" : "Shift");
  if (binding.alt) parts.push(mac ? "⌥" : "Alt");
  parts.push(formatKeyLabel(binding.key, mac));

  return mac ? parts.join("") : parts.join(" + ");
}
