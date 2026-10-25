import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";

const request = (path: string, cookie = "rv_language=id") => new NextRequest(`http://localhost:3000${path}`, { headers: { cookie } });

describe("the storefront serves English-only locale URLs", () => {
  it("permanently redirects the old Indonesian root to English", () => {
    const response = proxy(request("/id"));
    assert.equal(response.status, 308);
    assert.equal(response.headers.get("location"), "http://localhost:3000/");
    assert.match(response.headers.get("set-cookie") ?? "", /rv_language=en/);
    const root = proxy(request("/"));
    assert.equal(root.headers.get("location"), null);
    assert.equal(root.headers.get("x-middleware-request-x-rv-language"), "en");
  });
  it("permanently redirects legacy Indonesian paths and preserves their query strings", () => {
    const response = proxy(request("/id/shop?page=2", "rv_language=en"));
    assert.equal(response.status, 308);
    assert.equal(response.headers.get("location"), "http://localhost:3000/shop?page=2");
  });
  it("keeps an English content URL stable with an Indonesian cookie", () => {
    assert.equal(proxy(request("/shop?sort=newest")).headers.get("location"), null);
  });
  it("still protects the admin dashboard", () => {
    assert.equal(proxy(request("/admin/seo")).headers.get("location"), "http://localhost:3000/admin/login?from=%2Fadmin%2Fseo");
  });
});
