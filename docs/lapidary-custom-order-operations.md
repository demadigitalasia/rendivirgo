# Lapidary custom order operations

## Customer supplied stone workflow

For an `I HAVE MY ONE STONE` request, the admin reviews the inquiry and approves it with a service estimate range and studio receiving instructions. The approval email includes a secure project link; a customer without an account can register with the same verified email address and then link the request. Claim links expire after 30 days and can only be redeemed by a verified account with the request email.

The customer pays the inbound shipping to the studio. Before dispatch, they accept the estimate and enter their carrier and tracking number in the project dashboard. The tracking URL is optional. The studio confirms receipt, posts dated progress updates and photos, and begins work only after the customer has accepted the current estimate. A revised estimate resets acceptance and must be accepted again. If the customer changes their return destination before invoicing, they should update the address in their account; the resulting invoice snapshots the confirmed destination.

After the admin marks the work complete, they create the final invoice with the service fee and return-shipping fee as separate lines. The final service fee cannot exceed the accepted estimate maximum. Additional work above the maximum needs renewed approval before completion. Before invoicing, the customer must have a complete delivery address in their account; the invoice stores a snapshot of that destination so later profile edits do not silently change the address used to price shipping. The current release accepts bank-transfer receipt uploads, which an admin reviews against received funds and confirms before the return parcel can be marked shipped. Add tracking at dispatch, and mark Delivered only after delivery is confirmed by the carrier or customer.

## Notification readiness and account recovery

Use one canonical frontend origin in `PUBLIC_SITE_URL`; both authentication and Lapidary links use it. `APP_ORIGIN` remains the CORS allowlist and is only a link fallback when no canonical origin is configured. For this local checkout use `PUBLIC_SITE_URL=http://localhost:3000`; production must explicitly use the production HTTPS origin. Do not copy local origins into production deployment settings.

The request inbox shows the running API's email readiness, origin, and pending/failed counts. Configure `RESEND_API_KEY`, a verified `EMAIL_FROM`, and the stable `SESSION_SECRET` in the API environment, then restart the API. Reviewing and intake remain available while the provider is disabled: encrypted messages stay Pending until provider and sender are configured. Approval and new invitations require a configured provider and sender. Sent means provider acceptance, not confirmed inbox delivery; delivery/bounce webhooks and real inbox verification remain operational follow-up work.

For an unlinked project whose invitation expired, use **Send new account invitation**. The action issues a new 30-day token and permits at most one issuance per minute. Older queued invitations are suppressed if their claim token is no longer current. The recipient still needs a verified account with the same email as the request. Invitations can also be recovered while a cancelled material return is pending.

## Invoice correction and payment consistency

For an unpaid invoice, enable **Revise this unpaid invoice**, provide a reason, and update the service/return-shipping amounts. The current customer address becomes the new snapshot. The system increments the invoice version, records the prior values/address in the audit log, invalidates and removes the superseded receipt, and queues the new invoice. The customer must pay and upload evidence against the current version. Paid invoices cannot be revised through this action.

Payment confirmation requires the invoice version and receipt timestamp the admin reviewed. Payment, invoice revision, proof replacement, cancellation, and admin workflow mutations acquire the same PostgreSQL request-row lock. Recheck the current record after acquiring the lock. A stale payment confirmation must fail rather than confirming a replacement invoice or receipt. Keep a carrier and tracking number after dispatch; corrections create a timeline entry and notification.

## Cancellation with material in custody

When material is in transit or has been received, choosing Cancelled requires a reason and moves the project to **Return Pending**. The work cancellation date is retained independently from return delivery. If the parcel was still in transit, confirm it has arrived before preparing the return invoice.

This recovery flow invoices return shipping with a **zero service fee**. Any separate charge for cancelled work requires its own agreement with the customer and is not automatically added by this workflow. Complete the delivery address, issue the return invoice, confirm payment, and use Return Shipped → Delivered. If the entire return invoice is zero, it is automatically settled without requiring an artificial transfer receipt. A paid invoice cannot be cancelled using this path; handle any refund/adjustment separately with the customer.

## Regression checks

From the API directory, `npm run test:lapidary` runs the validator/origin/outbox regression checks. `npm run test:lapidary:integration` creates a dedicated `rv_lapidary_test_*` database on the local dev PostgreSQL host, applies migrations, runs the full backend workflow and payment/cancellation race checks, then drops only that database. It also removes its temporary media directory. The integration worker is never started, so queued test emails cannot reach a provider. The runner refuses a connection other than the expected local `rendi_virgo_dev` source configuration. A local PostgreSQL role with database-create permission is required.

Customer-facing progress photos and email content are private project records. Do not include confidential internal notes in customer-visible progress updates. Email jobs are encrypted in the database using the stable `SESSION_SECRET`, retried by the API worker, and removed after 30 days in a terminal state. Keep `SESSION_SECRET` stable across API restarts and instances, and configure the existing email provider before approving requests.

## Private request media

Customer reference photos and videos are stored outside the public asset directory. The API container writes them under `/data/private/lapidary` by default (`LAPIDARY_PRIVATE_UPLOAD_DIR`). Mount a durable Docker named volume at `/data/private` in the production deployment:

```yaml
services:
  api:
    environment:
      LAPIDARY_PRIVATE_UPLOAD_DIR: /data/private/lapidary
    volumes:
      - lapidary-private-media:/data/private

volumes:
  lapidary-private-media:
```

Keep this volume when replacing or updating the API container, include it in the backup and restore procedure, and restrict host-level access. For multiple API hosts, use shared private object storage instead of a host-local Docker volume. Do not serve this directory from the public web server.
