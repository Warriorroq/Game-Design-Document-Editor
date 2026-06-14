import { useCallback, useState } from "react";

import {
  applyTheme,
  type AppThemeId,
  loadStoredTheme,
} from "@/shared/lib/appTheme";

export function useAppTheme() {
  const [themeId, setThemeId] = useState<AppThemeId>(() => loadStoredTheme());

  const setTheme = useCallback((id: AppThemeId) => {
    applyTheme(id);
    setThemeId(id);
  }, []);

  return { themeId, setTheme };
}
