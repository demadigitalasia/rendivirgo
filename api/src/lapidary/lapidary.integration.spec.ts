import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "../../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { CustomerAuthService } from "../customers/customer-auth.service";
import { LapidaryService } from "./lapidary.service";
import { LapidaryEmailOutboxService } from "./lapidary-email-outbox.service";

const databaseUrl = process.env.LAPIDARY_TEST_DATABASE_URL;
describe("Lapidary workflow with isolated PostgreSQL", { skip: !databaseUrl }, () => {
  let prisma: PrismaClient;
  let service: LapidaryService;
  let worker: LapidaryEmailOutboxService;
  let directory: string;
  const originalDirectory = process.env.LAPIDARY_PRIVATE_UPLOAD_DIR;
  const originalOrigin = process.env.PUBLIC_SITE_URL;
  let customerId: string;
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6+2kAAAAASUVORK5CYII=", "base64");
  const file = () => ({ originalname: "fixture.png", mimetype: "image/png", size: png.length, buffer: png });
  const context = {};
  const email = { isEnabled: () => true, readiness: () => ({ enabled: true, senderConfigured: true }), send: async () => { throw new Error("Real email sends forbidden in integration tests"); } };
  const decode = (payload: string): { html: string } => Reflect.get(worker, "decrypt").call(worker, payload);
  const claimFrom = (html: string) => {
    const href = html.match(/href="([^"]*\/account\/login[^\"]+)"/)?.[1];
    assert.ok(href);
    const login = new URL(href.replaceAll("&amp;", "&"));
    assert.equal(login.origin, "http://localhost:3000");
    return new URL(login.searchParams.get("next")!, login.origin).searchParams.get("claim")!;
  };
  before(async () => {
    assert.ok(new URL(databaseUrl!).pathname.startsWith("/rv_lapidary_test_"), "Integration tests require an explicitly isolated test database");
    directory = await mkdtemp(join(tmpdir(), "rv-lapidary-integration-"));
    process.env.LAPIDARY_PRIVATE_UPLOAD_DIR = directory;
    process.env.PUBLIC_SITE_URL = "http://localhost:3000";
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    await prisma.$connect();
    worker = new LapidaryEmailOutboxService(prisma as never, email as never, new ConfigService({ SESSION_SECRET: "integration-only-stable-outbox-secret" }));
    // Do not call onModuleInit: queued emails remain in this test database.
    service = new LapidaryService(prisma as never, { getPublicSettings: async () => ({ "store.email": "studio@example.invalid" }) } as never, email as never, { log: async () => {} } as never, worker);
  });
  after(async () => {
    await prisma?.$disconnect();
    if (directory) await rm(directory, { recursive: true, force: true });
    if (originalDirectory === undefined) delete process.env.LAPIDARY_PRIVATE_UPLOAD_DIR; else process.env.LAPIDARY_PRIVATE_UPLOAD_DIR = originalDirectory;
    if (originalOrigin === undefined) delete process.env.PUBLIC_SITE_URL; else process.env.PUBLIC_SITE_URL = originalOrigin;
  });
  async function fixture(status: "MaterialReceived" | "AwaitingPayment" | "Approved" = "MaterialReceived") {
    return prisma.lapidaryRequest.create({ data: {
      requestNumber: `FIXTURE-${crypto.randomUUID()}`, name: "Fixture", email: "fixture@example.invalid", phone: "+6281234567890", country: "Indonesia",
      materialSource: "CustomerSupplied", materialDescription: "Fixture stone", serviceType: "CabochonPendant", details: "Fixture scope", status, customerId,
      serviceEstimateMin: 50, serviceEstimateMax: 100, estimateAcceptedAt: new Date(), materialReceivedAt: new Date(), materialShippingInstructions: "Fixture studio address",
    } });
  }
  it("runs intake, verified registration, claim, material, photos, revised invoice, payment and delivery", async () => {
    const received = await service.createRequest({ name: "Fixture customer", email: "fixture@example.invalid", phone: "+6281234567890", country: "Indonesia", materialSource: "CustomerSupplied", materialDescription: "Fixture agate material", materialWeightGram: 100, consent: true, referenceImageUrls: [], items: [{ serviceType: "CabochonPendant", shapeKey: "oval", lengthMm: 20, widthMm: 15, depthMm: 5, quantity: 1 }] } as never, [file()]);
    const request = await prisma.lapidaryRequest.findUniqueOrThrow({ where: { requestNumber: received.requestNumber } });
    assert.equal(await prisma.lapidaryEmailOutbox.count({ where: { requestId: request.id } }), 2, "Intake emails must be transactional outbox jobs");
    await service.updateRequest(request.id, { status: "Reviewing" }, context);
    await service.updateRequest(request.id, { status: "Approved", serviceEstimateMin: 50, serviceEstimateMax: 100, materialShippingInstructions: "Fixture studio address and parcel instructions" }, context);
    const approval = await prisma.lapidaryEmailOutbox.findFirstOrThrow({ where: { requestId: request.id, dedupeKey: { contains: ":approved:" } } });
    const claim = claimFrom(decode(approval.encryptedPayload).html);
    let verificationHtml = "";
    const auth = new CustomerAuthService(prisma as never, { enqueue: async (_tx: unknown, job: { email: { html: string } }) => { verificationHtml = job.email.html; } } as never, new ConfigService({ PUBLIC_SITE_URL: "http://localhost:3000", APP_ORIGIN: "http://localhost:3001" }));
    await auth.register({ email: "fixture@example.invalid", next: `/account/lapidary?claim=${claim}` });
    const token = verificationHtml.match(/token=([^"&<>\s]+)/)?.[1];
    assert.ok(token);
    await auth.verifyEmail(decodeURIComponent(token), "Fixture customer", "Fixture-only-password-123!");
    const customer = await prisma.customer.findUniqueOrThrow({ where: { email: "fixture@example.invalid" } });
    customerId = customer.id;
    assert.ok(customer.emailVerifiedAt);
    await prisma.customer.update({ where: { id: customerId }, data: { addressLine1: "Fixture address", city: "Bandung", postalCode: "40100", country: "Indonesia", countryCode: "ID", phone: "+6281234567890" } });
    await service.claimCustomerRequest(customerId, { token: claim });
    await assert.rejects(() => service.claimCustomerRequest(customerId, { token: claim }), /invalid, expired/);
    await service.acceptEstimate(customerId, request.requestNumber, { accepted: true });
    await service.submitInboundShipment(customerId, request.requestNumber, { carrier: "DHL", trackingNumber: "INBOUND123", trackingUrl: null });
    await service.updateRequest(request.id, { status: "MaterialReceived" }, context);
    await service.updateRequest(request.id, { status: "InProgress" }, context);
    await service.addProgressUpdate(request.id, { title: "Polishing complete", body: "Fixture polishing photos", isCustomerVisible: true }, [file()]);
    await service.addProgressUpdate(request.id, { title: "Internal assessment", body: "Fixture internal note", isCustomerVisible: false }, []);
    const project = await service.getCustomerRequest(customerId, request.requestNumber);
    assert.ok(project.progressUpdates.some((update) => update.media.length));
    assert.ok(!project.progressUpdates.some((update) => update.title === "Internal assessment"));
    await assert.rejects(() => service.getCustomerRequest("unrelated-customer", request.requestNumber), /not found/);
    await service.updateRequest(request.id, { status: "Completed" }, context);
    await assert.rejects(() => service.updateRequest(request.id, { status: "AwaitingPayment", invoiceServiceAmount: 101, invoiceReturnShippingAmount: 20 }, context), /exceeds/);
    await service.updateRequest(request.id, { status: "AwaitingPayment", invoiceServiceAmount: 60, invoiceReturnShippingAmount: 20 }, context);
    await service.uploadInvoicePaymentProof(customerId, request.requestNumber, file(), 1);
    await service.updateRequest(request.id, { status: "AwaitingPayment", reviseInvoice: true, invoiceRevisionReason: "Correct return shipping cost", invoiceServiceAmount: 60, invoiceReturnShippingAmount: 25 }, context);
    const revised = await prisma.lapidaryInvoice.findUniqueOrThrow({ where: { requestId: request.id } });
    assert.equal(revised.revision, 2);
    assert.equal(Number(revised.totalAmount), 85);
    assert.equal(revised.paymentProofPath, null);
    assert.equal(revised.returnAddressLine1, "Fixture address");
    await assert.rejects(() => service.uploadInvoicePaymentProof(customerId, request.requestNumber, file(), 1), /invoice changed/);
    await assert.rejects(() => service.updateRequest(request.id, { status: "ReturnShipped", returnCarrier: "DHL", returnTrackingNumber: "RETURN123" }, context), /Confirm payment/);
    await service.uploadInvoicePaymentProof(customerId, request.requestNumber, file(), 2);
    const proof = await prisma.lapidaryInvoice.findUniqueOrThrow({ where: { requestId: request.id } });
    await assert.rejects(() => service.markInvoicePaid(request.id, context, { revision: 1, proofUploadedAt: proof.paymentProofUploadedAt!.toISOString() }), /changed/);
    await service.markInvoicePaid(request.id, context, { revision: 2, proofUploadedAt: proof.paymentProofUploadedAt!.toISOString() });
    await service.updateRequest(request.id, { status: "ReturnShipped", returnCarrier: "DHL", returnTrackingNumber: "RETURN123" }, context);
    await assert.rejects(() => service.updateRequest(request.id, { status: "ReturnShipped", returnCarrier: "", returnTrackingNumber: "" }, context), /Keep the return/);
    await service.updateRequest(request.id, { status: "Delivered" }, context);
    const delivered = await service.getCustomerRequest(customerId, request.requestNumber);
    assert.ok(delivered.deliveredAt && delivered.invoice?.status === "Paid");
    assert.equal(await prisma.lapidaryEmailOutbox.count({ where: { requestId: request.id, status: "Sent" } }), 0);
  });
  it("serializes concurrent payment and cancellation without a paid-and-void result", async () => {
    const request = await fixture("AwaitingPayment");
    const proofAt = new Date();
    await prisma.lapidaryInvoice.create({ data: { requestId: request.id, serviceAmount: 60, returnShippingAmount: 20, totalAmount: 80, paymentProofPath: "fixture-receipt.png", paymentProofMime: "image/png", paymentProofUploadedAt: proofAt } });
    const operations = await Promise.allSettled([
      service.markInvoicePaid(request.id, context, { revision: 1, proofUploadedAt: proofAt.toISOString() }),
      service.updateRequest(request.id, { status: "Cancelled", cancellationReason: "Fixture cancellation request" }, context),
    ]);
    assert.equal(operations.filter((result) => result.status === "fulfilled").length, 1);
    const result = await prisma.lapidaryRequest.findUniqueOrThrow({ where: { id: request.id }, include: { invoice: true } });
    assert.ok((result.status === "AwaitingPayment" && result.invoice?.status === "Paid") || (result.status === "ReturnPending" && result.invoice?.status === "Void"));
    assert.ok(!(result.invoice?.status === "Void" && result.invoice.paidAt));
  });
  it("recovers expired invitations and makes old tokens unusable", async () => {
    const request = await fixture("Approved");
    await prisma.lapidaryRequest.update({ where: { id: request.id }, data: { customerId: null, claimTokenHash: "expired-fixture", claimTokenExpiresAt: new Date(0) } });
    await service.reissueInvitation(request.id, context);
    const job = await prisma.lapidaryEmailOutbox.findFirstOrThrow({ where: { requestId: request.id, dedupeKey: { contains: ":invitation:" } } });
    const claim = claimFrom(decode(job.encryptedPayload).html);
    await assert.rejects(() => service.reissueInvitation(request.id, context), /one minute/);
    await service.claimCustomerRequest(customerId, { token: claim });
    assert.equal((await prisma.lapidaryRequest.findUniqueOrThrow({ where: { id: request.id } })).customerId, customerId);
  });
  it("keeps custody after cancellation and supports a free return invoice", async () => {
    const request = await fixture();
    await service.updateRequest(request.id, { status: "Cancelled", cancellationReason: "Fixture work cancelled before cutting" }, context);
    let returned = await prisma.lapidaryRequest.findUniqueOrThrow({ where: { id: request.id } });
    assert.equal(returned.status, "ReturnPending");
    assert.ok(returned.workCancelledAt);
    await assert.rejects(() => service.updateRequest(request.id, { status: "AwaitingPayment", invoiceServiceAmount: 1, invoiceReturnShippingAmount: 0 }, context), /zero service fee/);
    await service.updateRequest(request.id, { status: "AwaitingPayment", invoiceServiceAmount: 0, invoiceReturnShippingAmount: 0 }, context);
    assert.equal((await prisma.lapidaryInvoice.findUniqueOrThrow({ where: { requestId: request.id } })).status, "Paid");
    await service.updateRequest(request.id, { status: "ReturnShipped", returnCarrier: "Fixture carrier", returnTrackingNumber: "FREE123" }, context);
    await service.updateRequest(request.id, { status: "Delivered" }, context);
    returned = await prisma.lapidaryRequest.findUniqueOrThrow({ where: { id: request.id } });
    assert.ok(returned.deliveredAt && returned.workCancelledAt);
  });
});
