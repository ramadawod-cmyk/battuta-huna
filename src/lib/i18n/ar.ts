import type en from "./en";

// Keys must mirror en.ts exactly -- the shared type import below makes a missing/extra key a
// TypeScript error rather than a silent runtime fallback to the English key string.
const ar: typeof en = {
  "settings.language": "اللغة",
  "settings.languageDescription": "اختر لغة عرض التطبيق",

  "sidebar.explore": "استكشف",
  "sidebar.plan": "خطّط",
  "sidebar.myTrips": "رحلاتي",
  "sidebar.about": "حول",
  "sidebar.blog": "المدونة",
  "sidebar.settings": "الإعدادات",
  "sidebar.openMenu": "فتح القائمة",
  "sidebar.closeMenu": "إغلاق القائمة",

  "common.backToMyTrips": "العودة إلى رحلاتي",
  "common.backToTrip": "العودة إلى الرحلة",
  "common.backToBlog": "العودة إلى المدونة",
};

export default ar;
