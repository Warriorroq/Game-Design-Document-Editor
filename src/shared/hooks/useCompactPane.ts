import { useCallback, useState } from "react";

const STORAGE_KEY = "gdd-compact-pane";

export type CompactPane = "editor" | "board";

function loadPane(): CompactPane {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === "board" ? "board" : "editor";
  } catch {
    return "editor";
  }
}

export function useCompactPane() {
  const [compactPane, setCompactPaneState] = useState<CompactPane>(loadPane);

  const setCompactPane = useCallback((pane: CompactPane) => {
    setCompactPaneState(pane);
    try {
      localStorage.setItem(STORAGE_KEY, pane);
    } catch {
      /* ignore */
    }
  }, []);

  return { compactPane, setCompactPane };
}
