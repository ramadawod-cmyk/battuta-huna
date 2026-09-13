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
};

export default en;
