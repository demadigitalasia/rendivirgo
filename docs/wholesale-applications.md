# Wholesale applications

Customers verify their email, sign in, and open `/wholesale`. The application asks for a business/studio name, buyer type, country, optional HTTP(S) business link, and purchasing needs. The same application module protects `/wholesale/checkout`.

## States and review

- `None`: no application yet.
- `Pending`: business details submitted; repeat submissions do not create duplicate notifications.
- `Approved`: verified customer may access the private catalog and checkout.
- `Rejected`: access disabled; customer sees the review reason and may edit and resubmit their business details.

Admin: **Customers → Wholesale requests → customer profile**. Read the business details and approve or reject. Rejection and revocation require a reason that is shown and emailed to the customer. Existing customer audit events record the reviewing administrator and submitted decision. Decisions and email enqueueing happen in one database transaction; revision checks prevent a stale review from overwriting newer state.

The pending request filter excludes rejected applications. Existing approved/pending customers are backfilled by the migration. They are not required to reapply.

## Notifications

Application receipt is queued for the customer and all registered admin email addresses. `ADMIN_EMAIL` is a fallback when there are no registered admins. Approval, rejection, and revocation queue a customer decision email. Notifications contain an account/admin link, never an authentication token.

The encrypted email outbox retries delivery, deduplicates by customer/revision/recipient type, and cancels notifications for superseded decisions. Notifications expire after seven days. `RESEND_API_KEY`, `EMAIL_FROM`, stable `SESSION_SECRET`, and `APP_ORIGIN` must be configured. Unlike authentication links, wholesale notifications can be queued while email delivery is disabled. Delivery is retried when configuration is restored and the API restarted.

The application view checks status every 30 seconds while visible and when the browser regains focus. This does not replace server authorization on catalog and order endpoints.

## Deployment

Run `npm --prefix api run prisma:generate` during build and `npm --prefix api run prisma:deploy` before starting the updated API. Migration: `20261024220000_wholesale_applications`. The development database migration was applied locally; production must run it as part of deployment.

Focused verification: `cd api && node --import tsx --test src/customers/wholesale-applications.spec.ts`.
