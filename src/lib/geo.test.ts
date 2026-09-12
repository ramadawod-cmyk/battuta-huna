import { describe, expect, it } from "vitest";
import { describeGeolocationError, haversineMeters, slugify } from "./geo";

describe("slugify", () => {
  it("lowercases and dashes a normal name", () => {
    expect(slugify("Rainbow Street")).toBe("rainbow-street");
  });

  it("strips accents instead of mangling them", () => {
    expect(slugify("Málaga")).toBe("malaga");
  });

  it("collapses punctuation and trims leading/trailing dashes", () => {
    expect(slugify("  St. James's Park!! ")).toBe("st-james-s-park");
  });

  it("falls back to a stable non-empty hash for non-Latin scripts", () => {
    const a = slugify("عمّان");
    const b = slugify("عمّان");
    expect(a).toMatch(/^city-[a-z0-9]+$/);
    expect(a).toBe(b); // same input -> same id, every time
  });

  it("gives different non-Latin inputs different ids", () => {
    expect(slugify("東京")).not.toBe(slugify("大阪"));
  });
});

describe("haversineMeters", () => {
  it("returns 0 for the same point", () => {
    expect(haversineMeters(25.2048, 55.2708, 25.2048, 55.2708)).toBe(0);
  });

  it("matches the known straight-line distance between two cities within 1%", () => {
    // Amman -> Dubai is ~2030km great-circle distance.
    const meters = haversineMeters(31.9539, 35.9106, 25.2048, 55.2708);
    const km = meters / 1000;
    expect(km).toBeGreaterThan(2030 * 0.99);
    expect(km).toBeLessThan(2030 * 1.01);
  });
});

describe("describeGeolocationError", () => {
  it("maps permission-denied (code 1)", () => {
    expect(describeGeolocationError({ code: 1 })).toMatch(/permission was denied/i);
  });

  it("maps position-unavailable (code 2)", () => {
    expect(describeGeolocationError({ code: 2 })).toMatch(/couldn't determine/i);
  });

  it("maps timeout (code 3)", () => {
    expect(describeGeolocationError({ code: 3 })).toMatch(/timed out/i);
  });

  it("passes through a regular Error's message", () => {
    expect(describeGeolocationError(new Error("network down"))).toBe("network down");
  });

  it("has a generic fallback for anything else", () => {
    expect(describeGeolocationError("nonsense")).toBe("Could not detect your location");
  });
});
