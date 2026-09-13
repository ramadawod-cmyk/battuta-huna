// Namespaced flat dictionary, one key per distinct string -- see ARABIC-LOCALIZATION-PLAN.md.
// Phase 0 seeds only what's needed to prove the mechanism (the Settings language row); later
// phases add real keys page by page rather than front-loading a dictionary for pages that don't
// use it yet.
const en = {
  "settings.language": "Language",
  "settings.languageDescription": "Choose the app's display language",
};

export default en;
