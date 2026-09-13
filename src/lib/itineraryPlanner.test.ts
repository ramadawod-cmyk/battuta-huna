import { describe, expect, it } from "vitest";
import { planMultiCityItinerary, splitDaysAcrossLegs, type ItineraryLeg } from "./itineraryPlanner";
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
