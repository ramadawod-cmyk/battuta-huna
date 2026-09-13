export type Language = "en" | "ar";
export type Dictionary = Record<string, string>;

export const LANGUAGES: Language[] = ["en", "ar"];

// Always shown in their own script regardless of the current UI language -- the standard
// convention for a language switcher's own option labels (see e.g. iOS/most apps: "English" and
// "العربية" never get translated into each other).
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  ar: "العربية",
};

const RTL_LANGUAGES: ReadonlySet<Language> = new Set(["ar"]);

export function dirFor(language: Language): "ltr" | "rtl" {
  return RTL_LANGUAGES.has(language) ? "rtl" : "ltr";
}

/** Resolves a browser language tag ("ar-JO", "en-US", "fr", ...) to a supported app language, defaulting to English for anything unrecognized. */
export function detectLanguage(navigatorLanguage: string | null | undefined): Language {
  if (navigatorLanguage?.toLowerCase().startsWith("ar")) return "ar";
  return "en";
}

/**
 * Looks up `key` in `dict` and substitutes any `{placeholder}` tokens from `vars`. Falls back to
 * the raw key itself (not a blank string) when the key is missing, so a forgotten translation is
 * visibly obvious during development instead of silently rendering nothing.
 */
export function translate(dict: Dictionary, key: string, vars?: Record<string, string | number>): string {
  const template = dict[key] ?? key;
  if (!vars) return template;
  return Object.entries(vars).reduce(
    (result, [varKey, value]) => result.replaceAll(`{${varKey}}`, String(value)),
    template,
  );
}
