# Two wholesale paths

- `/wholesale`: public choice of Finished Products and Rough Materials.
- `/wholesale/finished`: existing protected customer wholesale catalog and application process.
- `/wholesale/checkout`: existing protected finished-product checkout.
- `/wholesale/rough`: public material catalog and bulk inquiry calculator, with no login requirement.

Rough Materials uses its own table and pricing in USD/kg. It does not expose private wholesale prices, add to either shopping cart, create system orders, reserve stock, charge payments, or automatically send messages. Existing products are not automatically reclassified or assigned prices per kg.

## Admin setup

Open **Admin → Rough Materials** (`/admin/rough-materials`). Each entry represents one material type. Enter a unique SKU, material name, stone type, origin, information, optional size/grading notes, photos, and USD price per kg. Optionally enter available weight in kg; blank means the team confirms availability manually. Toggle availability and publication separately. Publication requires a photo and material information. Unpublish to remove an entry from the public catalog.

No invented materials, supply figures, or prices are published by default. The public page has an empty-catalog contact state until real entries are published.

Configure `store.whatsapp` (international number) and `store.email` in existing store settings. The secondary WhatsApp setting is used when the primary number is unavailable. Missing contact channels are disabled rather than linked to an invented recipient.

## Calculator and handoff

- Combined minimum: **2,000 kg (2 metric tons)**, across one or two material types.
- Maximum: **2 distinct entries**; duplicate IDs and third entries are rejected by the server.
- Weight precision: 0.001 kg; prices have two decimal places.
- Weight cannot exceed configured material availability.
- Client calculator shows totals below the minimum, but handoff links are locked.
- On an eligible selection, the public quote endpoint rechecks published/available status, stock, current prices, weights, and minimum quantity using database records.
- Only after that check does the page expose WhatsApp/email links with an inquiry summary. Country and destination port are optional. A preview and copy button are available.
- Quote links expire after five minutes; refresh or refocus the page to recheck. The quote is an advisory estimate, not a price commitment. Final weight, availability, freight, taxes, and payment are confirmed manually.

API routes: `GET /api/rough-materials`, `POST /api/rough-materials/quote`; protected admin routes: `GET/POST /api/admin/rough-materials`, `PATCH /api/admin/rough-materials/:id`. Public responses contain only the material fields needed for the catalog. Draft entries cannot be quoted.

## Deployment and checks

Generate Prisma client during build and deploy migration `20261024230000_rough_materials` before starting the updated API. Migration was applied to the local development database. Production has not been migrated or deployed in this task.

Focused tests:

```sh
cd api
node --import tsx --test src/rough-materials/rough-materials.spec.ts
```

```sh
node --import ./api/node_modules/tsx/dist/loader.mjs --test scripts/rough-materials.spec.ts scripts/locale-routing.spec.ts
```

Local HTTP smoke checks verified guest catalog access, draft exclusion, admin authentication, valid two-ton quote totals, rejection of under-minimum/third-type/draft requests, and no system order creation. Temporary test materials were removed. Browser checks verified two selected 1,000 kg materials unlock contact links, a third material is disabled, and reducing the combined weight to 1,999 kg disables the links.

## Audit follow-up — 24 October 2026

- Checkout rejects a missing variant ID whenever a product has variants, for both online and finished wholesale orders.
- Finished price sorting/filtering uses the minimum effective variant price (including parent fallback) in SQL before pagination. Cards show the same from-price and initially select the least expensive priced option.
- Registration and resend emails preserve an allowlisted finished/checkout return intent. Post-login redirects are restricted to same-origin paths. Unapproved customer dashboards now link to their wholesale application and status.
- Workspace navigation rechecks access on focus, visibility, application changes and every 30 seconds.
- Rough inquiry drafts (material IDs, weights and optional destination only; no cached price or quote URL) are stored in the browser. They are filtered against the current catalog on load; server validation still precedes handoff.
- Quotes renew at expiry. The UI separates checking, failed and expired states and shows when prices were checked plus a price-change notice. One material initially targets 2,000kg where stock permits; each line has a combined-total adjustment action.
- Each generated estimate has a reference and timestamp in the manual message. This reference is not a stored order or a guarantee of price/stock.
- WhatsApp settings accept international numbers starting with 1–9, 8–15 digits, optionally formatted with +, spaces, parentheses or hyphens. Domestic leading-zero numbers and invalid primary numbers do not block a valid secondary fallback.
- Admin warns when published stock cannot reach 2,000kg with two types and when contact channels need configuration.
- Product editor adds an explicit Bulk rough classification for reviewing legacy inventory. Marking it disables website, finished wholesale, Workshop POS and Etsy channels. Server validation enforces manual-only use; a database constraint also blocks the online channels. Publish actual bulk data separately in Rough Materials. No existing product has been guessed, repriced or automatically reclassified.

New migration: `20261025000000_bulk_material_channel` adds `Product.isBulkMaterial` (default false) and the manual-channel constraint. Applied only to the local development database. Run all migrations before the updated production API starts.

Verification in this follow-up: API TypeScript and whitespace/diff checks pass. Frontend TypeScript reports the same 31 existing errors limited to the unrelated admin content/navigation page, with no errors in the files changed for this follow-up. No test suite or message/payment flow was run in this follow-up. The earlier 19-test result above belongs to the preceding implementation/audit.
