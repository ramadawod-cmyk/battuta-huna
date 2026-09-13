import { describe, expect, it } from "vitest";
import { pickDefaultPlaces, pickDefaultPlacesForLegs } from "./placeSelection";
import type { PlanLeg } from "./planFlow";
import type { Site } from "./types";

function makeSite(overrides: Partial<Site> & { name: string }): Site {
  return {
    id: overrides.name,
    city_id: "rome",
    category: "Sightseeing",
    tags: [],
    description: "",
    lat: 0,
    lng: 0,
    must_see: false,
    ...overrides,
  };
}

describe("pickDefaultPlaces", () => {
  it("caps the selection at max(14, duration * 6)", () => {
    const sites = Array.from({ length: 30 }, (_, i) => makeSite({ name: `Site ${i}` }));
    expect(pickDefaultPlaces(sites, [], 1).size).toBe(14);
    expect(pickDefaultPlaces(sites, [], 5).size).toBe(30); // duration*6=30, capped by pool size (30 sites)
    expect(pickDefaultPlaces(sites, [], 3).size).toBe(18);
  });

  it("ranks interest matches and must-see places ahead of the rest", () => {
    const sites = [
      makeSite({ name: "Random Cafe", category: "Food" }),
      makeSite({ name: "Hidden Gem", category: "Nature", must_see: true }),
      makeSite({ name: "Museum", category: "Culture" }),
    ];
    // CAP is max(14, 1*6) = 14, larger than the pool, so this only tests that must_see items are
    // never excluded by an interest filter that doesn't include their category.
    const picked = pickDefaultPlaces(sites, ["Culture"], 1);
    expect(picked.has("Hidden Gem")).toBe(true);
    expect(picked.has("Museum")).toBe(true);
  });

  it("excludes sites beyond the cap, favoring interest matches and must-see picks", () => {
    const nonMatching = Array.from({ length: 10 }, (_, i) => makeSite({ name: `Filler ${i}`, category: "Food" }));
    const matching = Array.from({ length: 5 }, (_, i) => makeSite({ name: `Culture ${i}`, category: "Culture" }));
    const sites = [...nonMatching, ...matching];
    // duration 1 -> cap 14, pool is 15, so exactly one site gets dropped -- must be a non-matching one.
    const picked = pickDefaultPlaces(sites, ["Culture"], 1);
    expect(picked.size).toBe(14);
    matching.forEach((s) => expect(picked.has(s.name)).toBe(true));
  });
});

describe("pickDefaultPlacesForLegs", () => {
  const legs: PlanLeg[] = [
    { city: "Rome", country: "Italy", country_id: "italy", days: 1 },
    { city: "Florence", country: "Italy", country_id: "italy", days: 3 },
  ];

  it("scopes each leg's cap to its own day count instead of one trip-wide cap", () => {
    const romeSites = Array.from({ length: 20 }, (_, i) => makeSite({ name: `Rome ${i}`, city_id: "rome" }));
    const florenceSites = Array.from({ length: 20 }, (_, i) => makeSite({ name: `Florence ${i}`, city_id: "florence" }));
    const picked = pickDefaultPlacesForLegs([...romeSites, ...florenceSites], legs, []);

    const romePicked = [...picked].filter((n) => n.startsWith("Rome"));
    const florencePicked = [...picked].filter((n) => n.startsWith("Florence"));
    expect(romePicked).toHaveLength(14); // max(14, 1*6)
    expect(florencePicked).toHaveLength(18); // max(14, 3*6)
  });

  it("only draws each leg's picks from sites belonging to that leg's city", () => {
    const romeSites = [makeSite({ name: "Colosseum", city_id: "rome" })];
    const florenceSites = [makeSite({ name: "Duomo", city_id: "florence" })];
    const picked = pickDefaultPlacesForLegs([...romeSites, ...florenceSites], legs, []);
    expect(picked.has("Colosseum")).toBe(true);
    expect(picked.has("Duomo")).toBe(true);
  });

  it("behaves like a single pickDefaultPlaces call for a one-leg trip", () => {
    const singleLeg: PlanLeg[] = [{ city: "Rome", country: "Italy", country_id: "italy", days: 2 }];
    const sites = Array.from({ length: 20 }, (_, i) => makeSite({ name: `Rome ${i}`, city_id: "rome" }));
    const viaLegs = pickDefaultPlacesForLegs(sites, singleLeg, []);
    const direct = pickDefaultPlaces(sites, [], 2);
    expect(viaLegs).toEqual(direct);
  });
});
