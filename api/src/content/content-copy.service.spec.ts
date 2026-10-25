import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { ContentCopyService, validateCopy, copyFields } from "./content-copy.service";
import type { SettingsService } from "../settings/settings.service";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const input = { kind: "seo" as const, context: JSON.stringify({ title: "Indonesian agate", body: "Agate from Indonesia" }) };
const copy = { metaTitle: "Indonesian Agate | RENDI VIRGO", metaDescription: "Explore Indonesian agate." };
function service(apiKey = "test-key") {
  const settings = { getOpenRouterCredentials: async () => ({ apiKey, model: "test-model" }) };
  return new ContentCopyService(settings as SettingsService);
}

describe("content generation boundary", () => {
  it("rejects missing configuration before contacting a provider", async () => {
    globalThis.fetch = async () => { assert.fail("Provider must not be called"); };
    await assert.rejects(service("").generate(input), /OpenRouter API key/);
  });
  it("rejects malformed or empty source rather than generating unsupported copy", async () => {
    globalThis.fetch = async () => { assert.fail("Provider must not be called"); };
    await assert.rejects(service().generate({ ...input, context: "{" }), /valid JSON/);
    await assert.rejects(service().generate({ ...input, context: "{}" }), /Add a title/);
    await assert.rejects(service().generate({ ...input, context: JSON.stringify({ contentType: "page" }) }), /Add a title/);
  });
  it("returns validated metadata without allowing a provider to publish content", async () => {
    globalThis.fetch = async (_url, init) => {
      const request = JSON.parse(String(init?.body));
      assert.equal(request.provider.data_collection, "deny");
      assert.equal(request.provider.zdr, true);
      assert.equal(request.response_format.json_schema.strict, true);
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ ...copy, status: "Published" }) } }] }), { status: 200 });
    };
    assert.deepEqual(await service().generate(input), copy);
  });
  it("rejects truncated model output even when the text happens to contain valid JSON", async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ finish_reason: "length", message: { content: JSON.stringify(copy) } }] }), { status: 200 });
    await assert.rejects(service().generate(input), /incomplete or invalid/);
  });
  it("reports insufficient provider credits without exposing provider response bodies", async () => {
    globalThis.fetch = async () => new Response("sensitive upstream diagnostics", { status: 402 });
    await assert.rejects(service().generate(input), /insufficient credits/);
  });
  it("rejects empty, overlong, and incomplete fields instead of silently clipping content", () => {
    assert.throws(() => validateCopy({ ...copy, metaTitle: "x".repeat(61) }, "seo"));
    assert.throws(() => validateCopy({ ...copy, metaDescription: " " }, "seo"));
    assert.throws(() => validateCopy({ metaTitle: "Agate" }, "seo"));
  });
  for (const kind of ["product", "category", "blog"] as const) {
    it(`validates ${kind} drafts without returning publication changes`, async () => {
      const expected = Object.fromEntries(Object.keys(copyFields[kind]).map(field => [field, "Verified source copy"]));
      globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({...expected, status: "Draft"}) } }] }));
      assert.deepEqual(await service().generate({...input,kind}), expected);
      assert.throws(()=>validateCopy({...expected,metaTitle:"x".repeat(61)},kind));
    });
  }
});
