import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";

const request = (path: string, cookie = "rv_language=id") => new NextRequest(`http://localhost:3000${path}`, { headers: { cookie } });

describe("locale URLs stay stable regardless of the preference cookie", () => {
  it("does not send the English root back to /id when it is a rewrite destination", () => {
    const localized = proxy(request("/id"));
    const destination = localized.headers.get("x-middleware-rewrite");
    assert.equal(new URL(destination!).pathname, "/");
    const root = proxy(request("/"));
    assert.equal(root.headers.get("location"), null, "root-to-/id redirect can cycle with the /id-to-root rewrite");
    assert.equal(root.headers.get("x-middleware-request-x-rv-language"), "en");
  });
  it("keeps /id/shop in Indonesian and preserves its query string", () => {
    const response = proxy(request("/id/shop?page=2", "rv_language=en"));
    assert.equal(response.headers.get("location"), null);
    assert.equal(response.headers.get("x-middleware-rewrite"), "http://localhost:3000/shop?page=2");
    assert.equal(response.headers.get("x-middleware-request-x-rv-language"), "id");
  });
  it("keeps an English content URL stable with an Indonesian cookie", () => {
    assert.equal(proxy(request("/shop?sort=newest")).headers.get("location"), null);
  });
  it("still protects the admin dashboard", () => {
    assert.equal(proxy(request("/admin/seo")).headers.get("location"), "http://localhost:3000/admin/login?from=%2Fadmin%2Fseo");
  });
});
