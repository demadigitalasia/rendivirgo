import assert from "node:assert/strict";
import { test } from "node:test";
import { WholesaleApplicationsService } from "./wholesale-applications.service";

const input = { businessName: "  Studio Gem  ", buyerType: "Designer", country: " Indonesia ", needs: " Looking for cabochon supplies ", website: "https://example.com" };

function fixture(overrides: Record<string, unknown> = {}) {
  let customer: any = { id: "customer-1", email: "buyer@example.invalid", name: "Buyer", emailVerifiedAt: new Date(), wholesaleRevision: 0, wholesaleAccess: false, wholesaleStatus: "None", ...overrides };
  const jobs: any[] = [];
  let writes = 0;
  const tx: any = {
    customer: {
      findUnique: async () => ({ ...customer }), findUniqueOrThrow: async () => ({ ...customer }),
      updateMany: async ({ where, data }: any) => {
        if (where.wholesaleRevision !== customer.wholesaleRevision) return { count: 0 };
        writes++;
        customer = { ...customer, ...data, wholesaleRevision: customer.wholesaleRevision + 1 };
        return { count: 1 };
      },
    },
    admin: { findMany: async () => [{ email: "admin@example.invalid" }] },
  };
  const prisma: any = { $transaction: async (fn: any) => fn(tx) };
  const outbox: any = { enqueue: async (_tx: unknown, job: unknown) => jobs.push(job) };
  const config: any = { get: (key: string) => key === "APP_ORIGIN" ? "https://example.invalid" : undefined };
  return { service: new WholesaleApplicationsService(prisma, outbox, config), tx, jobs, get customer() { return customer; }, get writes() { return writes; } };
}

test("verified buyer submits normalized business details and queues customer/admin mail once", async () => {
  const f = fixture();
  const result = await f.service.request("customer-1", input);
  assert.equal(result.wholesaleStatus, "Pending");
  assert.equal(f.customer.wholesaleBusinessName, "Studio Gem");
  assert.equal(f.customer.wholesaleBusinessCountry, "Indonesia");
  assert.equal(f.jobs.length, 2);
  assert.equal(f.jobs[0].kind, "WholesaleCustomerNotification");
  assert.equal(f.jobs[1].kind, "WholesaleAdminNotification");
  assert.notEqual(f.jobs[0].tokenHash, f.jobs[1].tokenHash);
  const duplicate = await f.service.request("customer-1", input);
  assert.equal(duplicate.requestCreated, false);
  assert.equal(f.writes, 1);
  assert.equal(f.jobs.length, 2);
});

test("unverified accounts cannot submit or be approved", async () => {
  const f = fixture({ emailVerifiedAt: null });
  await assert.rejects(() => f.service.request("customer-1", input), /Verify your email/);
  await assert.rejects(() => f.service.review(f.tx, f.customer, { wholesaleStatus: "Approved" }), /Verify the customer email/);
  assert.equal(f.writes, 0);
  assert.equal(f.jobs.length, 0);
});

test("rejection requires a reason, preserves the application and allows resubmission", async () => {
  const f = fixture({ wholesaleStatus: "Pending", wholesaleRequestedAt: new Date() });
  await assert.rejects(() => f.service.review(f.tx, f.customer, { wholesaleStatus: "Rejected" }), /Enter a reason/);
  await f.service.review(f.tx, f.customer, { wholesaleStatus: "Rejected", wholesaleReviewReason: "  Please provide your studio information.  " });
  assert.equal(f.customer.wholesaleAccess, false);
  assert.equal(f.customer.wholesaleStatus, "Rejected");
  assert.equal(f.customer.wholesaleReviewReason, "Please provide your studio information.");
  assert.ok(f.customer.wholesaleRequestedAt);
  assert.equal(f.jobs.length, 1);
  assert.match(f.jobs[0].email.text, /Please provide your studio information/);
  await f.service.request("customer-1", input);
  assert.equal(f.customer.wholesaleStatus, "Pending");
  assert.equal(f.customer.wholesaleReviewReason, null);
  assert.equal(f.customer.wholesaleRevision, 2);
});

test("approval grants access, queues the decision once and rejects conflicting flags", async () => {
  const f = fixture({ wholesaleStatus: "Pending" });
  await assert.rejects(() => f.service.review(f.tx, f.customer, { wholesaleStatus: "Approved", wholesaleAccess: false }), /must agree/);
  await f.service.review(f.tx, f.customer, { wholesaleStatus: "Approved" });
  assert.equal(f.customer.wholesaleAccess, true);
  assert.ok(f.customer.wholesaleApprovedAt);
  assert.equal(f.jobs.length, 1);
  await f.service.review(f.tx, f.customer, { wholesaleStatus: "Approved" });
  assert.equal(f.jobs.length, 1);
});

test("a stale reviewer cannot overwrite a newer application", async () => {
  const f = fixture({ wholesaleStatus: "Pending", wholesaleRevision: 2 });
  await assert.rejects(() => f.service.review(f.tx, { ...f.customer, wholesaleRevision: 1 }, { wholesaleStatus: "Approved" }), /application changed/);
  assert.equal(f.jobs.length, 0);
  assert.equal(f.customer.wholesaleStatus, "Pending");
});

test("business HTML is escaped in admin notifications", async () => {
  const f = fixture();
  await f.service.request("customer-1", { ...input, businessName: "<script>alert(1)</script>" });
  assert.ok(!f.jobs[1].email.html.includes("<script>"));
  assert.match(f.jobs[1].email.html, /&lt;script&gt;/);
});
