import type en from "./en";

// Keys must mirror en.ts exactly -- the shared type import below makes a missing/extra key a
// TypeScript error rather than a silent runtime fallback to the English key string.
const ar: typeof en = {
  "settings.language": "اللغة",
  "settings.languageDescription": "اختر لغة عرض التطبيق",
};

export default ar;
