import { describe, expect, it } from "vitest";
import { TIP_CATEGORIES } from "./cityTips";
import ar from "./i18n/ar";
import en from "./i18n/en";
import { GUIDE_ACCENT_CLASSES, GUIDE_META } from "./guideMeta";

describe("GUIDE_META", () => {
  it("has a resolvable display-label key in both languages for every tip category", () => {
    for (const meta of Object.values(GUIDE_META)) {
      expect(en[meta.labelKey]).toBeTruthy();
      expect(ar[meta.labelKey]).toBeTruthy();
    }
  });

  it("has an accent color defined for every tip category", () => {
    for (const meta of Object.values(GUIDE_META)) {
      expect(GUIDE_ACCENT_CLASSES[meta.accent]).toBeDefined();
    }
  });

  it("has an entry for every key ensureCityTips actually generates -- a mismatch here would silently drop a tip category from the guide", () => {
    for (const category of TIP_CATEGORIES) {
      expect(GUIDE_META[category.key]).toBeDefined();
    }
  });
});
