// Import a catalog CSV as DRAFT products — inactive and with zero stock, so
// nothing reaches the storefront until you review it in Admin → Products and
// switch it on.
//
// Usage:
//   node --env-file=.env scripts/import-catalog.mjs scripts/catalog/starter-catalog.csv            # validate + preview (writes nothing)
//   node --env-file=.env scripts/import-catalog.mjs scripts/catalog/starter-catalog.csv --commit   # create the drafts
//
// Safety, because this uses the service-role key (it bypasses RLS):
//   - dry-run is the default;
//   - --commit makes you type the database host back before anything is written,
//     so a .env pointing at the wrong Supabase project can't be hit by accident;
//   - existing products (same slug) are skipped, never overwritten;
//   - every row is validated first; any error aborts the whole import.
//
// CSV columns: see scripts/catalog/README.md. Needs SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY for --commit (the dry-run works without them but
// can't tell you which rows already exist).

import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { createClient } from "@supabase/supabase-js";

// Mirror PRODUCT_TYPES / BOTTLE_SIZES in src/lib/products.ts (this script is plain Node and
// can't import the app's TypeScript, so keep the two in step when you add a type or size).
// The CSV column is still called wine_type because that is the database column; it holds any
// product type — wines, whiskey & spirits, fine beverages.
const PRODUCT_TYPES = [
  // wines
  "red",
  "white",
  "rose",
  "sparkling",
  "dessert",
  "fortified",
  // whiskey & spirits
  "whiskey",
  "cognac",
  "gin",
  "vodka",
  "rum",
  "tequila",
  "liqueur",
  // fine beverages
  "beer",
  "non_alcoholic",
  "mixers",
];
const BOTTLE_SIZES = ["200ml", "375ml", "500ml", "700ml", "750ml", "1L", "1.5L", "3L"];
// Mirror the box limits in src/lib/box.ts and the products_* checks in the box migration.
const DEFAULT_BOTTLES_PER_BOX = 6;
const MIN_BOTTLES_PER_BOX = 2;
const MAX_BOTTLES_PER_BOX = 48;
// Mirrors products_profile_length in the migration.
const PROFILE_LIMITS = {
  appearance: 600,
  nose: 1200,
  palate: 1200,
  finish: 800,
  serving_notes: 1200,
  cellaring_notes: 1200,
  producer_notes: 2000,
  winemaking_notes: 2000,
};

// ---- args ---------------------------------------------------------------------------------
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const commit = args.includes("--commit");
if (!file) {
  console.error("Usage: node --env-file=.env scripts/import-catalog.mjs <catalog.csv> [--commit]");
  process.exit(1);
}

// ---- minimal RFC 4180 CSV parser (quotes, escaped quotes, embedded commas/newlines) --------
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.some((v) => v.trim() !== "")) rows.push(row);
  }
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

const slugify = (s) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const list = (s, sep = ";") =>
  s
    .split(sep)
    .map((v) => v.trim())
    .filter(Boolean);

// ---- validate + map -------------------------------------------------------------------------
const thisYear = new Date().getFullYear();

const COLUMNS = [
  "name",
  "producer",
  "wine_type",
  "country",
  "region",
  "grape_variety",
  "vintage",
  "abv",
  "bottle_size",
  "price_ngn",
  "bottles_per_box",
  "box_discount_percent",
  "description",
  "details",
  "tasting_notes",
  "food_pairing",
  "appearance",
  "nose",
  "palate",
  "finish",
  "serving_notes",
  "cellaring_notes",
  "producer_notes",
  "winemaking_notes",
  "highlights",
  "tags",
  "image_urls",
  "benchmark_source",
  "review_notes",
];

