-- ─────────────────────────────────────────────────────────────────
-- Inventory movements + import. This migration:
--
--  1. Adds inventory_movements — an append-only ledger for the two
--     admin-initiated ways stock changes today: a manual correction on
--     the Products page, or a bulk Excel/CSV import. It deliberately does
--     NOT also log every checkout decrement/cancel restore — those are
--     already correct and tested (see adjust_variant_stock and
--     cancel_order_atomic), happen at high frequency, and product_variants
--     already carries an updated_at (touch_product_variants trigger) that
--     answers "when did this last change" without a ledger row per sale.
--     Widening this to a full sale-by-sale ledger is a bigger, separate
--     change — not something to fold into this one silently.
--  2. Closes a real gap: ProductVariantsEditor's manual stock edits
--     (useUpdateVariantStock) currently write straight to product_variants
--     from the browser with no history and no audit entry — the previous
--     migration's own comment flagged this as deliberately deferred until
--     this flow shipped. set_variant_stock below is that flow; the
--     frontend change point-updates one call site (variants.ts) and the
--     editor's UI/props are unchanged.
--  3. Adds apply_inventory_import for the Excel/CSV import — same
--     row-lock-then-apply-atomically shape as cancel_order_atomic, so a
--     partial failure can't leave some variants updated and others not.
--  4. Makes product_variants.sku actually unique. It's the field this
--     whole import is keyed on (see David's spec: "SKU should be the
--     primary identifier, not the product name"), but the previous
--     migration added it without a uniqueness constraint — unlike
--     products.sku, which did get one. Two variants silently sharing a
--     SKU would make SKU-based matching resolve to whichever one a query
--     happened to return, silently misapplying stock to the wrong
--     size/color. Partial index (excluding null) because SKU is optional.
--     If this fails to apply, it means there's already a duplicate in
--     real data — worth knowing before the import ships, not after.
-- ─────────────────────────────────────────────────────────────────

create unique index if not exists product_variants_sku_key
  on public.product_variants (sku) where sku is not null;

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid references public.product_variants(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  delta integer not null,
  previous_stock integer not null,
  new_stock integer not null,
  source text not null check (source in ('manual', 'import')),
  reason text,
  import_batch_id uuid,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.inventory_movements enable row level security;

create policy "admins read inventory movements" on public.inventory_movements
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
-- No insert/update/delete policy for authenticated/anon, on purpose — same
-- append-only pattern as activity_log. Rows are written only by the two
-- security-definer functions below, which run as service_role.

create index inventory_movements_variant_idx on public.inventory_movements (variant_id, created_at desc);
create index inventory_movements_batch_idx on public.inventory_movements (import_batch_id) where import_batch_id is not null;
create index inventory_movements_created_idx on public.inventory_movements (created_at desc);

-- ═══════════════════════════════════════════════════════════════════
-- MANUAL CORRECTION (Products page, single variant, absolute value)
-- ═══════════════════════════════════════════════════════════════════
-- `select ... for update` locks the row so a manual edit can't race a
-- concurrent sale — whichever transaction commits second sees the other's
-- write when it re-reads stock, instead of both computing a delta from a
-- stale value.
create or replace function public.set_variant_stock(
  p_variant_id uuid,
  p_new_stock integer,
  p_actor_id uuid,
  p_reason text default null
)
returns table(ok boolean, error_message text, new_stock integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
  v_previous_stock integer;
  v_delta integer;
begin
  if p_new_stock < 0 then
    return query select false, 'Stock cannot be negative.'::text, null::integer;
    return;
  end if;

  select product_id, stock into v_product_id, v_previous_stock
  from public.product_variants where id = p_variant_id for update;

  if v_product_id is null then
    return query select false, 'That size/color no longer exists.'::text, null::integer;
    return;
  end if;

  v_delta := p_new_stock - v_previous_stock;
  update public.product_variants set stock = p_new_stock where id = p_variant_id;

  if v_delta <> 0 then
    insert into public.inventory_movements
      (variant_id, product_id, delta, previous_stock, new_stock, source, reason, actor_id)
    values
      (p_variant_id, v_product_id, v_delta, v_previous_stock, p_new_stock, 'manual',
       coalesce(p_reason, 'Manual correction'), p_actor_id);

    perform public.log_admin_activity(
      'inventory',
      'Adjusted stock ' || v_previous_stock || ' → ' || p_new_stock,
      'variant', p_variant_id,
      jsonb_build_object('delta', v_delta, 'previous_stock', v_previous_stock, 'new_stock', p_new_stock),
      p_actor_id
    );
  end if;

  return query select true, null::text, p_new_stock;
end;
$$;

revoke execute on function public.set_variant_stock(uuid, integer, uuid, text) from public, anon, authenticated;
grant execute on function public.set_variant_stock(uuid, integer, uuid, text) to service_role;

-- ═══════════════════════════════════════════════════════════════════
-- BULK IMPORT (Excel/CSV, whole batch, atomic)
-- ═══════════════════════════════════════════════════════════════════
-- p_rows is a JSONB array of {"variant_id": uuid, "value": integer}. SKU
-- matching and per-row field validation (numeric, non-negative, no
-- duplicate SKUs in the file, unknown SKU) already happened in the
-- validate step before this is ever called — this function's job is
-- narrower: apply an already-matched batch atomically, or apply none of
-- it. p_mode decides how "value" is interpreted:
--   'replace' — value IS the new stock.
--   'adjust'  — value is added to whatever stock is *right now* (not
--                whatever it was at preview time), same semantics as
--                adjust_variant_stock.
-- Re-reading current stock here (rather than trusting the preview) is
-- deliberate: time passes between preview and confirm, and a sale could
-- happen in between. A raised exception anywhere rolls back every row
-- already applied in this call, per Postgres function transaction
-- semantics — there's no partial-import state to clean up after.
create or replace function public.apply_inventory_import(
  p_mode text,
  p_rows jsonb,
  p_actor_id uuid,
  p_filename text default null
)
returns table(batch_id uuid, rows_updated integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid := gen_random_uuid();
  v_row jsonb;
  v_variant_id uuid;
  v_value integer;
  v_product_id uuid;
  v_sku text;
  v_previous_stock integer;
  v_new_stock integer;
  v_delta integer;
  v_count integer := 0;
begin
  if p_mode not in ('replace', 'adjust') then
    raise exception 'Invalid import mode: %', p_mode;
  end if;

  if jsonb_array_length(p_rows) = 0 then
    raise exception 'No rows to import.';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_variant_id := (v_row->>'variant_id')::uuid;
    v_value := (v_row->>'value')::integer;

    select product_id, stock, sku into v_product_id, v_previous_stock, v_sku
    from public.product_variants where id = v_variant_id for update;

    if v_product_id is null then
      raise exception 'A row in this import no longer matches an existing product (variant %). Re-download the template and try again.', v_variant_id;
    end if;

    v_new_stock := case when p_mode = 'replace' then v_value else v_previous_stock + v_value end;

    if v_new_stock < 0 then
      raise exception 'Row for SKU % would result in negative stock (% %  %) — fix it and re-import.',
        coalesce(v_sku, v_variant_id::text), v_previous_stock, case when p_mode = 'adjust' then '+' else '→' end, v_value;
    end if;

    v_delta := v_new_stock - v_previous_stock;
    update public.product_variants set stock = v_new_stock where id = v_variant_id;

    if v_delta <> 0 then
      insert into public.inventory_movements
        (variant_id, product_id, delta, previous_stock, new_stock, source, import_batch_id, actor_id)
      values
        (v_variant_id, v_product_id, v_delta, v_previous_stock, v_new_stock, 'import', v_batch_id, p_actor_id);
      v_count := v_count + 1;
    end if;
  end loop;

  perform public.log_admin_activity(
    'inventory',
    'Imported inventory — ' || v_count || ' variant' || case when v_count = 1 then '' else 's' end || ' updated'
      || case when p_filename is not null then ' (from ' || p_filename || ')' else '' end,
    'inventory_import', v_batch_id,
    jsonb_build_object('mode', p_mode, 'rows_updated', v_count, 'filename', p_filename),
    p_actor_id
  );

  return query select v_batch_id, v_count;
end;
$$;

revoke execute on function public.apply_inventory_import(text, jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.apply_inventory_import(text, jsonb, uuid, text) to service_role;
