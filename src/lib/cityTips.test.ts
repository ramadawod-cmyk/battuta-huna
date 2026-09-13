import { describe, expect, it } from "vitest";
import { arabicKey } from "./cityTips";

describe("arabicKey", () => {
  it("suffixes the given key with _ar", () => {
    expect(arabicKey("getting_around")).toBe("getting_around_ar");
    expect(arabicKey("safety")).toBe("safety_ar");
  });
});
