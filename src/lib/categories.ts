export const CATEGORIES = [
  "Sightseeing",
  "History",
  "Art & Culture",
  "Spiritual",
  "Food & Market",
  "Nature",
  "Neighbourhood",
  "Architecture",
];

const CATEGORY_KEYWORDS: [string, RegExp][] = [
  ["History", /histor|ancient|ruin|monument|fort|castle|archaeolog|roman|heritage site|tomb/i],
  ["Spiritual", /mosque|church|temple|cathedral|shrine|religious|synagogue|basilica|monaster/i],
  ["Art & Culture", /museum|gallery|\bart\b|theatre|theater|opera|cultural cent|exhibit/i],
  ["Food & Market", /market|bazaar|souq|souk|food|restaurant|café|cafe|culinary|dining/i],
  ["Nature", /park|garden|beach|lake|mountain|nature|forest|river|waterfall|wildlife/i],
  ["Neighbourhood", /neighbourhood|neighborhood|district|street|quarter|old town|\bsquare\b|piazza/i],
  ["Architecture", /architect|tower|bridge|building|skyline|palace|design|landmark|fountain/i],
  ["Sightseeing", /.*/],
];

/**
 * The AI (and some pre-existing Supabase data) doesn't reliably stick to the app's
 * fixed 8-tag taxonomy — normalize any category string onto it so category filter
 * pills work consistently regardless of where the data came from.
 */
export function normalizeCategory(raw: string | null | undefined): string {
  if (!raw) return "Sightseeing";
  if (CATEGORIES.includes(raw)) return raw;
  for (const [category, pattern] of CATEGORY_KEYWORDS) {
    if (pattern.test(raw)) return category;
  }
  return "Sightseeing";
}
