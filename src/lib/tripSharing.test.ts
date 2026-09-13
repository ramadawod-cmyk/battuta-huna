import { describe, expect, it } from "vitest";
import { publicDateLabel, shareUrl } from "./tripSharing";

describe("publicDateLabel", () => {
  it("redacts an exact date range down to duration + month/year", () => {
    expect(publicDateLabel({ dates: "Sep 13 – Sep 16, 2026", duration: 4 })).toBe("4 days · September 2026");
  });

  it("never contains the exact day numbers from the original range", () => {
    const label = publicDateLabel({ dates: "Sep 13 – Sep 16, 2026", duration: 4 });
    expect(label).not.toContain("13");
    expect(label).not.toContain("16");
  });

  it("handles the flexible-month label the same way as an exact range", () => {
    expect(publicDateLabel({ dates: "September 2026 (flexible)", duration: 4 })).toBe("4 days · September 2026");
  });

  it("pluralizes a single day correctly", () => {
    expect(publicDateLabel({ dates: "Sep 13, 2026", duration: 1 })).toBe("1 day · September 2026");
  });

  it("falls back to duration alone when no month can be parsed", () => {
    expect(publicDateLabel({ dates: "sometime soon", duration: 5 })).toBe("5 days");
  });

  it("falls back to duration alone when dates is missing", () => {
    expect(publicDateLabel({ dates: null, duration: 3 })).toBe("3 days");
    expect(publicDateLabel({ duration: 3 })).toBe("3 days");
  });

  it("falls back to a generic label when neither dates nor duration are usable", () => {
    expect(publicDateLabel({ dates: null, duration: null })).toBe("Dates flexible");
    expect(publicDateLabel({})).toBe("Dates flexible");
  });

  it("shows just the month/year when duration is missing but dates parse", () => {
    expect(publicDateLabel({ dates: "September 2026 (flexible)", duration: null })).toBe("September 2026");
  });
});

describe("shareUrl", () => {
  it("builds a /shared/:tripId URL from the given origin", () => {
    expect(shareUrl("https://battutahuna.com", "abc-123")).toBe("https://battutahuna.com/shared/abc-123");
  });
});
