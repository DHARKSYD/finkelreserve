-- Wine product model for Finkel Wines.
--
-- This is a brand-new business with no existing product data to preserve,
-- so this rewrites `products` and `product_variants` in place rather than
-- layering wine columns on top of apparel ones.
--
-- Dropped (no wine equivalent): products.club/league/sizes/colors/fit/
-- material/version; product_variants.color; order_items.color; the whole
-- jersey customization system (customization_types, customization_choices,
-- product_customization_types) and order_items.custom_name/custom_number/
-- custom_selections.
--
-- Added: products.producer/wine_type/region/country/grape_variety/vintage/
-- abv/tasting_notes/food_pairing.
--
-- Kept as-is (generic e-commerce, not apparel-specific): id, slug, name,
-- category is repurposed as wine_type below rather than duplicated,
-- description, details, highlights, images, price, old_price, cost_price,
-- stock, sku, low_stock_threshold, badge, featured, active, rating,
-- reviews_count, tags, seo_title, seo_description — and on
-- product_variants: id, product_id, size (repurposed as bottle size),
-- sku, stock, price_override, image.

-- ── products: drop apparel-only columns ──
-- (sizes is NOT here — see the rename below. Its concept, "which size
-- options this product comes in", applies to wine too as bottle sizes;
-- only colors/fit/material/club/league/version have no wine equivalent.)
alter table public.products
  drop column if exists club,
  drop column if exists league,
  drop column if exists colors,
  drop column if exists fit,
  drop column if exists material,
  drop column if exists version;

-- ── products: sizes (apparel: S/M/L/XL) -> bottle_sizes (wine: 375ml/
-- 750ml/1.5L/3L). Renamed rather than reused as-is, unlike
-- product_variants.size below — at the top-level Product type this field
-- sits next to producer/wineType/region/vintage, where a bare "sizes"
-- reads as an unrelated leftover rather than an intentional wine field.
alter table public.products rename column sizes to bottle_sizes;

-- ── products: brand (closed nike/adidas/puma/umbro set, enforced only in
-- the TS layer — no DB CHECK existed to drop) becomes producer, free text ──
alter table public.products rename column brand to producer;

-- ── products: category was a closed jersey/streetwear/accessories/footwear
-- enum (TS-layer only). Wine's equivalent grouping is wine_type, so this
-- repoints the existing column rather than adding a parallel one.
alter table public.products rename column category to wine_type;
comment on column public.products.wine_type is
  'red | white | rose | sparkling | dessert | fortified — enforced in the app layer (see WINE_TYPES in src/lib/products.ts), matching how category worked before.';

-- ── products: new wine-specific columns ──
alter table public.products
  add column region text,
  add column country text,
  add column grape_variety text[] not null default '{}',
  add column vintage smallint,
  add column abv numeric(4,1),
  add column tasting_notes text,
  add column food_pairing text;

comment on column public.products.vintage is 'Harvest year; null means non-vintage (NV).';
comment on column public.products.abv is 'Alcohol by volume, percent — e.g. 13.5';

-- ── product_variants: bottle size replaces apparel size/color ──
alter table public.product_variants drop column if exists color;
comment on column public.product_variants.size is
  'Bottle size, e.g. 375ml / 750ml / 1.5L / 3L. Column kept (not renamed) — the stock/sku/price-override mechanics per variant are unchanged, only the values it holds change.';

-- ── order_items: drop jersey-only columns ──
alter table public.order_items
  drop column if exists color,
  drop column if exists custom_name,
  drop column if exists custom_number,
  drop column if exists custom_selections;
comment on column public.order_items.size is 'Bottle size at time of purchase, e.g. 750ml.';

-- ── drop the jersey customization system entirely ──
-- product_customization_types references both customization_types and
-- products, so it goes first.
drop table if exists public.product_customization_types cascade;
drop table if exists public.customization_choices cascade;
drop table if exists public.customization_types cascade;

-- ── returns: update_return_status checked custom_name/custom_number/
-- custom_selections (all dropped above) to gate customized-item returns
-- behind an explicit admin override. Wine has no customization concept, so
-- that check is now always-false dead logic — removing it here rather than
-- leaving a function that references three columns which no longer exist
-- (that would fail at call time, not just look stale).
--
-- Left in place deliberately: the customization_override column on
-- return_requests and the p_customization_override parameter below. They
-- become permanently-unused rather than exercised, which is a real
-- follow-up cleanup (drop the column, drop the parameter, remove the
-- override checkbox in admin.returns.tsx) — flagged, not done here, to
-- keep this migration scoped to "nothing references a dropped column"
-- rather than a second unrelated returns-system rewrite.
create or replace function public.update_return_status(
  p_return_id uuid,
  p_new_status text,
  p_actor_id uuid,
  p_admin_note text default null,
  p_customization_override boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
  v_order_id uuid;
  v_valid_next text[];
begin
  select status, order_id into v_current, v_order_id
  from public.return_requests where id = p_return_id for update;

  if v_current is null then
    raise exception 'Return request not found';
  end if;

  v_valid_next := case v_current
    when 'requested' then array['under_review', 'rejected']
    when 'under_review' then array['approved', 'rejected']
    when 'approved' then array['item_received', 'rejected']
    when 'item_received' then array['refund_initiated']
    when 'refund_initiated' then array['completed']
    else array[]::text[]
  end;

  if not (p_new_status = any(v_valid_next)) then
    raise exception 'Cannot move a return from % to %', v_current, p_new_status;
  end if;

  update public.return_requests
  set
    status = p_new_status,
    admin_note = coalesce(nullif(trim(p_admin_note), ''), admin_note)
  where id = p_return_id;

  perform public.log_admin_activity(
    'return_status_changed',
    'Return ' || left(p_return_id::text, 8) || ' moved from ' || v_current || ' to ' || p_new_status,
    'return', p_return_id,
    jsonb_build_object('order_id', v_order_id, 'from', v_current, 'to', p_new_status),
    p_actor_id
  );
end;
$$;

revoke execute on function public.update_return_status(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.update_return_status(uuid, text, uuid, text) to service_role;
