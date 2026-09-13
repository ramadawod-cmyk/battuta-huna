import { describe, expect, it } from "vitest";
import { destinationsLabel, legsFromDays, tripDestinations } from "./trips";
import type { Trip, TripDay } from "./types";

function makeTrip(overrides: Partial<Trip> & { days: TripDay[] }): Trip {
  return {
    id: "trip-1",
    city: "Amman",
    status: "ready",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeSlot(name: string) {
  return { time: "9:00 AM", name, description: "", category: "Sightseeing", tags: [], lat: 0, lng: 0, mapUrl: "" };
}

describe("tripDestinations", () => {
  it("falls back to trip.city when no day carries a city (every pre-existing trip)", () => {
    const trip = makeTrip({
      city: "Amman",
      days: [
        { day: 1, label: "Day 1", slots: [makeSlot("Citadel Hill")] },
        { day: 2, label: "Day 2", slots: [makeSlot("Rainbow Street")] },
      ],
    });
    expect(tripDestinations(trip)).toEqual([{ city: "Amman", cityId: "amman" }]);
  });

  it("returns unique destinations in visit order for a multi-city trip", () => {
    const trip = makeTrip({
      city: "Rome",
      days: [
        { day: 1, label: "Day 1", slots: [], city: "Rome", cityId: "rome", country: "Italy" },
        { day: 2, label: "Day 2", slots: [], city: "Rome", cityId: "rome", country: "Italy" },
        { day: 3, label: "Day 3", slots: [], city: "Florence", cityId: "florence", country: "Italy" },
      ],
    });
    expect(tripDestinations(trip)).toEqual([
      { city: "Rome", cityId: "rome", country: "Italy" },
      { city: "Florence", cityId: "florence", country: "Italy" },
    ]);
  });

  it("derives cityId from the city name when a day is missing it", () => {
    const trip = makeTrip({
      city: "Rome",
      days: [{ day: 1, label: "Day 1", slots: [], city: "Rome" }],
    });
    expect(tripDestinations(trip)).toEqual([{ city: "Rome", cityId: "rome", country: undefined }]);
  });
});

describe("destinationsLabel", () => {
  it("formats a single destination with no separator", () => {
    const trip = makeTrip({ city: "Amman", days: [{ day: 1, label: "Day 1", slots: [] }] });
    expect(destinationsLabel(trip)).toBe("Amman");
  });

  it("joins multiple destinations with a middle dot", () => {
    const trip = makeTrip({
      city: "Rome",
      days: [
        { day: 1, label: "Day 1", slots: [], city: "Rome", cityId: "rome" },
        { day: 2, label: "Day 2", slots: [], city: "Florence", cityId: "florence" },
      ],
    });
    expect(destinationsLabel(trip)).toBe("Rome · Florence");
  });
});

describe("legsFromDays", () => {
  it("groups every day into one cityless leg when no day carries a city", () => {
    const days: TripDay[] = [
      { day: 1, label: "Day 1", slots: [] },
      { day: 2, label: "Day 2", slots: [] },
    ];
    const legs = legsFromDays(days);
    expect(legs).toHaveLength(1);
    expect(legs[0].city).toBeUndefined();
    expect(legs[0].days).toHaveLength(2);
  });

  it("splits into a new leg wherever the city changes, keeping runs of the same city together", () => {
    const days: TripDay[] = [
      { day: 1, label: "Day 1", slots: [], city: "Rome", cityId: "rome" },
      { day: 2, label: "Day 2", slots: [], city: "Rome", cityId: "rome" },
      { day: 3, label: "Day 3", slots: [], city: "Florence", cityId: "florence" },
    ];
    const legs = legsFromDays(days);
    expect(legs.map((l) => l.city)).toEqual(["Rome", "Florence"]);
    expect(legs[0].days.map((d) => d.day)).toEqual([1, 2]);
    expect(legs[1].days.map((d) => d.day)).toEqual([3]);
  });
});
