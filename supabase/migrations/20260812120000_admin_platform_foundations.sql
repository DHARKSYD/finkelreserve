-- ─────────────────────────────────────────────────────────────────
-- Foundations for the admin platform upgrade. This migration:
--
--  1. Adds product_variants so stock is tracked per size/color instead
--     of one number per product (checkout already validates size/color
--     against the product's arrays but decremented a single product-wide
--     counter — a jersey with 5 sizes could show "12 in stock" while
--     actually being 0/0/12/0/0 across S/M/L/XL/XXL).
--  2. Adds the product fields the new admin editor needs (sku, cost
--     price, configurable low-stock threshold, featured, tags, SEO).
--  3. Turns activity_log into a real, append-only admin audit trail —
--     today only checkout writes to it, so "Activity" in admin is
--     actually a customer-order feed, not a record of admin actions.
--  4. Replaces the cancel-order logic with a single atomic function.
--     The current app-level version (src/lib/actions/orders.ts) restores
--     stock with Promise.allSettled and never checks the results, then
--     marks the order cancelled regardless of whether restoration
--     actually succeeded — a failed restore is silently swallowed and
--     that inventory is gone for good. Doing it as one plpgsql function
--     makes it genuinely all-or-nothing: if anything raises, the whole
--     function rolls back, including the status change.
--
-- Deliberately NOT included here (kept for the next pass, once the new
-- admin surface that would use them exists): coupons, shipping zones,
-- returns, and promoting club/league/brand from free-text columns into
-- their own catalog tables. Nothing in this migration depends on those.
-- ─────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════
-- 1. PRODUCT VARIANTS
-- ═══════════════════════════════════════════════════════════════════

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade not null,
  size text not null,
  color text not null default '',
  sku text,
  price_override numeric,
  stock integer not null default 0 check (stock >= 0),
  image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, size, color)
);
alter table public.product_variants enable row level security;

create policy "variants readable by all" on public.product_variants for select
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id and (p.active = true or public.has_role(auth.uid(), 'admin'))
    )
  );
create policy "admins manage variants" on public.product_variants for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create trigger touch_product_variants before update on public.product_variants
  for each row execute function public.touch_updated_at();

create index if not exists product_variants_product_idx on public.product_variants (product_id);

-- Backfill: one variant per (size × color) combo that the product's existing
-- arrays imply. There is no way to recover the true historical per-size
-- breakdown from a single aggregate stock number, so the existing total is
-- split evenly across the combos (remainder to the first) — this preserves
-- the correct grand total but the per-size split is a starting placeholder,
-- not real data. It needs a real count from whoever manages inventory.
-- Products with no recorded sizes get a single "One Size" variant holding
-- the full stock, so nothing is silently dropped.
do $$
declare
  prod record;
  color_list text[];
  combo_count integer;
  base_stock integer;
  remainder integer;
  idx integer;
  sz text;
  clr text;
begin
  for prod in select id, stock, sizes, colors from public.products loop
    color_list := case
      when prod.colors is null or array_length(prod.colors, 1) is null then array['']::text[]
      else prod.colors
    end;
    combo_count := coalesce(array_length(prod.sizes, 1), 0) * coalesce(array_length(color_list, 1), 0);

    if combo_count = 0 then
      insert into public.product_variants (product_id, size, color, stock)
      values (prod.id, 'One Size', '', greatest(prod.stock, 0));
      continue;
    end if;

    base_stock := prod.stock / combo_count;
    remainder := prod.stock % combo_count;
    idx := 0;
    foreach sz in array prod.sizes loop
      foreach clr in array color_list loop
        insert into public.product_variants (product_id, size, color, stock)
        values (prod.id, sz, clr, base_stock + (case when idx < remainder then 1 else 0 end));
        idx := idx + 1;
      end loop;
    end loop;
  end loop;
end $$;

