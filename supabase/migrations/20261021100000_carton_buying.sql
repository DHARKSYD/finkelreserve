-- Carton (case) buying.
--
-- Model: stock stays counted in BOTTLES, always (product_variants.stock).
-- A carton is just a way of buying N bottles at once:
--   * product_variants.bottles_per_carton  — null = this size isn't sold by the
--     carton; otherwise how many bottles one carton holds (usually 6 or 12).
--     It lives on the variant, not the product, because a 375ml carton, a
--     750ml carton and a 1.5L carton don't hold the same number of bottles.
--   * order_items.unit / bottles_per_unit — a SNAPSHOT of what was bought.
--     qty = number of units (cartons), price = price per unit (carton), and
--     bottles_per_unit says how many bottles each unit consumed from stock.
--     Snapshotting matters: the admin can change a carton size later without
--     rewriting history, and cancel/restock must restore what was taken then.
--
-- Safe to run more than once.

alter table public.product_variants
  add column if not exists bottles_per_carton integer
    check (bottles_per_carton is null or bottles_per_carton between 2 and 48);

comment on column public.product_variants.bottles_per_carton is
  'Bottles in one carton of this size. Null = not sold by the carton. Stock is always counted in bottles.';

alter table public.order_items
  add column if not exists unit text not null default 'bottle'
    check (unit in ('bottle', 'carton')),
  add column if not exists bottles_per_unit integer not null default 1
    check (bottles_per_unit >= 1);

comment on column public.order_items.unit is 'What qty counts: bottle or carton. Snapshot at purchase.';
comment on column public.order_items.bottles_per_unit is
  'Bottles taken from stock per unit of qty (1 for bottles, N for a carton of N). Snapshot at purchase.';

-- ── Repair 1: one variant row per (product, size) ──────────────────────
-- The original constraint was unique (product_id, size, color). Dropping the
-- color column in 20260826090000 drops that multi-column constraint with it
-- (Postgres drops table constraints that involve a dropped column), and
-- nothing re-added uniqueness on (product_id, size). Checkout and cancel both
-- resolve a variant by (product_id, size), so two rows for one size would make
-- stock handling ambiguous. If duplicates already exist we skip and say so
-- rather than fail the whole migration — merge them by hand, then re-run.
do $$
begin
  if exists (
    select 1 from public.product_variants group by product_id, size having count(*) > 1
  ) then
    raise notice 'product_variants has duplicate (product_id, size) rows — unique index NOT created. Merge them and re-run this migration.';
  else
    create unique index if not exists product_variants_product_size_key
      on public.product_variants (product_id, size);
  end if;
end $$;

-- ── Repair 2 + carton support: cancel_order_atomic ─────────────────────
-- The 20260812 version selected oi.color and matched product_variants.color.
-- Both columns were dropped by the wine migration, and plpgsql only resolves
-- columns when the function runs — so every cancellation would have failed
-- with "column does not exist". Rewritten without color, and restoring
-- qty * bottles_per_unit bottles (a cancelled carton order puts N bottles
-- back per carton, not 1). Same signature, so grants are unchanged; they are
-- restated anyway so this file is self-contained.
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
  -- Row lock: two concurrent cancels can't both pass the check and double-restore.
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
    select oi.product_id,
           coalesce(oi.size, '') as size,
           oi.qty * oi.bottles_per_unit as bottles
    from public.order_items oi
    where oi.order_id = p_order_id and oi.product_id is not null
  loop
    v_new_stock := null;

    update public.product_variants
    set stock = stock + v_item.bottles
    where product_id = v_item.product_id
      and size = v_item.size
    returning stock into v_new_stock;

    -- No matching variant (size removed since, or a product that never had
    -- variants): restore at the product level rather than lose the stock.
    if v_new_stock is null then
      v_new_stock := public.adjust_product_stock(v_item.product_id, v_item.bottles);
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
