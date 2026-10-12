import { describe, expect, it } from "vitest";
import { activityToCandidate, dedupeActivitiesByName, needsArabicTranslation, toActivityRow } from "./activities";
import type { Activity } from "./types";

function makeGenerated(overrides: Partial<Parameters<typeof toActivityRow>[2]> & { name: string }) {
  return {
    activityType: "Beach & Swim",
    description: "A lovely spot.",
    nameAr: "اسم تجريبي",
    descriptionAr: "وصف تجريبي.",
    tags: ["relaxing"],
    lat: 1,
    lng: 2,
    ...overrides,
  };
}

describe("dedupeActivitiesByName", () => {
  it("drops items already present in the avoid list, case-insensitively", () => {
    const avoid: Activity[] = [
      { id: "a", city_id: "beirut", name: "Zaitunay Bay", activity_type: "Nightlife & Drinks", description: "", tags: [], lat: 0, lng: 0 },
    ];
    const items = [makeGenerated({ name: "zaitunay bay" }), makeGenerated({ name: "Pigeon Rocks" })];
    const result = dedupeActivitiesByName(items, avoid);
    expect(result.map((r) => r.name)).toEqual(["Pigeon Rocks"]);
  });

  it("drops duplicates within the same batch, keeping the first occurrence", () => {
    const items = [makeGenerated({ name: "Ramlet al-Baida" }), makeGenerated({ name: "ramlet al-baida" })];
    const result = dedupeActivitiesByName(items);
    expect(result).toHaveLength(1);
  });

  it("keeps everything when nothing collides", () => {
    const items = [makeGenerated({ name: "A" }), makeGenerated({ name: "B" })];
    expect(dedupeActivitiesByName(items)).toHaveLength(2);
  });
});

describe("toActivityRow", () => {
  it("derives a slugified id scoped to the city", () => {
    const row = toActivityRow("beirut", "Beirut", makeGenerated({ name: "Zaitunay Bay" }));
    expect(row.id).toBe("beirut-zaitunay-bay");
    expect(row.city_id).toBe("beirut");
  });

  it("defaults isArea to false and areaName to null when omitted", () => {
    const row = toActivityRow("beirut", "Beirut", makeGenerated({ name: "Ramlet al-Baida" }));
    expect(row.is_area).toBe(false);
    expect(row.area_name).toBeNull();
  });

  it("builds the map_url from areaName when present, falling back to name otherwise", () => {
    const areaRow = toActivityRow(
      "beirut",
      "Beirut",
      makeGenerated({ name: "Go out for drinks", isArea: true, areaName: "Gemmayze" }),
    );
    expect(areaRow.map_url).toContain(encodeURIComponent("Gemmayze, Beirut"));

    const spotRow = toActivityRow("beirut", "Beirut", makeGenerated({ name: "Ramlet al-Baida" }));
    expect(spotRow.map_url).toContain(encodeURIComponent("Ramlet al-Baida, Beirut"));
  });

  it("defaults mustDo to false and durationMinutes to null when omitted", () => {
    const row = toActivityRow("beirut", "Beirut", makeGenerated({ name: "Ramlet al-Baida" }));
    expect(row.must_do).toBe(false);
    expect(row.duration_minutes).toBeNull();
  });

  it("passes through mustDo and durationMinutes when given", () => {
    const row = toActivityRow(
      "beirut",
      "Beirut",
      makeGenerated({ name: "Pigeon Rocks", mustDo: true, durationMinutes: 45 }),
    );
    expect(row.must_do).toBe(true);
    expect(row.duration_minutes).toBe(45);
  });
});

describe("activityToCandidate", () => {
  const activity: Activity = {
    id: "beirut-gemmayzeh",
    city_id: "beirut",
    name: "Gemmayzeh Street Bar Crawl",
    activity_type: "Nightlife & Drinks",
    description: "Beirut's liveliest strip of bars and rooftop lounges.",
    tags: ["nightlife"],
    lat: 33.89,
    lng: 35.51,
    is_area: true,
    area_name: "Gemmayzeh",
    map_url: "https://maps.google.com/?q=Gemmayzeh",
    must_do: true,
    duration_minutes: 180,
  };

  it("maps activity_type to category without running it through the site taxonomy", () => {
    const candidate = activityToCandidate(activity);
    // "Beach & Swim" or "Nightlife & Drinks" would get misclassified by normalizeCategory (site
    // keyword matching), which is exactly why activityToCandidate must not call it.
    expect(candidate.category).toBe("Nightlife & Drinks");
  });

  it("mirrors must_do onto must_see and tags the result as an activity", () => {
    const candidate = activityToCandidate(activity);
    expect(candidate.must_see).toBe(true);
    expect(candidate.kind).toBe("activity");
  });

  it("preserves id, coordinates, and duration unchanged", () => {
    const candidate = activityToCandidate(activity);
    expect(candidate.id).toBe(activity.id);
    expect(candidate.lat).toBe(activity.lat);
    expect(candidate.lng).toBe(activity.lng);
    expect(candidate.duration_minutes).toBe(180);
  });

  it("carries name_ar and description_ar through onto the candidate", () => {
    const candidate = activityToCandidate({ ...activity, name_ar: "اسم", description_ar: "وصف" });
    expect(candidate.name_ar).toBe("اسم");
    expect(candidate.description_ar).toBe("وصف");
  });
});

describe("needsArabicTranslation", () => {
  it("is true when name_ar is missing, null, or empty", () => {
    expect(needsArabicTranslation({})).toBe(true);
    expect(needsArabicTranslation({ name_ar: null })).toBe(true);
    expect(needsArabicTranslation({ name_ar: "" })).toBe(true);
  });

  it("is false once name_ar is populated", () => {
    expect(needsArabicTranslation({ name_ar: "اسم" })).toBe(false);
  });
});
