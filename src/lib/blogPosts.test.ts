import { describe, expect, it } from "vitest";
import { BLOG_POSTS } from "./blogPosts";

describe("BLOG_POSTS", () => {
  it("has non-empty Arabic fields for every post", () => {
    for (const post of BLOG_POSTS) {
      expect(post.titleAr).toBeTruthy();
      expect(post.excerptAr).toBeTruthy();
      expect(post.tagAr).toBeTruthy();
    }
  });

  it("has the same number of Arabic paragraphs as English ones for every post", () => {
    for (const post of BLOG_POSTS) {
      expect(post.paragraphsAr).toHaveLength(post.paragraphs.length);
      for (const paragraph of post.paragraphsAr) expect(paragraph).toBeTruthy();
    }
  });
});
