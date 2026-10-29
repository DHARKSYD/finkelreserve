# Finkel Reserve

A premium online store for **wines, whiskeys and fine beverages** for the Nigerian market — a catalogue grouped into Wines, Whiskey & Spirits and Fine Beverages, bottle or box buying (with an admin-set box discount), promo codes, courier hand-off, order notifications, and pay-on-delivery or online (Paystack) checkout.

> **History note.** This codebase was forked from the Adika Stakes football-jersey store (a separate business that is untouched). The long sections further down record how the app got here across earlier passes, so they still mention jerseys, customization and Adika Stakes; those features were removed when the wine model went in (see `supabase/migrations/20260826090000_wine_product_model.sql`). The current behaviour is described in the feature set and in the Finkel-specific sections near the end.

Built with [TanStack Start](https://tanstack.com/start) (React, file-based routing, server functions), [Supabase](https://supabase.com) (Postgres, Auth, Row Level Security), and deployed to Cloudflare Workers.

## Current feature set

Everything below is real — backed by Postgres/RLS, not `localStorage` — as of the most recent pass. This list exists because the sections further down describe the _history_ of how the app got here across several passes; if you just want to know what it does today, read this instead.

**Storefront**: product catalog with per-bottle-size stock (and optional box buying), search/filters by type (wine, whiskey, spirits, beverages), wishlist, reviews with ratings, cart, coupon codes, real shipping-zone pricing, checkout (pay-on-delivery or Paystack online), order confirmation and history, saved addresses, account security (password change, forgot/reset password), **account deletion**.

**Admin** (`/admin`): dashboard, orders, products + variant stock + customization config, inventory (with Excel/CSV import), payments/refunds, promotions/coupons, shipping zones, returns (with a non-refundable-by-default + override flow for customized items), analytics, store settings (single source of truth for store name/contact/social/SEO defaults — not hardcoded anywhere else), customers, activity log, role management.

**Cross-cutting**: rate limiting on public-facing server functions, RLS on every table, structured zod validation on every server function's input, sitemap.xml/robots.txt, SEO metadata + JSON-LD on product pages, mobile-first responsive UI throughout.

See `DEPLOYMENT.md` for the full setup/migration/deploy walkthrough and a consolidated verification checklist.

## What changed in this pass

This project (originally scaffolded with Lovable) looked complete but had no real backend: products, orders, reviews and admin management all lived in browser `localStorage` via Zustand — invisible to every other visitor, and lost if storage was cleared. Auth was the one piece that was already real (Supabase).

This pass:

- **Replaced the fake local-storage "backend" with a real one.** Products, orders, reviews, and activity now live in Postgres (Supabase), read/written through TanStack Query hooks (`src/lib/queries/`) protected by Row Level Security.
- **Built a real checkout.** `src/lib/actions/checkout.ts` is a server function: it re-prices every cart line from the database (a client can't submit its own total), reserves stock atomically (`adjust_product_stock` in the migration — safe against two people buying the last unit at once), and only then creates the order. Guest checkout works; RLS previously had no policy letting a guest view their own order back — fixed in the migration.
- **Added Paystack** as an optional online-payment method alongside pay-on-delivery: `initialize`/`verify` server functions plus a signature-verified webhook. Untested against the live Paystack API — see [Known limitations](#known-limitations).
- **Removed the Lovable-specific pieces**: the `@lovable.dev/cloud-auth-js` OAuth proxy (swapped for standard Supabase OAuth, which works with any Supabase project) and the disconnected "Taxonomy" admin tab (it edited data that no storefront page actually read).
- **Fixed real bugs found along the way**: a hardcoded `USD × 1500` exchange rate standing in for actual Naira prices, a wrong multiplier on the order-confirmation page, several dead links (WhatsApp button, footer socials) and no-op forms (newsletter, contact), `.env` not being gitignored, and a couple of pre-existing TypeScript/RLS gaps.
- **Grounded the copy in the real brand.** Adika Stakes is a Nigerian football content creator's jersey business (large social following, Nigeria-first, national-team pride, affordability-focused) — the About/homepage copy, footer social links, and contact info were rewritten from that research instead of the generic AI-generated placeholder text. Product photos are still Unsplash placeholders — swap those for real product photography before launch.

## Security audit + fixes (second pass)

A follow-up pass audited the app against a 20-item "vibe-coded app" security checklist (full writeup: `adikastakes-security-audit.md`, kept from that session) and fixed everything that was actually fixable in code:

- **Real input validation.** Every server function (`src/lib/actions/`) now validates its input at runtime with Zod, not just a TypeScript type annotation that erases at compile time and stops nobody hitting the endpoint directly. `placeOrder` additionally cross-checks submitted size/color against what the product actually offers, since that needs the product row and can't live in the schema alone.
- **Contact form and newsletter signup moved behind server functions** (`src/lib/actions/contact.ts`) with the same Zod validation, replacing direct unvalidated inserts against a `with check (true)` RLS policy. The migration also **drops those old permissive insert policies** — adding validation in a server function doesn't actually close the hole if the database still accepts an unvalidated direct insert from anyone with the public anon key, so both had to change together.
- **Rate limiting** added to checkout, both Paystack functions, and the two forms above — a lightweight in-memory limiter (`src/lib/actions/rate-limit.ts`), honest in its own comments about being per-isolate rather than a hard distributed guarantee. Pair it with Cloudflare's edge-level Rate Limiting Rules (dashboard-configurable, no code needed) for the real guarantee.
- **Closed an ownership gap**: `initializePaystackPayment` now checks the caller owns the order (for authenticated orders — guest orders keep the existing "the ID is the access control" trade-off), and validates the callback URL is same-origin rather than trusting whatever the client sends.
- **Fixed a real error-message leak**: Supabase's `PostgrestError` extends the native `Error` class, so a raw `throw error` looks like a normal error but its `.message` is internal Postgres/PostgREST text. Swept every query file (`src/lib/queries/`) for this pattern — 18 occurrences — and replaced it with a shared `throwSafe()` helper that logs the real error and throws a safe, generic one for display.
- **Updated `@cloudflare/vite-plugin`** to the latest compatible version and ran `npm audit fix`, taking `npm audit` from 9 high-severity findings down to 5 (moderate/high, all still in Cloudflare's own build-tooling chain — not shipped code). Didn't force the remaining fix; it wants to install a nitro version numbered `0.0.0`, which is exactly the kind of thing you test on a branch, not apply blind.
- **Raised the password minimum** from 6 to 8 characters client-side (`src/routes/auth.tsx`) — also raise it in Supabase Auth settings, since the client attribute alone doesn't stop a direct API call.
- **Deliberately not changed**: moving session storage off `localStorage` to httpOnly cookies (would need `@supabase/ssr` and touches every server-side auth check in the app — a real migration, not a fix, and not safely doable without testing against a live project) and the `chart.tsx` `dangerouslySetInnerHTML` (unmodified shadcn/ui boilerplate, confirmed unused anywhere in this app). Both are explained in the audit doc rather than silently skipped.

Every change here was verified against the actual build output, not just `tsc` — including re-confirming after each round of edits that no server secret or service-role logic leaked into the client bundle (`.output/public/`).

## Prerequisites

- Node.js **20.6+** (for `--env-file`; you likely have this already if you can run Vite 7)
- A free [Supabase](https://supabase.com) account
- (Optional) A free [Paystack](https://paystack.com) account, for online payments

## Quick start

```bash
npm install
cp .env.example .env
# fill in .env — see "Set up Supabase" below for where the values come from
npm run dev
```

Open http://localhost:3000. The site will run, but the storefront will be empty and checkout will fail until you've applied the database migrations (next section).

## Set up Supabase

The `.env` this project shipped with points at a Supabase project hosted by Lovable's platform. For something you fully own, create your own project — it's on Supabase's free tier and takes a couple of minutes:

1. **Create a project** at [supabase.com/dashboard](https://supabase.com/dashboard/projects).
2. **Get your API keys**: Project Settings → API. Copy the Project URL, the `anon` `public` key, and the `service_role` key into `.env` (see `.env.example` for which variable is which — the service role key has no `VITE_` prefix on purpose, since it must never reach the browser).
3. **Run the migrations**, in order, against your project. Two ways to do this:
   - **Supabase CLI** (recommended): `npx supabase login`, then `npx supabase link --project-ref your-project-ref`, then `npx supabase db push`.
   - **SQL editor**: open each file in `supabase/migrations/` in order and paste its contents into your project's SQL Editor, running them one at a time.
4. **Seed the starter catalog**: `npm run db:seed` (reads `.env`, upserts the products in `scripts/seed-data.mjs`). Re-runnable any time — it upserts on slug, so editing that file and re-running just updates existing rows.
5. **Create your account and make it an admin.** Sign up once through the app's `/auth` page, then in the Supabase SQL Editor run:
   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'admin' from auth.users where email = 'you@example.com';
   ```
   There's no self-service way to become the first admin — by design, only an existing admin can grant the role, so the very first one has to be set directly in the database. After that, admins can promote others the same way.
6. **(Optional) Google sign-in**: Authentication → Providers → Google, in your Supabase dashboard, if you want the "Continue with Google" button to work. Without it, email/password auth still works fine.

## Set up Paystack (optional)

Skip this if pay-on-delivery is enough for now — it works with zero extra setup.

1. Get a **test secret key** from your [Paystack dashboard](https://dashboard.paystack.com) → Settings → API Keys & Webhooks. Put it in `.env` as `PAYSTACK_SECRET_KEY`.
2. **Add a webhook** in the same settings page, pointing at `https://your-deployed-domain.com/api/paystack-webhook`. This is what confirms payment even if the customer closes the tab before returning — the order-confirmation page also double-checks directly with Paystack when the customer does return, so payments still confirm even before you've set the webhook up.
3. Test with [Paystack's test cards](https://paystack.com/docs/payments/test-payments/) before going live, then swap in your live secret key when you're ready.

I could not verify this integration against Paystack's live API myself — this sandbox has no network access to `api.paystack.co`. The request/response shapes follow Paystack's standard, stable Transaction API, but please test the full flow in test mode before relying on it.

## Environment variables

See `.env.example` for the full list with explanations. Summary:

| Variable                                                                                                              | Required | Notes                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL` / `VITE_SUPABASE_URL`                                                                                  | Yes      | Same value, two names (server + client)                                                                  |
| `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY`                                                          | Yes      | The `anon` key — safe to expose to the browser                                                           |
| `SUPABASE_SERVICE_ROLE_KEY`                                                                                           | Yes      | Bypasses RLS — server-only, never commit or expose                                                       |
| `PAYSTACK_SECRET_KEY`                                                                                                 | No       | Enables online payment                                                                                   |
| `SITE_URL` / `VITE_SITE_URL`                                                                                          | No       | Set both to your real domain in production; otherwise canonical URLs use the fallback domain               |
| `VITE_WHATSAPP_NUMBER`                                                                                                | No       | Falls back to an email link if unset                                                                     |
| `SENDGRID_API_KEY` + `NOTIFY_FROM_EMAIL` (+ `NOTIFY_FROM_NAME`, `NOTIFY_REPLY_TO`)                                    | No       | Order emails via SendGrid. Leave blank to send none                                                      |
| `NOTIFY_SMS_ENABLED` + `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + (`TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_FROM`) | No       | Order SMS via Twilio. Off by default — read "Customer notifications" first                               |

## Available scripts

```bash
npm run dev         # start the dev server
npm run build        # production build (also generates the Cloudflare deploy output)
npm run preview      # preview the production build locally
npm run typecheck    # tsc --noEmit
npm run lint          # eslint
npm run format        # prettier --write .
npm run db:seed       # demo data only; upserts starter products and FINKEL10
```

## Deploying

`npm run build` produces `.output/server/`, ready for Cloudflare Workers, including its own generated `wrangler.json` (already named after this project, with the Workers-assets binding for the static site pre-wired). Deploy with:

```bash
npx nitro deploy --prebuilt
```

This prompts for a Cloudflare login on first run. If you'd rather use Wrangler directly: `cd .output/server && npx wrangler deploy`.

Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SITE_URL` and (optionally)
`VITE_WHATSAPP_NUMBER` in the build environment before `npm run build`. They are baked into the
client bundle, so changing them requires another build; do not set them as Worker secrets.

Set server-side values such as `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` in the Cloudflare Worker settings. Use Worker secrets for credentials
and variables for non-sensitive configuration such as `SITE_URL`. The service-role key must stay
server-side and must never use a `VITE_` prefix. See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full
database migration and production setup sequence.

## Homepage hero (scroll-scrubbed film)

The homepage opens on a pinned, scroll-driven film of a bottle being picked up and poured
(`src/components/ScrollHero.tsx`). The section is ~3.4–3.8 viewports tall with a `sticky` child;
Framer Motion's `useScroll` turns that scroll distance into a 0→1 progress which sets the video's
`currentTime` and drives three copy "beats" (`BEATS` at the top of the file — copy, timing and
travel direction are all data there).

- **Footage**: `src/assets/hero/` — `hero-desktop.mp4` (1416×880), `hero-mobile.mp4` (960×596) and
  a `.webp` poster for each. Imported with Vite's `?url`, so they are content-hashed and cached.
- **Swapping the clip**: `bash scripts/encode-hero.sh <new-clip.mp4> src/assets/hero [W:H:X:Y]`.
  The optional third argument is the real picture area (crop out any baked-in black bars; the
  default is for the current clip). The script exists because scrubbing needs a keyframe every few
  frames, no B-frames, no audio and no repeated frames — a normal web export stutters.
- **Fallbacks**: reduced-motion, Save-Data/2G, a failed or undecodable video, or one that never
  produces a frame all collapse the hero to one static screen (poster + headline + CTA), so it
  never becomes dead scroll.
- **Navbar**: a page that opens on a dark hero marks it `data-dark-hero`; the Navbar then keeps a
  transparent light-on-dark style while it is behind the header (`.nav-on-dark` in `styles.css`)
  and switches to the glass pill once it has mostly scrolled away.
- **Placeholder footage**: the current clip is a free mockup. The bottle label reads "RED LABEL /
  MF" and carries a mockupfree.net watermark printed _on the label_, so it cannot be cropped out.
  Replace it with footage that has a blank or Finkel-branded label before launch, and check the
  clip's licence terms in the meantime.

## Delivery hand-off (Glovo and other couriers)

Admin → Orders → expand an order → **Delivery & courier**. It gives you:

1. a plain-text **dispatch sheet** (pick-up, drop-off, parcel notes, and whether to collect cash) with
   **Copy**, **Send via WhatsApp** and an **Open [courier]** button buttons — paste it into Glovo, Kwik or your
   rider's chat;
2. a place to record **who has the parcel**: courier, their booking ID, a tracking link, the rider's name
   and phone. **Hand off & mark out for delivery** saves it, moves the order to _shipped_ and sends the
   customer the "on its way" message with the tracking link and rider details.

Booking the courier still happens in their own app. There is no courier API call: Glovo offers a
business API, but it needs a Glovo Business account and credentials, and its docs weren't available to
build against, so nothing here guesses at it. When you have access, the integration point is
`handOffOrder` in `src/lib/actions/delivery.ts` — call the courier after saving and store its order id
in `courier_reference`. The couriers listed are in `src/lib/courier.ts`.

Check each courier's rules for **alcohol deliveries** and hand-over age checks; the dispatch sheet tells
the rider to hand over to adults (18+) only.

## Customer notifications (email and SMS)

| Event                        | When it's sent                                               |
| ---------------------------- | ------------------------------------------------------------ |
| Order received               | A pay-on-delivery order is placed                            |
| Payment received             | A Paystack payment is confirmed (webhook or return page)     |
| Out for delivery / Delivered | An admin changes the order status (or hands it to a courier) |
| Cancelled                    | An admin cancels the order                                   |

At checkout the customer sees an **Order updates** block: email (ticked — it's about their order, never
marketing) and, only when SMS is enabled, an opt-in for text updates. Their choice is stored on the order
(`notify_email`, `notify_sms`, `notify_consent_at`). Every send is recorded in `notification_log` and shown
under the order in admin, with a **Resend** button for failures. The unique key
`(order, event, channel)` makes sending idempotent — the Paystack webhook and the return page can both fire
for one payment and only the first sends.

**Email** goes through SendGrid (Twilio's email product): create an API key with _Mail Send_ permission,
verify your sender or authenticate your domain, then set `SENDGRID_API_KEY` and `NOTIFY_FROM_EMAIL`.

**SMS** goes through Twilio Programmable Messaging and is **off by default** (`NOTIFY_SMS_ENABLED=false`),
for a reason you must read first: Twilio's own Nigeria SMS guidelines list **alcohol-related content as
strictly prohibited** and require a **pre-registered alphanumeric sender ID**. A wine retailer's order texts
may therefore be blocked, or put the account at risk. Ask Twilio support, in writing, whether your account
may send transactional order messages for a licensed alcohol retailer in Nigeria — and register a sender ID —
before setting `NOTIFY_SMS_ENABLED=true` and the `TWILIO_*` variables. If Twilio says no, the SMS channel
(`sendSms` in `src/lib/actions/notify-server.ts`) is the only thing to swap for a Nigerian SMS provider whose
terms allow it. Until it's enabled, checkout doesn't offer text updates at all.

Not built: delivery-status webhooks from Twilio/SendGrid, automatic retries (use **Resend**), WhatsApp, and
marketing messages. Pre-ticking the email box and the wording of the consent are judgement calls under
Nigeria's data-protection law — have them checked, and make sure your privacy policy mentions these messages.

## Wine Guide (blog)

`/blog` and `/blog/<slug>` are served from typed content in `src/content/blog/` — no database, no Markdown
parser, nothing injected as HTML. To add an article: create a file in `src/content/blog/posts/` (copy an
existing one), then register it in `src/content/blog/index.ts` (the order there is the order shown; the first is
featured). Block types — paragraph, headings, lists, a numbered **steps** timeline, **facts** cards,
**callout**, and a **shop** link filtered to a wine style — are defined in `src/content/blog/types.ts`.
Articles are included in the sitemap automatically.

## Adding wines (catalog importer)

`scripts/import-catalog.mjs` loads a CSV as inactive, zero-stock **draft** products, with a dry-run preview
and a typed-host confirmation before any write. See `scripts/catalog/README.md` for the columns and the
checklist before publishing. The starter file's prices are market benchmarks, not your costs.

## Project structure

```
src/
  routes/                  File-based pages (TanStack Router)
  components/               Shared UI (Navbar, Footer, ProductCard, ...)
  assets/hero/                Homepage hero footage + posters (see "Homepage hero")
  content/blog/               Wine Guide articles (typed data — see "Wine Guide")
  lib/
    queries/                 TanStack Query hooks — reads/writes through
                              the RLS-protected Supabase client
    actions/                  Server functions — checkout, Paystack, admin
                              order cancellation, contact form, newsletter
                              signup. Anything here that needs elevated
                              (service-role) access, a real secret, or
                              server-side validation/rate limiting lives
                              here, never in queries/
    products.ts               Types + static reference taxonomy (brands,
                              leagues, curated club display info)
    store.ts                  Client-only state: cart & wishlist
    pricing.ts                 Shared pricing constants (shipping threshold,
                              customization fee, promo codes) — imported by
                              both the client cart preview and the server
                              checkout function, so they can't drift apart
  integrations/supabase/       Generated-style Supabase client + types
  server.ts                    Cloudflare Workers entry point; also routes
                              the Paystack webhook (see comment inside)
supabase/
  migrations/                  Schema, RLS policies, the two Postgres
                              functions used (atomic stock adjustment,
                              review-rating trigger), and the RLS tightening
                              from the security pass
scripts/
  seed.mjs, seed-data.mjs        Starter catalog
  encode-hero.sh                 Turns a clip into the scroll-scrub renditions + posters
  import-catalog.mjs, catalog/   Draft-catalog CSV importer + the starter file
```

**Why a mix of direct Supabase calls and server functions?** Row Level Security already enforces "customers can read active products, only admins can write products, users can only edit their own reviews," etc. — so most of `src/lib/queries/` just calls Supabase directly from the browser and lets Postgres enforce the rules. `src/lib/actions/` is for the parts that don't fit that model: checkout and Paystack (a client-submitted price, a non-atomic stock check, or a secret key can't be trusted to the browser), plus anything that needs real runtime input validation or rate limiting rather than just an RLS row-access rule — the contact form and newsletter signup moved here for exactly that reason; see the security pass notes above.

**One architecture note if you extend `src/lib/actions/`**: keep each file's _client-imported_ exports limited to `createServerFn(...)` results (plus types) — a plain helper function is fine to _import into_ one of these files (`getVerifiedUserId`, `checkRateLimit`, and the private `requireAdmin`/`isSameOriginCallback` helpers all do this safely), just don't _export_ one from the same file alongside a `createServerFn`. I found the failure mode the hard way, by inspecting the actual production bundle: a file mixing a `createServerFn` export with a plain function export (the Paystack webhook handler originally lived alongside `initializePaystackPayment`) prevented the bundler from stripping the server-only code for the client, and the service-role client construction logic ended up shipped to the browser. Not the secret value itself (it resolved to `undefined` client-side), but enough that I split the webhook handler into its own file (`paystack-webhook.ts`) that only `server.ts` imports. Every file in `src/lib/actions/` was re-verified clean against this specific failure mode after the security pass.

## Known limitations

- **Nothing in this project has ever run against a live Supabase project or a live Paystack account from any environment I've had access to.** Every pass has verified `tsc`, `eslint`, and a production `vite build` — including inspecting the actual client bundle to confirm no server secret leaks into it — but that's compile-time and bundle-level verification, not a runtime guarantee. Treat every feature as "implemented and code-reviewed," not "confirmed working," until you've actually run it. `DEPLOYMENT.md` has a full checklist for exactly this.
- **Paystack abandoned-checkout stock**: stock is reserved at order-creation time (before payment), for both payment methods. If a customer starts online checkout and abandons it without an explicit failure, that stock stays reserved rather than releasing automatically. A scheduled job to cancel stale unpaid Paystack orders (Cloudflare Cron Triggers would be the natural fit) would close this gap.
- **Product photos are placeholders** (Unsplash stock photography). Swap in real product photography before launch.
- **Prices are placeholders**, including the seeded customization fees (₦5,000/₦3,000 for name/number, ₦1,000–1,500 for starter patches) — review and adjust everything in `/admin/products`, `/admin/customization`, and `/admin/shipping` before launch.
- **No server-side pagination** on the shop page (fetches the full catalog, filters client-side) — fine at the current scale, worth revisiting if the catalog grows very large.
- **Homepage testimonials are still hardcoded placeholder quotes** (`src/routes/index.tsx`) — the review system itself is real and live, so once genuine reviews come in, that section is a natural thing to wire up to real data instead.
- **No automated tests.**
- Double-check the YouTube/Facebook links in `/admin/settings` — Instagram and X (Twitter) were directly confirmed; the other two follow the same handle by convention but weren't independently verified.
- A customer's reviews are detached (kept, de-identified) rather than deleted when they delete their account — see `adikastakes-customization-report.md` for the one open question on whether that's exactly the behavior wanted, or whether a frozen display name would be better than the generic fallback shown today.
- The admin nav still shows a "Soon" badge on Shipping/Returns/Settings in `src/components/admin/nav-config.ts` — stale; all three are complete. Harmless, just cosmetic — a three-line fix (`status: "soon"` removed from those entries) whenever convenient.

## Box packaging (buy by the box, at a discount)

A product can be bought by the single bottle **or by the box** (usually 6 bottles). The admin sets it when filling in the product; stock stays counted in **bottles**.

- **Admin → Products → Add/Edit:** the *Also sell by the box* section (ticked by default for new products) has **Bottles per box** (2–48, default 6) and **Box discount %** (percent off the price of those bottles; 0 = none). A live line shows what the box will cost. The product's **Price** stays the price of **one bottle**.
- **Box price** = `round(bottle price × bottles per box × (1 − discount ÷ 100))`, whole naira — defined once in `src/lib/box.ts` and used by the storefront, cart, coupons and checkout.
- **Product page:** a *Buy by the box* section explains that a box holds N bottles (N × size), shows the single-bottle price, the price of N single bottles, the discounted box price, the price per bottle inside the box and the saving, with a *Single bottle | Box of N* switch. Boxes are capped at `floor(stock ÷ N)`; if a size has fewer than N bottles the box option is disabled with a note.
- **Checkout (`placeOrder`):** the server reads `bottles_per_box` and `box_discount_percent` from the database, prices the line, and reserves `qty × N` bottles. Anything the browser says about box size or price is ignored. The coupon preview uses the same box price.
- **Orders:** `order_items.unit` (`bottle`/`box`) and `bottles_per_unit` snapshot what was bought (`qty` = boxes, `price` = per box). `cancel_order_atomic` restores `qty × bottles_per_unit` bottles, so editing a product's box size later never corrupts old orders. Returns are in whole units: a box is returned as a box, refunded at the box price.
- **Inventory page:** stock is bottles; products sold by the box also show "4 × 6 + 2 loose".
- **Inventory import (Admin → Inventory → Import):**
  - Choose **Replace** or **Adjust**, then whether the stock figure counts **bottles** or **boxes** (boxes × the product's bottles per box). The preview shows the conversion ("2 boxes × 6 = 12 bottles") and the resulting bottle stock.
  - The template includes **Bottles per Box** and **Box Discount %** columns, pre-filled from the current settings. Change them (or add them to your own file) to update box settings in bulk; `0` in *Bottles per Box* stops selling that product by the box. They belong to the whole product, so rows for several sizes of one product must agree.
  - A **blank cell means "leave alone"**: a blank stock cell no longer sets stock to zero, so a file can update box settings only. Box settings are applied in the same transaction as the stock changes — any failure rolls back everything.
  - Boxes can only be used for products that have a box size (already set, or given on that row).
- **Catalog importer script:** `bottles_per_box` (blank = 6, `0` = no box) and `box_discount_percent` columns — see `scripts/catalog/README.md`.
- Migrations: `20261021100000_carton_buying.sql` and `20261021110000_carton_price_reserve_rebrand_cleanup.sql` introduced a first, per-size "carton" version; `20261022100000_box_packaging.sql` replaces it with the product-level box model above (it carries any carton values forward, drops the old per-size columns, renames the order unit to `box` and extends `apply_inventory_import`). All three are idempotent. Together they also repair `cancel_order_atomic` (it still referenced the dropped `color` columns), restore `unique (product_id, size)` on `product_variants`, drop two superseded function overloads and update store defaults to Finkel Reserve.

## Product range

`products.wine_type` (column name kept for history) holds any product type, grouped in `src/lib/products.ts` as **Wines** (red, white, rosé, sparkling, dessert, fortified), **Whiskey & Spirits** (whiskey, cognac, gin, vodka, rum, tequila, liqueur) and **Fine Beverages** (beer, non-alcoholic, mixers). To add a type, add it to `ProductType` and `PRODUCT_TYPES` (and optionally a colour in `src/lib/placeholder.ts`) — no migration needed.
