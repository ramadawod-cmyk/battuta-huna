const FULL_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_ABBR_TO_FULL: Record<string, string> = {
  Jan: "January", Feb: "February", Mar: "March", Apr: "April",
  May: "May", Jun: "June", Jul: "July", Aug: "August",
  Sep: "September", Oct: "October", Nov: "November", Dec: "December",
};

/**
 * Redacts a trip's `dates` label down to month + year for the public share view -- an exact date
 * range on a page anyone can open is a "this home is empty on these dates" signal, so the shared
 * page never shows it. Parses both formats PlanDatePicker produces ("Sep 13 – Sep 16, 2026" and
 * "September 2026 (flexible)") plus falls back gracefully for anything else (missing dates, a
 * format this doesn't recognize) rather than accidentally leaking the raw string.
 */
export function publicDateLabel(trip: { dates?: string | null; duration?: number | null }): string {
  const duration = trip.duration && trip.duration > 0 ? trip.duration : null;
  const durationLabel = duration ? `${duration} day${duration === 1 ? "" : "s"}` : null;

  const dates = trip.dates?.trim();
  if (!dates) return durationLabel || "Dates flexible";

  const yearMatch = dates.match(/\b(20\d{2})\b/);
  const year = yearMatch?.[1];

  const fullMonth = FULL_MONTHS.find((m) => dates.includes(m));
  const abbrMatch = dates.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/);
  const month = fullMonth || (abbrMatch ? MONTH_ABBR_TO_FULL[abbrMatch[1]] : undefined);

  const monthYear = [month, year].filter(Boolean).join(" ");
  if (durationLabel && monthYear) return `${durationLabel} · ${monthYear}`;
  return monthYear || durationLabel || "Dates flexible";
}

/** Builds the public share URL for a trip -- the trip's own (unguessable) id doubles as the share token. */
export function shareUrl(origin: string, tripId: string): string {
  return `${origin}/shared/${tripId}`;
}
