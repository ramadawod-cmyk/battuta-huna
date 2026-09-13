import { describe, expect, it } from "vitest";
import { ACTIVITY_TYPES } from "./activityTypes";
import { planItinerary, planMultiCityItinerary, splitDaysAcrossLegs, type ItineraryLeg } from "./itineraryPlanner";
import type { Site } from "./types";

function makeSites(cityLat: number, cityLng: number, count: number, namePrefix: string): Site[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${namePrefix}-${i}`,
    city_id: namePrefix,
    name: `${namePrefix} Site ${i}`,
    category: "Sightseeing",
    tags: [],
    description: "",
    // Small offsets keep every site well within MAX_STOP_DISTANCE_METERS of the others, so a
    // day's worth of sites cluster together the way a real dense city center would.
    lat: cityLat + i * 0.002,
    lng: cityLng + i * 0.002,
    duration_minutes: 60,
  }));
}

function makeActivity(overrides: Partial<Site> & { name: string; lat: number; lng: number }): Site {
  return {
    id: overrides.name,
    city_id: "city",
    category: "Nightlife & Drinks",
    tags: [],
    description: "",
    duration_minutes: 90,
    kind: "activity",
    ...overrides,
  };
}

// 8:30 PM -- the tests below assert an evening pick never lands before this, mirroring
// DINNER_START + DINNER_MINUTES inside itineraryPlanner.ts (not exported, so re-derived here).
const DINNER_END_MINUTES = 20 * 60 + 30;

function timeToMinutes(time: string): number {
  const [, hourStr, minuteStr, period] = time.match(/(\d+):(\d+) (AM|PM)/) as RegExpMatchArray;
  let hour = Number(hourStr) % 12;
  if (period === "PM") hour += 12;
  return hour * 60 + Number(minuteStr);
}

describe("splitDaysAcrossLegs", () => {
  it("splits evenly when duration divides cleanly", () => {
    expect(splitDaysAcrossLegs(6, 2)).toEqual([3, 3]);
  });

  it("gives the remainder to the earlier legs", () => {
    expect(splitDaysAcrossLegs(5, 2)).toEqual([3, 2]);
    expect(splitDaysAcrossLegs(7, 3)).toEqual([3, 2, 2]);
  });

  it("always sums to duration when duration >= legCount", () => {
    const split = splitDaysAcrossLegs(10, 4);
    expect(split.reduce((a, b) => a + b, 0)).toBe(10);
    expect(split.every((d) => d >= 1)).toBe(true);
  });

  it("still gives every leg at least one day when duration < legCount, rather than leaving any at zero", () => {
    const split = splitDaysAcrossLegs(2, 4);
    expect(split).toHaveLength(4);
    expect(split.every((d) => d >= 1)).toBe(true);
  });

  it("returns an empty array for zero legs", () => {
    expect(splitDaysAcrossLegs(5, 0)).toEqual([]);
  });
});

describe("planItinerary", () => {
  it("pins the evening-affinity taxonomy against ACTIVITY_TYPES so a rename doesn't silently break scheduling", () => {
    expect(ACTIVITY_TYPES).toContain("Nightlife & Drinks");
    expect(ACTIVITY_TYPES).toContain("Live Entertainment");
  });

  it("schedules a must-see evening activity after dinner as the day's last stop, not wherever its geography would otherwise place it", () => {
    const daytime = makeSites(41.9, 12.5, 4, "rome");
    const nightlife = makeActivity({ name: "Trastevere Bar Crawl", lat: 41.9, lng: 12.5, must_see: true });
    const days = planItinerary([...daytime, nightlife], 1, "Relaxed");

    expect(days).toHaveLength(1);
    const slots = days[0].slots;
    expect(slots[slots.length - 1].name).toBe("Trastevere Bar Crawl");
    expect(timeToMinutes(slots[slots.length - 1].time)).toBeGreaterThanOrEqual(DINNER_END_MINUTES);
  });

  it("spreads multiple evening activities one per day instead of stacking them on a single day", () => {
    const daytimeDay1 = makeSites(41.9, 12.5, 3, "rome-a");
    const daytimeDay2 = makeSites(41.95, 12.55, 3, "rome-b");
    const nightlifeNearA = makeActivity({ name: "Bar Near A", lat: 41.9, lng: 12.5 });
    const nightlifeNearB = makeActivity({ name: "Bar Near B", lat: 41.95, lng: 12.55 });
    const days = planItinerary([...daytimeDay1, ...daytimeDay2, nightlifeNearA, nightlifeNearB], 2, "Relaxed");

    const eveningNames = days.map((d) => d.slots[d.slots.length - 1]?.name);
    expect(eveningNames).toContain("Bar Near A");
    expect(eveningNames).toContain("Bar Near B");
  });

  it("gives an otherwise-empty day an evening activity rather than leaving it fully empty", () => {
    const nightlife = makeActivity({ name: "Only Nightlife Option", lat: 41.9, lng: 12.5 });
    const days = planItinerary([nightlife], 1, "Relaxed");
    expect(days[0].slots).toHaveLength(1);
    expect(days[0].slots[0].name).toBe("Only Nightlife Option");
  });

  it("does not hold out non-evening activity types -- they schedule through the normal daytime walk", () => {
    const beach = makeActivity({ name: "City Beach", lat: 41.9, lng: 12.5, category: "Beach & Swim" });
    const days = planItinerary([beach], 1, "Relaxed");
    expect(days[0].slots.map((s) => s.name)).toContain("City Beach");
    expect(timeToMinutes(days[0].slots[0].time)).toBe(9 * 60); // scheduled at the normal day start, not held for evening
  });

  it("leaves a day with only regular sites unaffected -- no evening slot appended when there's no evening candidate", () => {
    const days = planItinerary(makeSites(41.9, 12.5, 3, "rome"), 1, "Relaxed");
    expect(days[0].slots.every((s) => s.kind === undefined)).toBe(true);
  });
});

describe("planMultiCityItinerary", () => {
  it("renumbers days consecutively across legs and stamps each with its leg's city", () => {
    const legs: ItineraryLeg[] = [
      { city: "Rome", cityId: "rome", country: "Italy", days: 2, sites: makeSites(41.9, 12.5, 8, "rome") },
      { city: "Florence", cityId: "florence", country: "Italy", days: 2, sites: makeSites(43.77, 11.25, 8, "florence") },
    ];
    const result = planMultiCityItinerary(legs, "Relaxed");

    expect(result.map((d) => d.day)).toEqual([1, 2, 3, 4]);
    expect(result.slice(0, 2).every((d) => d.city === "Rome" && d.cityId === "rome" && d.country === "Italy")).toBe(true);
    expect(result.slice(2, 4).every((d) => d.city === "Florence" && d.cityId === "florence")).toBe(true);
  });

  it("respects each leg's requested day count", () => {
    const legs: ItineraryLeg[] = [
      { city: "Rome", cityId: "rome", days: 1, sites: makeSites(41.9, 12.5, 6, "rome") },
      { city: "Florence", cityId: "florence", days: 3, sites: makeSites(43.77, 11.25, 12, "florence") },
    ];
    const result = planMultiCityItinerary(legs, "Relaxed");
    const romeDays = result.filter((d) => d.cityId === "rome");
    const florenceDays = result.filter((d) => d.cityId === "florence");
    expect(romeDays).toHaveLength(1);
    expect(florenceDays).toHaveLength(3);
  });

  it("gives a leg with no sites its full share of empty days instead of crashing or skipping it", () => {
    const legs: ItineraryLeg[] = [
      { city: "Rome", cityId: "rome", days: 2, sites: makeSites(41.9, 12.5, 8, "rome") },
      { city: "Ghost Town", cityId: "ghost-town", days: 2, sites: [] },
    ];
    const result = planMultiCityItinerary(legs, "Relaxed");
    expect(result).toHaveLength(4);
    const ghostDays = result.filter((d) => d.cityId === "ghost-town");
    expect(ghostDays).toHaveLength(2);
    expect(ghostDays.every((d) => d.slots.length === 0)).toBe(true);
  });
});
