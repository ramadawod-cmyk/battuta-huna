import { describe, expect, it } from "vitest";
import { ACTIVITY_TYPES } from "./activityTypes";
import { CATEGORIES } from "./categories";
import ar from "./i18n/ar";
import en from "./i18n/en";
import {
  buildGatherSystemPrompt,
  GROUP_LABEL_KEYS,
  GROUP_TYPES,
  INTEREST_TAGS,
  PACE_LABEL_KEYS,
  PACE_OPTIONS,
  parseDayLabels,
  parsePartial,
} from "./planFlow";

describe("INTEREST_TAGS", () => {
  it("spans both site categories and activity types, so either can be picked as an interest", () => {
    for (const category of CATEGORIES) expect(INTEREST_TAGS).toContain(category);
    for (const type of ACTIVITY_TYPES) expect(INTEREST_TAGS).toContain(type);
  });
});

function wrap(json: string): string {
  return `Great, planning that now.\n[PARTIAL]${json}[/PARTIAL]`;
}

describe("parsePartial", () => {
  it("returns null and the full text unchanged when there's no [PARTIAL] block", () => {
    const { partial, cleanText } = parsePartial("Which city did you have in mind?");
    expect(partial).toBeNull();
    expect(cleanText).toBe("Which city did you have in mind?");
  });

  it("returns null for malformed JSON inside the block", () => {
    const { partial } = parsePartial(wrap("{not valid json"));
    expect(partial).toBeNull();
  });

  it("strips the [PARTIAL] block out of the visible reply either way", () => {
    const { cleanText } = parsePartial(wrap('{"city":"Amman","country":"Jordan","country_id":"jordan","duration":5}'));
    expect(cleanText).toBe("Great, planning that now.");
  });

  it("normalizes the legacy single-city shape into one leg", () => {
    const { partial } = parsePartial(
      wrap('{"city":"Amman","country":"Jordan","country_id":"jordan","dates":null,"duration":5}'),
    );
    expect(partial).toEqual({
      legs: [{ city: "Amman", country: "Jordan", country_id: "jordan", days: 5 }],
      duration: 5,
      dates: null,
    });
  });

  it("accepts the multi-leg shape as-is when the leg days already sum to duration", () => {
    const { partial } = parsePartial(
      wrap(
        JSON.stringify({
          legs: [
            { city: "Rome", country: "Italy", country_id: "italy", days: 3 },
            { city: "Florence", country: "Italy", country_id: "italy", days: 2 },
          ],
          duration: 5,
          dates: null,
        }),
      ),
    );
    expect(partial).toEqual({
      legs: [
        { city: "Rome", country: "Italy", country_id: "italy", days: 3 },
        { city: "Florence", country: "Italy", country_id: "italy", days: 2 },
      ],
      duration: 5,
      dates: null,
    });
  });

  it("re-splits leg days when they don't sum to the stated duration", () => {
    const { partial } = parsePartial(
      wrap(
        JSON.stringify({
          legs: [
            { city: "Rome", country: "Italy", country_id: "italy", days: 10 },
            { city: "Florence", country: "Italy", country_id: "italy", days: 10 },
          ],
          duration: 6,
        }),
      ),
    );
    expect(partial?.legs.map((l) => l.days)).toEqual([3, 3]);
    expect(partial?.legs.reduce((sum, l) => sum + l.days, 0)).toBe(6);
  });

  it("re-splits when a leg has no day count at all", () => {
    const { partial } = parsePartial(
      wrap(
        JSON.stringify({
          legs: [
            { city: "Rome", country: "Italy", country_id: "italy" },
            { city: "Florence", country: "Italy", country_id: "italy" },
          ],
          duration: 5,
        }),
      ),
    );
    expect(partial?.legs.reduce((sum, l) => sum + l.days, 0)).toBe(5);
    expect(partial?.legs.every((l) => l.days >= 1)).toBe(true);
  });

  it("caps legs at 4 and re-splits across the ones that remain", () => {
    const { partial } = parsePartial(
      wrap(
        JSON.stringify({
          legs: [
            { city: "A", country: "X", country_id: "x", days: 2 },
            { city: "B", country: "X", country_id: "x", days: 2 },
            { city: "C", country: "X", country_id: "x", days: 2 },
            { city: "D", country: "X", country_id: "x", days: 2 },
            { city: "E", country: "X", country_id: "x", days: 2 },
          ],
          duration: 10,
        }),
      ),
    );
    expect(partial?.legs).toHaveLength(4);
    expect(partial?.legs.map((l) => l.city)).toEqual(["A", "B", "C", "D"]);
    expect(partial?.legs.reduce((sum, l) => sum + l.days, 0)).toBe(10);
  });

  it("drops legs with no city name", () => {
    const { partial } = parsePartial(
      wrap(
        JSON.stringify({
          legs: [
            { city: "Rome", country: "Italy", country_id: "italy", days: 3 },
            { city: "", country: "Italy", country_id: "italy", days: 2 },
          ],
          duration: 3,
        }),
      ),
    );
    expect(partial?.legs).toHaveLength(1);
    expect(partial?.legs[0].city).toBe("Rome");
  });

  it("returns null when every leg is missing a city", () => {
    const { partial } = parsePartial(wrap(JSON.stringify({ legs: [{ country: "Italy" }], duration: 3 })));
    expect(partial).toBeNull();
  });

  it("returns null when duration can't be determined at all", () => {
    const { partial } = parsePartial(wrap(JSON.stringify({ legs: [{ city: "Rome" }] })));
    expect(partial).toBeNull();
  });

  it("derives duration from leg days when the top-level duration is missing", () => {
    const { partial } = parsePartial(
      wrap(JSON.stringify({ legs: [{ city: "Rome", days: 3 }, { city: "Florence", days: 2 }] })),
    );
    expect(partial?.duration).toBe(5);
  });
});

