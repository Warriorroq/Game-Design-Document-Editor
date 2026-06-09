import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/shared/context/LocaleContext";
import { shortcutLabelKey } from "@/shared/i18n/shortcutMessages";
import { useShortcuts } from "@/shared/context/ShortcutsContext";
import {
  bindingsEqual,
  formatShortcut,
  SHORTCUT_DEFINITIONS,
  type ShortcutActionId,
} from "@/shared/lib/shortcuts";

interface ShortcutBindingInputProps {
  actionId: ShortcutActionId;
}

export function ShortcutBindingInput({ actionId }: ShortcutBindingInputProps) {
  const { t } = useLocale();
  const { bindings, setBinding, resetBinding, bindingFromEvent, findConflict } =
    useShortcuts();
  const [recording, setRecording] = useState(false);
  const [conflictId, setConflictId] = useState<ShortcutActionId | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const binding = bindings[actionId];
  const defaultBinding = SHORTCUT_DEFINITIONS.find((d) => d.id === actionId)!
    .defaultBinding;
  const isDefault = bindingsEqual(binding, defaultBinding);

  useEffect(() => {
    if (!recording) return;

    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setRecording(false);
        setConflictId(null);
        return;
      }

      const next = bindingFromEvent(e);
      if (!next) return;

      const conflict = findConflict(actionId, next);
      if (conflict) {
        setConflictId(conflict);
        return;
      }

      setBinding(actionId, next);
      setConflictId(null);
      setRecording(false);
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [actionId, bindingFromEvent, findConflict, recording, setBinding]);

  return (
    <div className="shortcut-binding-cell">
      <button
        ref={buttonRef}
        type="button"
        className={`shortcut-kbd ${recording ? "recording" : ""}`}
        aria-label={t("settings.shortcutsChangeAria")}
        onClick={() => {
          setConflictId(null);
          setRecording(true);
          buttonRef.current?.focus();
        }}
        onBlur={() => {
          if (recording) {
            setRecording(false);
            setConflictId(null);
          }
        }}
      >
        {recording ? t("settings.shortcutsPressKeys") : formatShortcut(binding)}
      </button>
      {!isDefault && (
        <button
          type="button"
          className="shortcut-reset-one"
          onClick={() => resetBinding(actionId)}
          title={t("settings.shortcutsResetOne")}
        >
          ↺
        </button>
      )}
      {conflictId && (
        <span className="shortcut-conflict" role="alert">
          {t("settings.shortcutsConflict", {
            action: t(shortcutLabelKey(conflictId)),
          })}
        </span>
      )}
    </div>
  );
}
