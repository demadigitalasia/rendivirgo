import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ConfigService } from "@nestjs/config";
import { publicAppOrigin } from "../common/utils/public-app-origin";
import { CreateLapidaryProgressUpdateDto, SubmitLapidaryInboundShipmentDto, UpdateLapidaryRequestDto } from "./lapidary.dto";
import { LapidaryEmailOutboxService } from "./lapidary-email-outbox.service";

describe("Lapidary validation and notification recovery", () => {
  it("accepts empty optional tracking URLs at both API boundaries", async () => {
    for (const trackingUrl of [undefined, null, "", "   ", "https://carrier.example/track/123"]) {
      const incoming = plainToInstance(SubmitLapidaryInboundShipmentDto, { carrier: " DHL ", trackingNumber: " TRACK123 ", trackingUrl });
      assert.equal((await validate(incoming)).length, 0);
      const outgoing = plainToInstance(UpdateLapidaryRequestDto, { returnTrackingUrl: trackingUrl });
      assert.equal((await validate(outgoing)).length, 0);
    }
  });
  it("rejects non-HTTP URLs and whitespace progress before storage", async () => {
    for (const trackingUrl of ["javascript:alert(1)", "ftp://carrier.example/123", "not a link"]) {
      assert.ok((await validate(plainToInstance(SubmitLapidaryInboundShipmentDto, { carrier: "DHL", trackingNumber: "TRACK123", trackingUrl }))).length);
    }
    const progress = plainToInstance(CreateLapidaryProgressUpdateDto, { title: "  ", body: "   " });
    assert.equal((await validate(progress)).length, 2);
  });
  it("uses the canonical frontend origin and refuses unsafe production link configuration", () => {
    assert.equal(publicAppOrigin({ PUBLIC_SITE_URL: "http://localhost:3000", APP_ORIGIN: "http://localhost:3001,http://localhost:3000" }), "http://localhost:3000");
    assert.equal(publicAppOrigin({ APP_ORIGIN: "http://localhost:3000,http://localhost:3001" }), "http://localhost:3000");
    assert.equal(publicAppOrigin({}), "http://localhost:3000");
    for (const PUBLIC_SITE_URL of ["http://localhost:3000", "https://user:password@example.com", "https://example.com/path", "https://example.com/?x=1"]) {
      assert.throws(() => publicAppOrigin({ PUBLIC_SITE_URL, NODE_ENV: "production" }));
    }
    assert.throws(() => publicAppOrigin({ NODE_ENV: "production" }));
  });
  it("durably encrypts intake email while the provider is disabled", async () => {
    let stored: { encryptedPayload: string } | undefined;
    const worker = new LapidaryEmailOutboxService({} as never, { isEnabled: () => false } as never, new ConfigService({ SESSION_SECRET: "fixture-only-secret-for-encrypted-outbox" }));
    const tx = { lapidaryEmailOutbox: { create: async ({ data }: { data: { encryptedPayload: string } }) => { stored = data; } } };
    await worker.enqueue(tx as never, "fixture", "fixture:intake", { to: "fixture@example.invalid", subject: "Intake", html: "Private fixture message" });
    assert.ok(stored?.encryptedPayload.startsWith("v1."));
    assert.ok(!stored?.encryptedPayload.includes("fixture@example.invalid"));
  });
  it("never sends an obsolete invitation from the queue", async () => {
    const writes: Array<Record<string, unknown>> = [];
    let providerCalls = 0;
    let encryptedPayload = "";
    const prisma = {
      lapidaryEmailOutbox: {
        deleteMany: async () => ({ count: 0 }),
        findMany: async () => [{ id: "fixture-job", requestId: "fixture", status: "Pending", attempts: 0, dedupeKey: "fixture-invite", encryptedPayload }],
        updateMany: async ({ data }: { data: Record<string, unknown> }) => { writes.push(data); return { count: 1 }; },
      },
      lapidaryRequest: { findUnique: async () => ({ claimTokenHash: "replacement-hash", claimTokenExpiresAt: new Date(Date.now() + 60_000), customerId: null }) },
    };
    const email = { isEnabled: () => true, readiness: () => ({ senderConfigured: true }), send: async () => { providerCalls += 1; return true; } };
    const worker = new LapidaryEmailOutboxService(prisma as never, email as never, new ConfigService({ SESSION_SECRET: "fixture-only-secret-for-encrypted-outbox" }));
    encryptedPayload = Reflect.get(worker, "encrypt").call(worker, { to: "fixture@example.invalid", subject: "Invitation", html: "Fixture", claimTokenHash: "obsolete-hash" });
    await Reflect.get(worker, "dispatchOutbox").call(worker);
    assert.equal(providerCalls, 0);
    assert.ok(writes.some((data) => data.status === "Failed" && data.encryptedPayload === ""));
  });
});
