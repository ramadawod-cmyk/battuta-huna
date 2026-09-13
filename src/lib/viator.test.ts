import { describe, expect, it } from "vitest";
import { buildViatorSearchUrl } from "./viator";

describe("buildViatorSearchUrl", () => {
  it("builds a Viator search URL with the query URL-encoded", () => {
    const url = buildViatorSearchUrl("Jeita Grotto, Beirut");
    expect(url.startsWith("https://www.viator.com/searchResults/all?")).toBe(true);
    expect(url).toContain("text=Jeita+Grotto%2C+Beirut");
  });

  it("includes affiliate tracking params when a pid is configured", () => {
    // vitest runs with import.meta.env populated from .env -- this repo's local .env sets
    // VITE_VIATOR_PID, so this asserts the tracked-link path rather than the fallback.
    const url = buildViatorSearchUrl("Rome");
    if (import.meta.env.VITE_VIATOR_PID) {
      expect(url).toContain(`pid=${import.meta.env.VITE_VIATOR_PID}`);
      expect(url).toContain("mcid=42383");
      expect(url).toContain("medium=link");
    } else {
      expect(url).not.toContain("pid=");
    }
  });
});
