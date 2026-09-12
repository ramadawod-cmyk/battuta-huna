import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  CATEGORY_ACCENTS,
  CATEGORY_DURATION_MINUTES,
  formatDuration,
  getDurationMinutes,
  normalizeCategory,
} from "./categories";

describe("normalizeCategory", () => {
  it("passes canonical categories through unchanged", () => {
    for (const category of CATEGORIES) {
      expect(normalizeCategory(category)).toBe(category);
    }
  });

  it("maps common AI/legacy category strings onto the fixed taxonomy", () => {
    expect(normalizeCategory("Ancient Roman Ruins")).toBe("History");
    expect(normalizeCategory("Museum of Modern Art")).toBe("Art & Culture");
    expect(normalizeCategory("Local Souk")).toBe("Food & Market");
    expect(normalizeCategory("Grand Mosque")).toBe("Spiritual");
    expect(normalizeCategory("National Park")).toBe("Nature");
    expect(normalizeCategory("Old Town Quarter")).toBe("Neighbourhood");
    expect(normalizeCategory("Suspension Bridge")).toBe("Architecture");
  });

  it("falls back to Sightseeing for anything unrecognized or missing", () => {
    expect(normalizeCategory("Some Made Up Category")).toBe("Sightseeing");
    expect(normalizeCategory(null)).toBe("Sightseeing");
    expect(normalizeCategory(undefined)).toBe("Sightseeing");
    expect(normalizeCategory("")).toBe("Sightseeing");
  });
});

describe("category accent/duration maps", () => {
  it("has an accent color for every canonical category", () => {
    for (const category of CATEGORIES) {
      expect(CATEGORY_ACCENTS[category]).toBeDefined();
    }
  });

  it("has a default duration for every canonical category", () => {
    for (const category of CATEGORIES) {
      expect(CATEGORY_DURATION_MINUTES[category]).toBeGreaterThan(0);
    }
  });
});

describe("getDurationMinutes", () => {
  it("prefers the site's own duration_minutes when set", () => {
    expect(getDurationMinutes({ duration_minutes: 42, category: "Nature" })).toBe(42);
  });

  it("falls back to the category default when duration_minutes is missing", () => {
    expect(getDurationMinutes({ category: "Spiritual" })).toBe(CATEGORY_DURATION_MINUTES["Spiritual"]);
  });

  it("normalizes the category before looking up the fallback duration", () => {
    expect(getDurationMinutes({ category: "Grand Mosque" })).toBe(CATEGORY_DURATION_MINUTES["Spiritual"]);
  });
});

describe("formatDuration", () => {
  it("formats whole hours with no minutes", () => {
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(120)).toBe("2h");
  });

  it("formats hours plus minutes", () => {
    expect(formatDuration(90)).toBe("1h 30m");
  });

  it("formats sub-hour durations as minutes only", () => {
    expect(formatDuration(45)).toBe("45m");
  });

  it("formats zero as 0m", () => {
    expect(formatDuration(0)).toBe("0m");
  });
});
