-- Finkel Reserve: carton_price, broader catalogue, rebrand defaults, overload cleanup.
-- Safe to run more than once.

-- ── 1. carton_price ────────────────────────────────────────────────────
-- Exact price (₦) of ONE whole carton of this size. Null = no special price:
-- the carton costs bottle price × bottles_per_carton. Set it lower to offer a
-- carton discount. Only meaningful when bottles_per_carton is set; checkout
-- ignores it otherwise.
alter table public.product_variants
  add column if not exists carton_price numeric(12, 2)
    check (carton_price is null or carton_price > 0);

comment on column public.product_variants.carton_price is
  'Price of one whole carton. Null = bottle price × bottles_per_carton. Ignored unless bottles_per_carton is set.';

-- ── 2. products.wine_type now holds any product type ───────────────────
-- Finkel Reserve sells wines, whiskeys and fine beverages. The column keeps its
-- name (renaming a live column risks every policy/view/import that names it);
-- only the documented value set widens. Still enforced in the app layer.
comment on column public.products.wine_type is
  'Product type — wine: red | white | rose | sparkling | dessert | fortified; spirits: whiskey | cognac | gin | vodka | rum | tequila | liqueur; beverages: beer | non_alcoholic | mixers. Enforced in the app layer (PRODUCT_TYPES in src/lib/products.ts). Column name is historical.';

-- ── 3. Rebrand store_settings: Finkel Wines → Finkel Reserve ───────────
-- Defaults for new installs, plus a one-time update of rows that still carry
-- the OLD DEFAULT text. Rows an admin has edited are left alone (the where
-- clauses match the old default exactly). support_email is NOT touched: it is
-- NOT NULL and there is no known Finkel Reserve address to default to — set it
-- in Admin → Settings.
alter table public.store_settings
  alter column store_name set default 'Finkel Reserve',
  alter column seo_title set default 'Finkel Reserve — Fine Wines, Whiskeys & Beverages, Curated for Nigeria',
  alter column seo_description set default 'Fine wines, whiskeys and premium beverages for Nigeria — curated bottles, trusted provenance, and unforgettable moments, delivered nationwide.';

update public.store_settings set store_name = 'Finkel Reserve' where store_name = 'Finkel Wines';
update public.store_settings
  set seo_title = 'Finkel Reserve — Fine Wines, Whiskeys & Beverages, Curated for Nigeria'
  where seo_title = 'Finkel Wines — Exceptional Wines, Curated for Nigeria';
update public.store_settings
  set seo_description = 'Fine wines, whiskeys and premium beverages for Nigeria — curated bottles, trusted provenance, and unforgettable moments, delivered nationwide.'
  where seo_description = 'Nigeria''s home for exceptional wine — curated bottles, trusted provenance, and unforgettable moments, delivered nationwide.';

-- ── 4. Drop superseded function overloads ──────────────────────────────
-- Later migrations added parameters, and because Postgres identifies a function
-- by name + argument types, `create or replace` made NEW functions instead of
-- replacing these. The app only calls the newest signatures with full named
-- params (src/lib/actions/returns.ts), so these are unreachable dead copies
-- that also made REVOKE/GRANT ambiguous. Exact signatures, never a bare name.
drop function if exists public.update_return_status(uuid, text, uuid, text);
drop function if exists public.request_return(uuid, uuid, text, text, jsonb);
