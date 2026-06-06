import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  bindingFromKeyboardEvent,
  defaultShortcutBindings,
  eventMatchesBinding,
  findBindingConflict,
  loadShortcutBindings,
  saveShortcutBindings,
  SHORTCUT_DEFINITIONS,
  type ShortcutActionId,
  type ShortcutBinding,
} from "../lib/shortcuts";

interface ShortcutsContextValue {
  bindings: Record<ShortcutActionId, ShortcutBinding>;
  matches: (actionId: ShortcutActionId, e: KeyboardEvent) => boolean;
  setBinding: (
    actionId: ShortcutActionId,
    binding: ShortcutBinding
  ) => ShortcutActionId | null;
  resetBinding: (actionId: ShortcutActionId) => void;
  resetAll: () => void;
  bindingFromEvent: (e: KeyboardEvent) => ShortcutBinding | null;
  findConflict: (
    actionId: ShortcutActionId,
    candidate: ShortcutBinding
  ) => ShortcutActionId | null;
}

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null);

export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const [bindings, setBindings] = useState(loadShortcutBindings);

  const persist = useCallback(
    (next: Record<ShortcutActionId, ShortcutBinding>) => {
      setBindings(next);
      saveShortcutBindings(next);
    },
    []
  );

  const matches = useCallback(
    (actionId: ShortcutActionId, e: KeyboardEvent) =>
      eventMatchesBinding(e, bindings[actionId]),
    [bindings]
  );

  const setBinding = useCallback(
    (actionId: ShortcutActionId, binding: ShortcutBinding) => {
      const conflict = findBindingConflict(bindings, actionId, binding);
      if (conflict) return conflict;
      const next = { ...bindings, [actionId]: binding };
      persist(next);
      return null;
    },
    [bindings, persist]
  );

  const resetBinding = useCallback(
    (actionId: ShortcutActionId) => {
      const def = SHORTCUT_DEFINITIONS.find((d) => d.id === actionId);
      if (!def) return;
      persist({ ...bindings, [actionId]: { ...def.defaultBinding } });
    },
    [bindings, persist]
  );

  const resetAll = useCallback(() => {
    persist(defaultShortcutBindings());
  }, [persist]);

  const findConflict = useCallback(
    (actionId: ShortcutActionId, candidate: ShortcutBinding) =>
      findBindingConflict(bindings, actionId, candidate),
    [bindings]
  );

  const value = useMemo(
    () => ({
      bindings,
      matches,
      setBinding,
      resetBinding,
      resetAll,
      bindingFromEvent: bindingFromKeyboardEvent,
      findConflict,
    }),
    [bindings, matches, setBinding, resetBinding, resetAll, findConflict]
  );

  return (
    <ShortcutsContext.Provider value={value}>
      {children}
    </ShortcutsContext.Provider>
  );
}

export function useShortcuts() {
  const ctx = useContext(ShortcutsContext);
  if (!ctx) {
    throw new Error("useShortcuts must be used within ShortcutsProvider");
  }
  return ctx;
}