function toProduct(input, line) {
  // Every known column defaults to "", so a CSV may leave out any optional column entirely.
  const raw = Object.fromEntries(COLUMNS.map((c) => [c, (input[c] ?? "").trim()]));
  const errors = [];
  const need = (k) => {
    if (!raw[k]) errors.push(`${k} is required`);
  };
  ["name", "producer", "wine_type", "bottle_size", "price_ngn", "description"].forEach(need);

  if (raw.wine_type && !PRODUCT_TYPES.includes(raw.wine_type))
    errors.push(`wine_type must be one of ${PRODUCT_TYPES.join(", ")} (got "${raw.wine_type}")`);
  if (raw.bottle_size && !BOTTLE_SIZES.includes(raw.bottle_size))
    errors.push(`bottle_size must be one of ${BOTTLE_SIZES.join(", ")} (got "${raw.bottle_size}")`);

  const price = Number(raw.price_ngn);
  if (raw.price_ngn && (!Number.isFinite(price) || price <= 0 || !Number.isInteger(price)))
    errors.push(`price_ngn must be a whole number of naira above 0 (got "${raw.price_ngn}")`);

  // Box packaging, same defaults as the product form: blank = a box of 6 with no discount;
  // bottles_per_box 0 = not sold by the box; box_discount_percent is % off those bottles.
  let bottlesPerBox = DEFAULT_BOTTLES_PER_BOX;
  if (raw.bottles_per_box !== "") {
    const n = Number(raw.bottles_per_box);
    if (n === 0) bottlesPerBox = null;
    else if (!Number.isInteger(n) || n < MIN_BOTTLES_PER_BOX || n > MAX_BOTTLES_PER_BOX)
      errors.push(
        `bottles_per_box must be a whole number from ${MIN_BOTTLES_PER_BOX} to ${MAX_BOTTLES_PER_BOX}, or 0 for not sold by the box (got "${raw.bottles_per_box}")`,
      );
    else bottlesPerBox = n;
  }
  let boxDiscount = 0;
  if (raw.box_discount_percent !== "") {
    boxDiscount = Number(raw.box_discount_percent.replace(/\s*%$/, ""));
    if (!Number.isFinite(boxDiscount) || boxDiscount < 0 || boxDiscount >= 100)
      errors.push(
        `box_discount_percent must be a number from 0 up to (not including) 100 — 10 means ten percent (got "${raw.box_discount_percent}")`,
      );
  }

  let vintage = null;
  if (raw.vintage) {
    vintage = Number(raw.vintage);
    if (!Number.isInteger(vintage) || vintage < 1900 || vintage > thisYear)
      errors.push(
        `vintage must be a year between 1900 and ${thisYear} (leave blank for non-vintage)`,
      );
  }
  let abv = null;
  if (raw.abv) {
    abv = Number(raw.abv);
    if (!Number.isFinite(abv) || abv <= 0 || abv > 80)
      errors.push(`abv must be a percentage above 0 and up to 80 (got "${raw.abv}")`);
  }
  for (const [k, max] of Object.entries(PROFILE_LIMITS)) {
    if (raw[k] && raw[k].length > max)
      errors.push(`${k} is ${raw[k].length} characters (max ${max})`);
  }
  const images = list(raw.image_urls, "|");
  for (const url of images)
    if (!/^https:\/\/\S+$/i.test(url))
      errors.push(`image URL must start with https:// (got "${url}")`);

  const slug = slugify(
    `${raw.name}${vintage && !raw.name.includes(String(vintage)) ? ` ${vintage}` : ""}`,
  );
  if (!slug) errors.push("could not make a slug from the name");

  const warnings = [];
  if (!images.length)
    warnings.push("no image — the site shows a placeholder bottle until you add a photo");
  if (!raw.abv) warnings.push("no ABV — fill it in from the label");
  if (raw.review_notes) warnings.push(raw.review_notes);

  return {
    line,
    errors,
    warnings,
    benchmark: raw.benchmark_source || "",
    row: {
      slug,
      name: raw.name,
      description: raw.description,
      details: raw.details || null,
      price,
      bottles_per_box: bottlesPerBox,
      box_discount_percent: boxDiscount,
      old_price: null,
      producer: raw.producer,
      wine_type: raw.wine_type,
      region: raw.region || null,
      country: raw.country || null,
      grape_variety: list(raw.grape_variety),
      vintage,
      abv,
      tasting_notes: raw.tasting_notes || null,
      food_pairing: raw.food_pairing || null,
      appearance: raw.appearance || null,
      nose: raw.nose || null,
      palate: raw.palate || null,
      finish: raw.finish || null,
      serving_notes: raw.serving_notes || null,
      cellaring_notes: raw.cellaring_notes || null,
      producer_notes: raw.producer_notes || null,
      winemaking_notes: raw.winemaking_notes || null,
      images,
      bottle_sizes: raw.bottle_size ? [raw.bottle_size] : [],
      highlights: list(raw.highlights),
      tags: list(raw.tags),
      // Drafts: invisible to customers and not buyable until you decide otherwise.
      stock: 0,
      active: false,
    },
  };
}

