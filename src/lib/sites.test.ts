import { describe, expect, it } from "vitest";
import { needsArabicTranslation } from "./sites";

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
