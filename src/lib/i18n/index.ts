import type { BoardSizePresetId } from "../boardSettings";
import type { AppThemeId } from "../themeTokens";
import {
  APP_LANGUAGES,
  MESSAGES,
  type AppLanguage,
  type MessageKey,
} from "./messages";

export type { AppLanguage, MessageKey };
export { APP_LANGUAGES, MESSAGES };

const STORAGE_KEY = "gdd-editor-language";

export function loadStoredLanguage(): AppLanguage {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "ru") return stored;
  } catch {
    /* ignore */
  }
  return "en";
}

export function saveLanguage(lang: AppLanguage): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
  document.documentElement.lang = lang;
}

export function applyStoredLanguage(): void {
  saveLanguage(loadStoredLanguage());
}

export type TranslateParams = Record<string, string | number>;

export function translate(
  lang: AppLanguage,
  key: MessageKey,
  params?: TranslateParams
): string {
  let text = MESSAGES[lang][key] ?? MESSAGES.en[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

export function themeNameKey(id: AppThemeId): MessageKey {
  return `theme.${id}.name` as MessageKey;
}

export function themeDescKey(id: AppThemeId): MessageKey {
  return `theme.${id}.desc` as MessageKey;
}

export function boardPresetNameKey(id: BoardSizePresetId): MessageKey {
  return `board.preset.${id}.name` as MessageKey;
}

export function boardPresetDescKey(id: BoardSizePresetId): MessageKey {
  return `board.preset.${id}.desc` as MessageKey;
}
