import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import {
  type AppLanguage,
  loadStoredLanguage,
  type MessageKey,
  saveLanguage,
  translate,
  type TranslateParams,
} from "@/shared/i18n";

interface LocaleContextValue {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  t: (key: MessageKey, params?: TranslateParams) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() =>
    loadStoredLanguage()
  );

  const setLanguage = useCallback((lang: AppLanguage) => {
    saveLanguage(lang);
    setLanguageState(lang);
  }, []);

  const t = useCallback(
    (key: MessageKey, params?: TranslateParams) =>
      translate(language, key, params),
    [language]
  );

  const value = useMemo(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t]
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}
