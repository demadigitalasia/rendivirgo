import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { signMagicToken, verifyMagicToken } from "./magic-token";

const SECRET = "test-secret-value";

describe("magic token", () => {
  it("round-trips a valid payload", () => {
    const token = signMagicToken({ email: "collector@example.com", exp: Date.now() + 60_000 }, SECRET);
    const payload = verifyMagicToken(token, SECRET);
    assert.equal(payload?.email, "collector@example.com");
  });

  it("rejects a token signed with a different secret", () => {
    const token = signMagicToken({ email: "collector@example.com", exp: Date.now() + 60_000 }, "other-secret");
    assert.equal(verifyMagicToken(token, SECRET), null);
  });

  it("rejects a tampered payload", () => {
    const token = signMagicToken({ email: "collector@example.com", exp: Date.now() + 60_000 }, SECRET);
    const [data, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ email: "attacker@example.com", exp: Date.now() + 60_000 })).toString("base64url");
    assert.equal(verifyMagicToken(`${forged}.${signature}`, SECRET), null);
    assert.equal(verifyMagicToken(`${data}.${signature}x`, SECRET), null);
  });

  it("rejects an expired token", () => {
    const token = signMagicToken({ email: "collector@example.com", exp: Date.now() - 1_000 }, SECRET);
    assert.equal(verifyMagicToken(token, SECRET), null);
  });

  it("rejects malformed tokens", () => {
    assert.equal(verifyMagicToken("", SECRET), null);
    assert.equal(verifyMagicToken("no-dot", SECRET), null);
    assert.equal(verifyMagicToken(".", SECRET), null);
  });
});