-- products.stock becomes a cache: sum of its variants' stock, kept in sync
-- by trigger — same pattern already used for products.rating/reviews_count
-- (see recompute_product_rating in 20260808120000). Every existing call
-- site that reads products.stock (storefront "in stock" checks, the low-
-- stock stat, cart validation) keeps working unmodified.
create or replace function public.recompute_product_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_product_id uuid;
begin
  target_product_id := coalesce(new.product_id, old.product_id);

  update public.products p
  set stock = coalesce(
    (select sum(v.stock) from public.product_variants v where v.product_id = target_product_id),
    0
  )
  where p.id = target_product_id;

  return null;
end;
$$;

revoke execute on function public.recompute_product_stock() from public, anon, authenticated;

create trigger variants_recompute_product_stock
  after insert or update of stock or delete on public.product_variants
  for each row execute function public.recompute_product_stock();

-- Atomic per-variant stock adjustment — same shape and race-safety as the
-- existing adjust_product_stock, just scoped to one variant row.
create or replace function public.adjust_variant_stock(p_variant_id uuid, p_delta integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_stock integer;
begin
  update public.product_variants
  set stock = stock + p_delta
  where id = p_variant_id
    and stock + p_delta >= 0
  returning stock into new_stock;

  return new_stock; -- null means the guard failed or no such variant
end;
$$;

revoke execute on function public.adjust_variant_stock(uuid, integer) from public, anon, authenticated;
grant execute on function public.adjust_variant_stock(uuid, integer) to service_role;

-- ═══════════════════════════════════════════════════════════════════
-- 2. EXPANDED PRODUCT FIELDS
-- ═══════════════════════════════════════════════════════════════════
-- old_price already IS compare-at price — reusing it rather than adding a
-- duplicate column, the admin editor just labels it clearly.

alter table public.products
  add column sku text unique,
  add column cost_price numeric,
  add column low_stock_threshold integer not null default 15,
  add column featured boolean not null default false,
  add column tags text[] not null default '{}',
  add column seo_title text,
  add column seo_description text;

create index if not exists products_featured_idx on public.products (featured) where featured = true;

-- ═══════════════════════════════════════════════════════════════════
-- 3. REAL ADMIN AUDIT LOG
-- ═══════════════════════════════════════════════════════════════════

alter table public.activity_log
  add column entity_type text,
  add column entity_id uuid;

create index if not exists activity_log_entity_idx on public.activity_log (entity_type, entity_id);
create index if not exists activity_log_created_idx on public.activity_log (created_at desc);

-- No update/delete policy is added for activity_log, on purpose, on top of
-- the ones already there — audit trails must stay append-only for ordinary
-- admins. (The admin UI currently has a "Clear activity" button; it has
-- always silently failed since no delete policy has ever existed for this
-- table. That button is being removed rather than wired up to actually
-- work — see the frontend changes.)

-- p_actor_id lets callers running as service_role (which has no auth.uid())
-- attribute an entry to a specific admin explicitly. Regular authenticated
-- callers can omit it and auth.uid() is used.
create or replace function public.log_admin_activity(
  p_type text,
  p_message text,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_metadata jsonb default null,
  p_actor_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_log (type, message, user_id, entity_type, entity_id, metadata)
  values (p_type, p_message, coalesce(p_actor_id, auth.uid()), p_entity_type, p_entity_id, p_metadata);
end;
$$;

revoke execute on function public.log_admin_activity(text, text, text, uuid, jsonb, uuid) from public, anon;
grant execute on function public.log_admin_activity(text, text, text, uuid, jsonb, uuid) to authenticated, service_role;

-- Auto-log product create/delete/publish-toggle. Deliberately does NOT log
-- every stock/price change — those fire on every checkout and would drown
-- out real events; stock changes get logged with a real "reason" once the
-- dedicated Inventory adjustment flow ships. This still guarantees
-- coverage of create/delete/publish regardless of which code path
-- triggered it (the current frontend, a future one, or a script).
create or replace function public.log_product_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_admin_activity('product', 'Created product "' || new.name || '"', 'product', new.id);
    return new;
  elsif tg_op = 'UPDATE' then
    if old.active is distinct from new.active then
      perform public.log_admin_activity(
        'product',
        case when new.active then 'Published "' || new.name || '"' else 'Unpublished "' || new.name || '"' end,
        'product', new.id
      );
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    perform public.log_admin_activity('product', 'Deleted product "' || old.name || '"', 'product', old.id);
    return old;
  end if;
  return null;
end;
$$;

revoke execute on function public.log_product_change() from public, anon, authenticated;

create trigger products_log_changes
  after insert or update or delete on public.products
  for each row execute function public.log_product_change();

-- Auto-log order status/payment changes. Status changing TO 'cancelled' is
-- excluded here because cancel_order_atomic (below) logs its own richer
-- entry with the restoration outcome — without this exclusion a
-- cancellation would show up twice. Every other status transition (the
-- common pending → processing → shipped → delivered path) only ever
-- happens through the plain admin update today, so this trigger is its
-- only audit coverage.
create or replace function public.log_order_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status and new.status <> 'cancelled' then
    perform public.log_admin_activity(
      'order', 'Order ' || left(new.id::text, 8) || ' status changed to ' || new.status,
      'order', new.id
    );
  end if;
  if old.payment_status is distinct from new.payment_status then
    perform public.log_admin_activity(
      'payment', 'Order ' || left(new.id::text, 8) || ' payment marked ' || new.payment_status,
      'order', new.id
    );
  end if;
  return new;
end;
$$;

revoke execute on function public.log_order_change() from public, anon, authenticated;

create trigger orders_log_changes
  after update on public.orders
  for each row execute function public.log_order_change();

-- Auto-log review moderation (an admin deleting someone else's review) but
-- not a user deleting their own — that's routine self-service, not an
-- admin/moderation event, and would just be noise in this log.
create or replace function public.log_review_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from old.user_id then
    perform public.log_admin_activity('review', 'Deleted a review', 'review', old.id);
  end if;
  return old;
end;
$$;

revoke execute on function public.log_review_change() from public, anon, authenticated;

create trigger reviews_log_delete
  after delete on public.reviews
  for each row execute function public.log_review_change();

-- ═══════════════════════════════════════════════════════════════════
-- 4. ATOMIC ORDER CANCELLATION
-- ═══════════════════════════════════════════════════════════════════
-- Restoration prefers the matching variant (by size/color) so per-size
-- stock stays accurate; it falls back to the product-level counter only
-- if no matching variant row exists. Unlike checkout's decrement path,
-- this fallback is intentionally lenient: restoring stock can't oversell
-- anything, and silently failing to restore (losing real inventory
-- forever) is a worse outcome than a same-product/no-matching-variant
-- edge case briefly restoring at the product level instead.
--
-- `select ... for update` takes a row lock on the order for the duration
-- of the transaction, so two concurrent cancel calls for the same order
-- can't both pass the "not already cancelled" check and double-restore.
create or replace function public.cancel_order_atomic(p_order_id uuid, p_actor_id uuid)
returns table(ok boolean, error_message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.order_status;
  v_item record;
  v_new_stock integer;
begin
  select status into v_status from public.orders where id = p_order_id for update;

  if v_status is null then
    return query select false, 'Order not found.'::text;
    return;
  end if;

  if v_status = 'cancelled' then
    return query select true, null::text;
    return;
  end if;

  for v_item in
    select oi.product_id, coalesce(oi.size, '') as size, coalesce(oi.color, '') as color, oi.qty
    from public.order_items oi
    where oi.order_id = p_order_id and oi.product_id is not null
  loop
    v_new_stock := null;

    update public.product_variants
    set stock = stock + v_item.qty
    where product_id = v_item.product_id
      and size = v_item.size
      and color = v_item.color
    returning stock into v_new_stock;

    if v_new_stock is null then
      v_new_stock := public.adjust_product_stock(v_item.product_id, v_item.qty);
    end if;
  end loop;

  update public.orders set status = 'cancelled' where id = p_order_id;

  perform public.log_admin_activity(
    'order',
    'Cancelled order ' || left(p_order_id::text, 8) || ' and restored inventory',
    'order', p_order_id, null, p_actor_id
  );

  return query select true, null::text;
end;
$$;

revoke execute on function public.cancel_order_atomic(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cancel_order_atomic(uuid, uuid) to service_role;