const parsed = parseCsv(readFileSync(file, "utf8"));
const unknownColumns = Object.keys(parsed[0] ?? {}).filter((c) => !COLUMNS.includes(c));
if (unknownColumns.length)
  console.warn(`Ignoring unknown column(s): ${unknownColumns.join(", ")} — check for typos.`);
const records = parsed.map((r, i) => toProduct(r, i + 2));

// duplicate slugs inside the file itself
const seen = new Map();
for (const r of records) {
  if (seen.has(r.row.slug))
    r.errors.push(`duplicate of line ${seen.get(r.row.slug)} (same slug "${r.row.slug}")`);
  else seen.set(r.row.slug, r.line);
}

// ---- preview ----------------------------------------------------------------------------------
const money = (n) => (Number.isFinite(n) ? `₦${n.toLocaleString("en-NG")}` : "—");
console.log(`\n${file}: ${records.length} row(s)\n`);
for (const r of records) {
  const mark = r.errors.length ? "✗" : "✓";
  console.log(
    `${mark} line ${String(r.line).padStart(2)}  ${r.row.name}  [${r.row.wine_type || "?"}, ${r.row.bottle_sizes[0] || "?"}, ${money(r.row.price)}, ${
      r.row.bottles_per_box
        ? `box of ${r.row.bottles_per_box}${r.row.box_discount_percent ? ` −${r.row.box_discount_percent}%` : ""}`
        : "no box"
    }]`,
  );
  for (const e of r.errors) console.log(`      ERROR   ${e}`);
  for (const w of r.warnings) console.log(`      note    ${w}`);
  if (r.benchmark) console.log(`      source  ${r.benchmark}`);
}

const bad = records.filter((r) => r.errors.length);
if (bad.length) {
  console.error(
    `\n${bad.length} row(s) have errors — nothing was imported. Fix the CSV and run again.`,
  );
  process.exit(1);
}

// ---- database ----------------------------------------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  if (commit) {
    console.error(
      "\nMissing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — run with:  node --env-file=.env scripts/import-catalog.mjs <file> --commit",
    );
    process.exit(1);
  }
  console.log(
    "\nDry run only (no database credentials loaded, so existing products weren't checked). Nothing written.",
  );
  process.exit(0);
}

const host = new URL(SUPABASE_URL).host;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: existing, error: existingError } = await supabase
  .from("products")
  .select("slug")
  .in(
    "slug",
    records.map((r) => r.row.slug),
  );
if (existingError) {
  console.error(
    "\nCould not read the products table:",
    existingError.message,
    "\nHave the migrations in supabase/migrations/ been run on this database?",
  );
  process.exit(1);
}
const taken = new Set((existing ?? []).map((p) => p.slug));
const fresh = records.filter((r) => !taken.has(r.row.slug));
console.log(`\nDatabase: ${host}`);
console.log(
  `${fresh.length} new draft(s) to create, ${records.length - fresh.length} already exist and will be skipped.`,
);

if (!commit) {
  console.log("\nDry run only. Nothing written. Add --commit to create the drafts.");
  process.exit(0);
}
if (!fresh.length) {
  console.log("Nothing to do.");
  process.exit(0);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = (
  await rl.question(`\nThis will write to ${host}. Type that host exactly to continue: `)
).trim();
rl.close();
if (answer !== host) {
  console.error("Host didn't match — nothing written.");
  process.exit(1);
}

const { data: inserted, error } = await supabase
  .from("products")
  .insert(fresh.map((r) => r.row))
  .select("slug");
if (error) {
  console.error("Import failed:", error.message);
  process.exit(1);
}
console.log(`\nDone — created ${inserted.length} inactive draft(s):`);
for (const p of inserted) console.log(`  /product/${p.slug}`);
console.log(
  "\nNext: Admin → Products → open each draft, add a photo, check price and stock, then switch it on.",
);
