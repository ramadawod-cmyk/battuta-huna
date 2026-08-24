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

/** Typical time (minutes) a traveller spends at a place of this category, used when a site has no AI-estimated duration_minutes of its own. */
export const CATEGORY_DURATION_MINUTES: Record<string, number> = {
  "Sightseeing": 60,
  "History": 75,
  "Art & Culture": 90,
  "Spiritual": 30,
  "Food & Market": 60,
  "Nature": 90,
  "Neighbourhood": 60,
  "Architecture": 30,
};

export function getDurationMinutes(site: { duration_minutes?: number | null; category: string }): number {
  return site.duration_minutes ?? CATEGORY_DURATION_MINUTES[normalizeCategory(site.category)] ?? 60;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
