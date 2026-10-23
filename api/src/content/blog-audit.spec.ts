import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BlogService } from "./blog.service";

function fixture() {
  let views = 0;
  const prisma = { blogPost: {
    findFirst: async () => ({ title: "Indonesian agate", excerpt: "Agate guide", body: "Agate care", tags: [], titleId: null, excerptId: null, bodyId: null, tagsId: [], coverAlt: null, coverAltId: null, metaTitle: null, metaTitleId: null, metaDescription: null, metaDescriptionId: null, idTranslationStatus: "Missing" }),
    update: async () => { views += 1; },
  } };
  return { service: new BlogService(prisma as never, {} as never), views: () => views };
}

describe("blog views during SEO audits", () => {
  it("does not inflate readership when an audit reads a post", async () => {
    const test = fixture();
    const post = await test.service.getPublicBySlug("agate", "en", false);
    assert.equal(post.title, "Indonesian agate");
    assert.equal(test.views(), 0);
  });
  it("preserves normal reader view counting", async () => {
    const test = fixture();
    await test.service.getPublicBySlug("agate", "en");
    assert.equal(test.views(), 1);
  });
});
