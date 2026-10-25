import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import * as bcrypt from "bcryptjs";
import { CustomerAuthService } from "./customer-auth.service";

const CURRENT_PASSWORD = "Current-password-123";
const NEW_PASSWORD = "A-new-strong-password-456";

function createService(passwordHash: string) {
  const calls: { sessionWhere?: Record<string, unknown>; emailKinds: string[] } = { emailKinds: [] };
  const tx = {
    customer: { updateMany: async () => ({ count: 1 }) },
    customerSession: {
      updateMany: async (input: { where: Record<string, unknown> }) => {
        calls.sessionWhere = input.where;
        return { count: 2 };
      },
    },
  };
  const prisma = {
    customer: {
      findUnique: async () => ({ id: "customer-1", email: "customer@example.com", name: "Customer", passwordHash }),
    },
    $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
  };
  const emailOutbox = {
    enqueue: async (_transaction: unknown, input: { kind: string }) => { calls.emailKinds.push(input.kind); },
  };
  const config = { get: () => undefined };
  const service = new CustomerAuthService(prisma as never, emailOutbox as never, config as never);
  return { service, calls };
}

test("customer password change requires the current password", async () => {
  const { service, calls } = createService(await bcrypt.hash(CURRENT_PASSWORD, 4));

  const changed = await service.changePassword("customer-1", "incorrect-password", NEW_PASSWORD, "current-session-token");

  assert.equal(changed, false);
  assert.equal(calls.sessionWhere, undefined);
  assert.deepEqual(calls.emailKinds, []);
});

test("customer password change keeps the current session and queues a security notice", async () => {
  const { service, calls } = createService(await bcrypt.hash(CURRENT_PASSWORD, 4));

  const changed = await service.changePassword("customer-1", CURRENT_PASSWORD, NEW_PASSWORD, "current-session-token");

  assert.equal(changed, true);
  assert.deepEqual(calls.sessionWhere, {
    customerId: "customer-1",
    revokedAt: null,
    tokenHash: { not: createHash("sha256").update("current-session-token").digest("hex") },
  });
  assert.deepEqual(calls.emailKinds, ["CustomerPasswordChanged"]);
});
