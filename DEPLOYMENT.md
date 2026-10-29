# Finkel Reserve — Deployment Guide

Everything needed to take this repository from zero to a live, working store: environment setup,
database migration, seeding, local development, production build, and Cloudflare deployment —
plus a consolidated checklist for verifying it actually works, since nothing in this project has
been run against a live Supabase project or a live Paystack account from any environment this was
built in.

Read this top to bottom the first time; after that, use it as a reference.

---

## 0. Prerequisites

- **Node.js 20.6+** (needed for `--env-file`, used by the seed script)
- A [Supabase](https://supabase.com) account — free tier is enough to start
- A [Cloudflare](https://cloudflare.com) account (Workers, free tier is enough to start)
- Optional: a [Paystack](https://paystack.com) account, if you want online payment in addition to
  pay-on-delivery
- The [Supabase CLI](https://supabase.com/docs/guides/cli): `npm install -g supabase` (or use
  `npx supabase` everywhere below without installing it globally)

---

## 1. Install and configure

```bash
npm ci
cp .env.example .env
```

On PowerShell, use `Copy-Item .env.example .env` for the second command. Open `.env` and fill in
the Supabase URL, publishable key and service-role key from the next step. The `VITE_` Supabase
values are the public browser configuration and must match their non-prefixed counterparts. Never
put the service-role key in a `VITE_` variable. Paystack, email, SMS and WhatsApp settings are
optional.

---

## 2. Create and configure your Supabase project

1. **Create a project** at [supabase.com/dashboard](https://supabase.com/dashboard/projects).
2. **Get your keys**: Project Settings → API. Set these in `.env`:
   - `SUPABASE_URL` and `VITE_SUPABASE_URL` — the Project URL (same value, both variables)
   - `SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_PUBLISHABLE_KEY` — the project's publishable
     key (same value, both variables; older projects may label this the `anon` key)
   - `SUPABASE_SERVICE_ROLE_KEY` — the `service_role` key. **This one has no `VITE_` twin, on
     purpose** — it bypasses Row Level Security entirely and must never reach the browser. Never
     put this value in a `VITE_`-prefixed variable.
3. **Link the CLI to your project**:
   ```bash
   npx supabase login
   npx supabase link --project-ref your-project-ref
   ```
   (Your project ref is in the dashboard URL: `supabase.com/dashboard/project/<this-part>`.)

---

## 3. Run the database migrations

The timestamped migrations in `supabase/migrations/` are applied in filename order (alphabetical
order is chronological order). Together they build up the entire
schema — every table, every RLS policy, every Postgres function this app relies on — from a fresh
project to the current, full feature set (catalog/variants, checkout, payments/refunds,
promotions, shipping, returns, admin platform + audit log, inventory import, store settings,
customer accounts + addresses + deletion, product customization).

**For a production database, take or verify a current backup first. Then inspect the linked
project and pending migrations before applying anything:**

```bash
npx supabase migration list --linked
npx supabase db push --linked
```

This applies pending migrations in order; it tracks which ones have already been applied. Review
the CLI output and confirm the linked project is the intended production database before
proceeding. Do not apply the same files manually in the SQL Editor and then run `db push` without
reconciling migration history.

**A note on migration failures**: a few migrations look up foreign-key constraint names at runtime
instead of assuming them, but that does not make partially applied migrations safe to blindly
retry. Read the error, inspect the database state and migration history, and resolve the cause
before continuing.

**Fresh project only**: if you choose to use the SQL Editor instead, apply every migration in
filename order and verify the schema and RLS policies afterward. Never use this shortcut on an
existing database or when migration history is unclear.

---

## 4. Regenerate TypeScript types

The migrations create real tables, but the app's committed `src/integrations/supabase/types.ts`
was generated against an earlier schema — several recent tables and columns aren't in it yet (each
site that works around this is commented `// documented types.ts gap` in the code, so they're easy
to find). Regenerate it against your actual live schema:

```bash
npx supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

In Windows PowerShell, use
`npx supabase gen types typescript --linked | Set-Content -Encoding utf8 src/integrations/supabase/types.ts`
to avoid legacy shell redirection encoding the file as UTF-16.

This is optional for the app to _run_ (every gap has a documented, working type-cast fallback) but
recommended — it gives you real autocomplete and type-checking on every table going forward, and
is a good one-time cleanup: once regenerated, you can grep for `documented types.ts gap` and
simplify those spots to use the real generated types directly.

---

## 5. Populate the catalog

The starter catalog contains illustrative producers, placeholder prices and stock photography.
**Do not seed it into production as-is.** The seed script upserts by slug and will overwrite
existing rows with matching starter slugs if run again.

For local development or a disposable demo database only:

```bash
npm run db:seed
```

This upserts sample products and creates/updates the `FINKEL10` first-order coupon. If you use a
different production catalog, add real products through the admin UI or import them as inactive
drafts with `scripts/import-catalog.mjs` (dry-run first, then `--commit` after reviewing the
preview). Create the `FINKEL10` coupon in Admin → Promotions only if you intend to honor the code
advertised on the homepage.

Before launch, verify product sourcing, prices, bottle/box stock, delivery zones and product
photography in the production admin.

---

## 6. Create your first admin account

There's no self-service way to become the first admin — by design, only an existing admin can
grant the role, so the very first one has to be set directly in the database:

1. Sign up once through the running app's `/auth` page (see step 9 to get it running locally
   first if you haven't yet).
2. In the Supabase SQL Editor, run:
   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'admin' from auth.users where email = 'you@example.com';
   ```
3. Sign out and back in (or just refresh) — `/admin` should now be reachable, and you can promote
   further admins the same way you'd do anything else in the admin UI from here.

---

## 7. (Optional) Paystack

Skip this if pay-on-delivery is enough for now — it works with zero extra setup, and everything
else in the app functions normally without Paystack configured.

1. Get a **test secret key**: [Paystack dashboard](https://dashboard.paystack.com) → Settings →
   API Keys & Webhooks. Put it in `.env` as `PAYSTACK_SECRET_KEY`.
2. **Add a webhook**, same settings page, pointing at
   `https://your-deployed-domain.com/api/paystack-webhook`. This confirms payment even if the
   customer closes the tab before returning — the order-confirmation page also double-checks
   directly with Paystack when they do return, so payments still confirm even before the webhook
   is set up.
3. Test with [Paystack's test cards](https://paystack.com/docs/payments/test-payments/) before
   going live. Swap in the live secret key only once you've verified the full flow — see the
   checklist below.

---

## 8. (Optional) Google sign-in

Supabase Dashboard → Authentication → Providers → Google. Without this, email/password auth
(including forgot/reset password) works fine on its own.

---

## 9. Configure production URLs and run locally

For production, configure the Supabase Auth **Site URL** and allowed redirect URLs to include your
real HTTPS domain. Set `SITE_URL` to that origin and set `VITE_SITE_URL` to the same origin before
the production build. `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SITE_URL` and
`VITE_WHATSAPP_NUMBER` are build-time client settings; changing them requires a new build and
deployment. Do not put secrets in any `VITE_` variable.

For local development, keep the `.env.example` defaults for the local site URL, fill in your
Supabase values, and run:

```bash
npm run dev
```

Open http://localhost:3000. The database migrations must be applied first; seed sample data only
if this is a development/demo project.

---

## 10. Build and deploy

```bash
npm run build
```

This produces `.output/server/`, ready for Cloudflare Workers, with its own generated
`wrangler.json`. On memory-constrained machines, this project may need a larger Node.js heap
during bundling. If `npm run build` fails with a heap-out-of-memory error, use:

```bash
$env:NODE_OPTIONS = "--max-old-space-size=3200"
npm run build
```

Set the four build-time client variables in `.env` (or your CI build environment) before building:
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SITE_URL`, and, if needed,
`VITE_WHATSAPP_NUMBER`. The server-only values are configured on the Worker at runtime and are
not baked into the client bundle.

**Deploy** (after configuring Worker runtime variables/secrets in Cloudflare):

```bash
npx nitro deploy --prebuilt
```

This prompts for a Cloudflare login on first run. If you'd rather use Wrangler directly:
`cd .output/server && npx wrangler deploy`.

Set the server-side values in the Cloudflare Worker settings (Dashboard → Worker → Settings →
Variables and Secrets, or Wrangler). Do not set the `VITE_` values as Worker secrets; those are
only used at build time. Required runtime settings:

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

Also configure `SITE_URL` as a Worker variable. Add `PAYSTACK_SECRET_KEY` only when online
payments are enabled. For order emails, set `SENDGRID_API_KEY` and `NOTIFY_FROM_EMAIL`; optionally
set `NOTIFY_FROM_NAME` and `NOTIFY_REPLY_TO`. SMS is disabled by default: read the restrictions in
README.md before enabling it, then set `NOTIFY_SMS_ENABLED=true` and the required Twilio
credentials. `wrangler secret put NAME` prompts for the secret value; never put it in a command
argument or commit it.

After deployment, confirm the Worker is healthy, check Cloudflare logs, and complete the relevant
RLS, authentication, order, payment and notification checks below using test accounts and payment
credentials before switching to live payments.

The `VITE_`-prefixed variables don't need a separate Worker secret — they're baked into the
client bundle at build time, so they just need to be set in `.env` _before_ you run `npm run
build`.

---

## 11. Verification checklist

This consolidates the specific things flagged as "implemented but never run against a live
system" across every pass, organized by feature. Work through it once after your first deploy;
after that, the parts relevant to whatever you're changing are worth re-checking on any future
schema change.

### RLS — the actual security boundary, not just the UI

- [ ] Signed out / anon: can read active products, reviews, active shipping zones, active
      customization types, store settings — nothing else.
- [ ] As customer A, confirm you cannot read customer B's profile, orders, addresses, returns, or
      wishlist (profiles specifically: direct REST call for another user's row should return
      nothing or an error, not their phone number — this was a real bug found and fixed in an
      earlier pass, worth re-confirming after any RLS-touching change).
- [ ] As a non-admin, confirm every `/admin/*` route and every admin-only table write is actually
      rejected server-side, not just hidden from the nav.

### Checkout / payments

- [ ] Place one order pay-on-delivery, one via Paystack test card, confirm both land correctly in
      `/admin/orders` with the right `payment_status`.
- [ ] Confirm the Paystack webhook fires and updates the order (check Paystack's dashboard →
      webhook delivery log after a test payment).
- [ ] Try submitting checkout with a tampered price or a nonexistent size/color for a real product
      — should be rejected server-side, not silently accepted.

### Product customization

- [ ] Add a customized item (name + number + a patch) to cart, reload the page, confirm it's
      still there with the right price.
- [ ] Complete an order with that item, confirm the full customization breakdown (not just a flat
      fee) shows correctly on both the customer confirmation page and `/admin/orders`.
- [ ] Try to approve a return containing that item without checking the override box in
      `/admin/returns` — should be rejected; check it — should succeed.

### Account lifecycle

- [ ] Full signup → email confirm (if enabled) → sign in → sign out cycle.
- [ ] Forgot password → check inbox for the reset link → set new password → sign in with it.
- [ ] Create a test account with no orders, delete it — confirm it's actually gone from Auth
      (Supabase dashboard → Authentication → Users), and that any orders it _did_ place (test
      this with a second account that has one) still show up correctly in `/admin/orders` with
      `user_id` null but customer name/email/phone intact.

### Inventory / returns / refunds

- [ ] Upload a test Excel/CSV via `/admin/inventory` import, confirm the preview and commit both
      behave as expected.
- [ ] Request a return as a customer, move it through the full admin status pipeline
      (`requested → under_review → approved → item_received → refund_initiated → completed`),
      confirm a real refund attempt reaches Paystack for a card-paid order.

### General

- [ ] `sitemap.xml` and `robots.txt` resolve correctly on your actual deployed domain (not
      `localhost` or the fallback `finkelreserve.com` — confirms `SITE_URL` is set correctly).
- [ ] Spot-check the storefront on an actual phone, not just a resized browser window — mobile
      layout was reviewed carefully at the code level throughout, but nothing in this project has
      been checked on a real device from any environment it was built in.

---

## Troubleshooting

**`npm run build` runs out of memory** — see step 10 above (`NODE_OPTIONS=--max-old-space-size`).

**A migration fails partway through** — read the actual error; several later migrations look up
constraint names dynamically rather than assuming them specifically to avoid this, but a genuinely
broken prior state (e.g., a migration applied out of order by hand via the SQL editor) can still
cause one. `npx supabase migration list --linked` shows exactly what your project thinks is
applied.

**Checkout/admin pages show errors mentioning a missing column** — you're running against a
Supabase project that hasn't had the full migration set applied yet, or `types.ts` is stale enough
that a code path isn't hitting its fallback correctly. Re-run step 3, then step 4.

**A newly created admin can't reach `/admin`** — sign out and back in (or hard-refresh) so the
client picks up the new role from a fresh session; the role check happens on the current session's
claims, not live on every request.

**If you ever add a new server function file under `src/lib/actions/`**: keep each file's
_client-imported_ exports limited to `createServerFn(...)` results (plus types). A file that
exports a plain function alongside a `createServerFn` — where client code imports that
`createServerFn` directly — can leak the plain function's server-only code (including any
`supabaseAdmin`/service-role usage) into the client bundle, even though the actual secret _value_
still resolves to `undefined` there. This happened twice in this codebase (the original Paystack
webhook, and later `shipping.ts`/`coupons.ts`) before being fixed by splitting the plain,
`supabaseAdmin`-using logic into its own file that only other server-only files import. If you're
ever unsure whether something's leaking, the reliable check is grepping the actual built output,
not reasoning about it in the abstract:

```bash
npm run build
grep -rl "SUPABASE_SERVICE_ROLE_KEY\|supabaseAdmin\|service_role" .output/public/
```

Clean means nothing found.
