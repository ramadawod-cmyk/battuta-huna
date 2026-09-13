// Namespaced flat dictionary, one key per distinct string -- see ARABIC-LOCALIZATION-PLAN.md.
// Phase 0 seeds only what's needed to prove the mechanism (the Settings language row); later
// phases add real keys page by page rather than front-loading a dictionary for pages that don't
// use it yet.
const en = {
  "settings.language": "Language",
  "settings.languageDescription": "Choose the app's display language",

  "sidebar.explore": "Explore",
  "sidebar.plan": "Plan",
  "sidebar.myTrips": "My Trips",
  "sidebar.about": "About",
  "sidebar.blog": "Blog",
  "sidebar.settings": "Settings",
  "sidebar.openMenu": "Open menu",
  "sidebar.closeMenu": "Close menu",

  "common.backToMyTrips": "Back to My Trips",
  "common.backToTrip": "Back to Trip",
  "common.backToBlog": "Back to Blog",

  "landing.getStarted": "Get Started",
  "landing.toggleMenu": "Toggle menu",
  "landing.quote": "Traveling, it leaves you speechless, then turns you into a storyteller.",
  "landing.quoteAuthor": "— Ibn Battuta",
  "landing.startPlanning": "Start Planning your Trip",
  "landing.statSites": "Thousands of Cultural Sites",
  "landing.statExplorers": "12,000+ Explorers",
  "landing.statRating": "4.8 User Rating",

  "auth.backToApp": "Back to app",
  "auth.title": "Save your trip",
  "auth.subtitle": "Create a free account to keep your itinerary and access it from any device.",
  "auth.checkEmail": "Check {email} for a sign-in link.",
  "auth.useDifferentEmail": "Use a different email",
  "auth.emailPlaceholder": "Your email address",
  "auth.sending": "SENDING…",
  "auth.sendLink": "SEND ME A LINK",
  "auth.invalidEmail": "Please enter a valid email.",
  "auth.sendError": "Couldn't send the link — try again.",
};

export default en;
