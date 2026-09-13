// Viator's affiliate program (the tier this app has access to) only ever gives out trackable
// links -- there's no product-search or availability API, so there's no way to know in advance
// whether Viator actually has a bookable tour for a given site or activity. Every place gets the
// same search-results deep link rather than a guess-based subset; if Viator has nothing relevant
// for the query, the traveller just lands on an empty search page instead of a broken link.
const VIATOR_MCID = "42383";

/** Builds a Viator affiliate search-results link for a place, falling back to an untracked search link if no pid is configured (e.g. local dev without the env var set). */
export function buildViatorSearchUrl(query: string): string {
  const pid = import.meta.env.VITE_VIATOR_PID;
  const params = new URLSearchParams({ text: query });
  if (pid) {
    params.set("pid", pid);
    params.set("mcid", VIATOR_MCID);
    params.set("medium", "link");
  }
  return `https://www.viator.com/searchResults/all?${params.toString()}`;
}
