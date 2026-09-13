import { describe, expect, it } from "vitest";
import { dedupeActivitiesByName, toActivityRow } from "./activities";
import type { Activity } from "./types";

function makeGenerated(overrides: Partial<Parameters<typeof toActivityRow>[2]> & { name: string }) {
  return {
    activityType: "Beach & Swim",
    description: "A lovely spot.",
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
