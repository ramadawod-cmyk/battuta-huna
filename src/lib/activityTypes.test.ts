import { describe, expect, it } from "vitest";
import ar from "./i18n/ar";
import en from "./i18n/en";
import { ACTIVITY_TYPES, ACTIVITY_TYPE_ACCENTS, ACTIVITY_TYPE_LABEL_KEYS, normalizeActivityType } from "./activityTypes";

describe("normalizeActivityType", () => {
  it("passes canonical activity types through unchanged", () => {
    for (const type of ACTIVITY_TYPES) {
      expect(normalizeActivityType(type)).toBe(type);
    }
  });

  it("maps common AI phrasing onto the fixed taxonomy", () => {
    expect(normalizeActivityType("Public Beach")).toBe("Beach & Swim");
    expect(normalizeActivityType("Bar District")).toBe("Nightlife & Drinks");
    expect(normalizeActivityType("Souk Shopping")).toBe("Shopping");
    expect(normalizeActivityType("Mountain Hike")).toBe("Outdoor & Adventure");
    expect(normalizeActivityType("Culinary Tour")).toBe("Food Experience");
    expect(normalizeActivityType("Spa Retreat")).toBe("Wellness & Relaxation");
    expect(normalizeActivityType("Day Trip to Petra")).toBe("Day Trip");
    expect(normalizeActivityType("Live Music Show")).toBe("Live Entertainment");
  });

  it("falls back to Outdoor & Adventure for anything unrecognized or missing", () => {
    expect(normalizeActivityType("Something Unrecognizable")).toBe("Outdoor & Adventure");
    expect(normalizeActivityType(null)).toBe("Outdoor & Adventure");
    expect(normalizeActivityType(undefined)).toBe("Outdoor & Adventure");
    expect(normalizeActivityType("")).toBe("Outdoor & Adventure");
  });
});

describe("ACTIVITY_TYPE_ACCENTS", () => {
  it("has an accent color for every canonical activity type", () => {
    for (const type of ACTIVITY_TYPES) {
      expect(ACTIVITY_TYPE_ACCENTS[type]).toBeDefined();
    }
  });
});

describe("ACTIVITY_TYPE_LABEL_KEYS", () => {
  it("has a display-label key for every canonical activity type, resolvable in both languages", () => {
    for (const type of ACTIVITY_TYPES) {
      const key = ACTIVITY_TYPE_LABEL_KEYS[type];
      expect(key).toBeDefined();
      expect(en[key]).toBeTruthy();
      expect(ar[key]).toBeTruthy();
    }
  });
});
