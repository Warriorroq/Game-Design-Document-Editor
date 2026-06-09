import {
  applyThemeVars,
  resolveThemeId,
  THEME_VARS,
  type AppThemeId,
} from "@/shared/lib/themeTokens";

export type { AppThemeId };

export const APP_THEME_IDS = Object.keys(THEME_VARS) as AppThemeId[];

export function themePreview(id: AppThemeId): [string, string, string] {
  const vars = THEME_VARS[id];
  return [vars["--bg-base"], vars["--accent"], vars["--text"]];
}

const STORAGE_KEY = "gdd-editor-theme";

export function isAppThemeId(value: string): value is AppThemeId {
  return value in THEME_VARS;
}

export function loadStoredTheme(): AppThemeId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return resolveThemeId(stored);
  } catch {
    /* ignore */
  }
  return "midnight";
}

export function applyTheme(id: AppThemeId): void {
  applyThemeVars(id);
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function applyStoredTheme(): void {
  applyTheme(loadStoredTheme());
}
