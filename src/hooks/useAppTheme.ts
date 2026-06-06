import { useCallback, useState } from "react";
import {
  applyTheme,
  loadStoredTheme,
  type AppThemeId,
} from "../lib/appTheme";

export function useAppTheme() {
  const [themeId, setThemeId] = useState<AppThemeId>(() => loadStoredTheme());

  const setTheme = useCallback((id: AppThemeId) => {
    applyTheme(id);
    setThemeId(id);
  }, []);

  return { themeId, setTheme };
}