describe("buildGatherSystemPrompt", () => {
  it("defaults to no language instruction and stays out of the way for English", () => {
    const prompt = buildGatherSystemPrompt(new Date("2026-01-01"));
    expect(prompt).not.toContain("Reply to the traveller in Arabic");
  });

  it("instructs the agent to reply in Arabic when language is ar", () => {
    const prompt = buildGatherSystemPrompt(new Date("2026-01-01"), "ar");
    expect(prompt).toContain("Reply to the traveller in Arabic");
  });

  it("always requires the [PARTIAL] block's city/country fields to stay English", () => {
    const prompt = buildGatherSystemPrompt(new Date("2026-01-01"), "ar");
    expect(prompt).toMatch(/must always be in English/);
  });
});

describe("parseDayLabels", () => {
  it("parses a bilingual array of {label, labelAr} objects", () => {
    const text = '[{"label":"Old Town & Markets","labelAr":"البلدة القديمة والأسواق"},{"label":"Coastal Escape","labelAr":"هروب إلى الساحل"}]';
    const labels = parseDayLabels(text);
    expect(labels).toEqual([
      { label: "Old Town & Markets", labelAr: "البلدة القديمة والأسواق" },
      { label: "Coastal Escape", labelAr: "هروب إلى الساحل" },
    ]);
  });

  it("returns null for the old plain-string-array shape", () => {
    expect(parseDayLabels('["Old Town & Markets", "Coastal Escape"]')).toBeNull();
  });

  it("returns null when a label is missing its Arabic sibling", () => {
    expect(parseDayLabels('[{"label":"Old Town & Markets"}]')).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(parseDayLabels("not json at all")).toBeNull();
  });
});

describe("GROUP_LABEL_KEYS / PACE_LABEL_KEYS", () => {
  it("has a display-label key for every canonical group type, resolvable in both languages", () => {
    for (const type of GROUP_TYPES) {
      const key = GROUP_LABEL_KEYS[type];
      expect(key).toBeDefined();
      expect(en[key]).toBeTruthy();
      expect(ar[key]).toBeTruthy();
    }
  });

  it("has a display-label key for every canonical pace option, resolvable in both languages", () => {
    for (const option of PACE_OPTIONS) {
      const key = PACE_LABEL_KEYS[option];
      expect(key).toBeDefined();
      expect(en[key]).toBeTruthy();
      expect(ar[key]).toBeTruthy();
    }
  });
});
