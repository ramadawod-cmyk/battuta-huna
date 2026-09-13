import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import ar from "./i18n/ar";
import en from "./i18n/en";
import { detectLanguage, dirFor, translate, type Language } from "./i18n/translate";

const STORAGE_KEY = "bh_language";
const DICTIONARIES: Record<Language, typeof en> = { en, ar };

type LanguageContextValue = {
  language: Language;
  dir: "ltr" | "rtl";
  setLanguage: (language: Language) => void;
  t: (key: keyof typeof en, vars?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue>({
  language: "en",
  dir: "ltr",
  setLanguage: () => {},
  t: (key) => key,
});

function loadStoredLanguage(): Language | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === "en" || raw === "ar" ? raw : null;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(
    () => loadStoredLanguage() ?? detectLanguage(navigator.language),
  );

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const dir = dirFor(language);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
  }, [language, dir]);

  const t = useCallback(
    (key: keyof typeof en, vars?: Record<string, string | number>) => translate(DICTIONARIES[language], key, vars),
    [language],
  );

  const value = useMemo(() => ({ language, dir, setLanguage, t }), [language, dir, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
  return useContext(LanguageContext);
}
