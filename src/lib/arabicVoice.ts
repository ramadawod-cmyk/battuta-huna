/**
 * The single source of truth for how Arabic content should sound across this app -- referenced by
 * every prompt that asks Claude to produce Arabic text (site/activity/tip generation, translation
 * backfill, day titles, the chat agent). Calibrated against real examples before any content
 * generation started (see NOTES.md for the calibration round). Edit here, not at any individual
 * call site, if the tone ever needs to shift -- that's the whole point of one shared fragment
 * instead of several copies that could quietly drift apart.
 */
export const ARABIC_VOICE_GUIDANCE =
  "Write the Arabic in Modern Standard Arabic (الفصحى) -- never Levantine, Gulf, Egyptian, or any " +
  "other colloquial dialect. It should read as correct, proper Arabic to a reader from any " +
  "Arabic-speaking country. Keep it warm and direct, not bureaucratic or overly formal -- avoid " +
  "the stiff register of news broadcasts or government documents; use natural, modern phrasing " +
  "and address the reader directly. A little descriptive color is welcome where it fits " +
  "naturally, but never slip into exaggerated travel-brochure language or forced enthusiasm -- " +
  "warmth, not cheesiness. Write a native Arabic version of the meaning, not a literal " +
  "word-for-word translation of the English.";
