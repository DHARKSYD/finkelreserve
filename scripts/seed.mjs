// Populates the products table with a starter catalog. Safe to re-run —
// it upserts on slug, so editing scripts/seed-data.mjs and running this
// again just updates existing rows instead of duplicating them.
//
// Usage:
//   node --env-file=.env scripts/seed.mjs
//
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env (the
// service role key bypasses RLS, which is what lets this script write
// products without an admin login — see README.md).

import { createClient } from "@supabase/supabase-js";
import { SEED_PRODUCTS } from "./seed-data.mjs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Run this with your .env loaded, e.g.:\n" +
      "  node --env-file=.env scripts/seed.mjs\n" +
      "(Node 20.6+ required for --env-file. See README.md for where to find these values.)",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const rows = SEED_PRODUCTS.map(({ daysAgo, ...p }) => ({
  ...p,
  created_at: new Date(Date.now() - daysAgo * 86400000).toISOString(),
}));

console.log(`Seeding ${rows.length} products…`);

const { data, error } = await supabase
  .from("products")
  .upsert(rows, { onConflict: "slug" })
  .select("slug");

if (error) {
  console.error("Seed failed:", error.message);
  console.error("Did you run the migrations in supabase/migrations/ first?");
  process.exit(1);
}

console.log(`Done — ${data.length} products upserted.`);

// The homepage's hero banner and newsletter CTA advertise "10% off your
// first order with code FINKEL10" (src/routes/index.tsx) — this pattern
// (advertise a code, seed it here so it actually works at checkout) is
// carried over from the adikastakes project this was built on, which used
// ADIKA10 the same way. Edit or deactivate it from Admin → Promotions like
// any other coupon.
const { error: couponError } = await supabase.from("coupons").upsert(
  {
    code: "FINKEL10",
    type: "percentage",
    value: 10,
    first_order_only: true,
    active: true,
  },
  { onConflict: "code" },
);

if (couponError) {
  console.error("Coupon seed failed:", couponError.message);
  console.error("Did you run the 20260814150000_coupons.sql migration?");
  process.exit(1);
}

console.log("Done — FINKEL10 coupon upserted (10% off, first order only).");
