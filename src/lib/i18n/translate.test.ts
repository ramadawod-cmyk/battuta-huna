import { describe, expect, it } from "vitest";
import { detectLanguage, dirFor, translate } from "./translate";

describe("detectLanguage", () => {
  it("resolves any Arabic locale tag to ar, regardless of region", () => {
    expect(detectLanguage("ar")).toBe("ar");
    expect(detectLanguage("ar-JO")).toBe("ar");
    expect(detectLanguage("ar-SA")).toBe("ar");
    expect(detectLanguage("AR-EG")).toBe("ar"); // case-insensitive
  });

  it("falls back to English for anything else, including missing input", () => {
    expect(detectLanguage("en-US")).toBe("en");
    expect(detectLanguage("fr")).toBe("en");
    expect(detectLanguage(null)).toBe("en");
    expect(detectLanguage(undefined)).toBe("en");
    expect(detectLanguage("")).toBe("en");
  });
});

describe("dirFor", () => {
  it("returns rtl for Arabic and ltr for English", () => {
    expect(dirFor("ar")).toBe("rtl");
    expect(dirFor("en")).toBe("ltr");
  });
});

describe("translate", () => {
  const dict = { greeting: "Hello, {name}!", plain: "Just text" };

  it("returns the dictionary value for a known key", () => {
    expect(translate(dict, "plain")).toBe("Just text");
  });

  it("substitutes {placeholder} tokens from vars", () => {
    expect(translate(dict, "greeting", { name: "Amman" })).toBe("Hello, Amman!");
  });

  it("substitutes every occurrence of a repeated placeholder", () => {
    const repeated = { echo: "{word} {word}" };
    expect(translate(repeated, "echo", { word: "hi" })).toBe("hi hi");
  });

  it("falls back to the raw key when it's missing from the dictionary, rather than a blank string", () => {
    expect(translate(dict, "missing.key")).toBe("missing.key");
  });

  it("leaves the template untouched when no vars are given, even if it has placeholders", () => {
    expect(translate(dict, "greeting")).toBe("Hello, {name}!");
  });
});
