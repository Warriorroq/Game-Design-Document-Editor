import { useCallback, useState } from "react";

const STORAGE_KEY = "gdd-editor-sidebar-hidden";

function loadHidden(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function useSidebarVisible() {
  const [visible, setVisible] = useState(() => !loadHidden());

  const persistVisible = useCallback((next: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, next ? "0" : "1");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setVisible((current) => {
      const next = !current;
      persistVisible(next);
      return next;
    });
  }, [persistVisible]);

  const setSidebarVisible = useCallback(
    (next: boolean) => {
      setVisible(next);
      persistVisible(next);
    },
    [persistVisible]
  );

  return { sidebarVisible: visible, toggleSidebar, setSidebarVisible };
}
