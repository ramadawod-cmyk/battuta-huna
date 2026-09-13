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

  "landing.getStarted": "ابدأ الآن",
  "landing.toggleMenu": "تبديل القائمة",
  "landing.quote": "السفر يترك الإنسان بلا كلام، ثم يحوّله إلى راوي حكايات.",
  "landing.quoteAuthor": "— ابن بطوطة",
  "landing.startPlanning": "ابدأ في التخطيط لرحلتك",
  "landing.statSites": "آلاف المواقع الثقافية",
  "landing.statExplorers": "أكثر من 12,000 مستكشف",
  "landing.statRating": "تقييم المستخدمين 4.8",

  "auth.backToApp": "العودة إلى التطبيق",
  "auth.title": "احفظ رحلتك",
  "auth.subtitle": "أنشئ حسابًا مجانيًا للاحتفاظ برحلتك والوصول إليها من أي جهاز.",
  "auth.checkEmail": "تحقق من {email} للحصول على رابط تسجيل الدخول.",
  "auth.useDifferentEmail": "استخدم بريدًا إلكترونيًا آخر",
  "auth.emailPlaceholder": "بريدك الإلكتروني",
  "auth.sending": "جارٍ الإرسال…",
  "auth.sendLink": "أرسل لي رابطًا",
  "auth.invalidEmail": "يرجى إدخال بريد إلكتروني صحيح.",
  "auth.sendError": "تعذر إرسال الرابط، حاول مرة أخرى.",
};

export default ar;
