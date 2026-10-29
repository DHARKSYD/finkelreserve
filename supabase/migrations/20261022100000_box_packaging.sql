-- Box packaging: buy a product by the box, at an admin-set discount.
--
-- Model (replaces the earlier per-size "carton" columns):
--   * products.bottles_per_box       — null = not sold by the box; otherwise how many
--     bottles one box holds (usually 6). Set on the product form.
--   * products.box_discount_percent  — % off the price of N single bottles when you
--     buy a box. 0 = no discount. The single-bottle price (products.price) is untouched:
--       box price = round(price × bottles_per_box × (1 − discount/100)) to whole naira.
--   * Stock is still counted in BOTTLES (product_variants.stock). A box of N takes N
--     bottles from stock; order_items snapshot what was bought so a later change to the
--     box size or discount never rewrites history or breaks cancel/restock.
--
-- Safe to run more than once.

-- ── 1. Product-level box settings ──────────────────────────────────────
alter table public.products
  add column if not exists bottles_per_box integer
    check (bottles_per_box is null or bottles_per_box between 2 and 48),
  add column if not exists box_discount_percent numeric(5, 2) not null default 0
    check (box_discount_percent >= 0 and box_discount_percent < 100);

comment on column public.products.bottles_per_box is
  'Bottles in one box. Null = not sold by the box. Usually 6. Stock is always counted in bottles.';
comment on column public.products.box_discount_percent is
  'Percent off (price × bottles_per_box) when buying a box. 0 = no discount. Box price is rounded to whole naira in the app (src/lib/box.ts).';

-- ── 2. Carry forward anything entered in the earlier per-size carton columns ──
-- 20261021100000/110000 put bottles_per_carton and carton_price on product_variants.
-- Move whatever was set there up to the product (a product has ONE box size now), turning
-- an absolute carton_price into the equivalent discount percent, then drop those columns
-- so there is a single source of truth. Guarded so a re-run (columns already gone) is a no-op.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_variants' and column_name = 'bottles_per_carton'
  ) then
    update public.products p
    set bottles_per_box = v.bpc
    from (
      select product_id, max(bottles_per_carton) as bpc
      from public.product_variants
      where bottles_per_carton is not null
      group by product_id
    ) v
    where p.id = v.product_id and p.bottles_per_box is null;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'product_variants' and column_name = 'carton_price'
    ) then
      update public.products p
      set box_discount_percent = d.pct
      from (
        select v.product_id,
               max(round((1 - v.carton_price / (pr.price * v.bottles_per_carton)) * 100, 2)) as pct
        from public.product_variants v
        join public.products pr on pr.id = v.product_id
        where v.carton_price is not null
          and v.bottles_per_carton is not null
          and pr.price > 0
          and v.carton_price < pr.price * v.bottles_per_carton
        group by v.product_id
      ) d
      where p.id = d.product_id and p.box_discount_percent = 0;
    end if;
  end if;
end $$;

alter table public.product_variants drop column if exists carton_price;
alter table public.product_variants drop column if exists bottles_per_carton;

-- ── 3. order_items.unit: 'carton' → 'box' ──────────────────────────────
-- The constraint was created inline, so Postgres named it order_items_unit_check.
alter table public.order_items drop constraint if exists order_items_unit_check;
update public.order_items set unit = 'box' where unit = 'carton';
alter table public.order_items
  add constraint order_items_unit_check check (unit in ('bottle', 'box'));

comment on column public.order_items.unit is 'What qty counts: bottle or box. Snapshot at purchase.';
comment on column public.order_items.bottles_per_unit is
  'Bottles taken from stock per unit of qty (1 for bottles, N for a box of N). Snapshot at purchase.';

-- ── 4. Inventory import can also set a product's box settings ─────────
-- Same signature as 20260813140000, so create-or-replace replaces it (grants are kept).
-- Each row may now carry optional keys, applied to the row's PRODUCT in the same
-- transaction as the stock change — any failure rolls back the whole batch:
--   box_size     integer — bottles per box; 0 turns box selling off; key absent = unchanged
--   box_discount numeric — percent off; key absent = unchanged
--   skip_stock   boolean — true = leave this variant's stock alone (a blank stock cell in the
--                file; `value` is then ignored). Without this a blank cell used to become 0.
-- `value` is always BOTTLES: when a file counts stock in boxes the app converts
-- boxes × bottles-per-box before calling this, so stock maths here is unchanged.
-- rows_updated now counts a row if its stock changed OR it changed its product's box settings.
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
  v_skip_stock boolean;
  v_product_id uuid;
  v_sku text;
  v_previous_stock integer;
  v_new_stock integer;
  v_delta integer;
  v_old_box integer;
  v_old_discount numeric;
  v_new_box integer;
  v_new_discount numeric;
  v_box_changed boolean;
  v_count integer := 0;
  v_box_products integer := 0;
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
    v_skip_stock := coalesce((v_row->>'skip_stock')::boolean, false);
    v_value := case when v_skip_stock then null else (v_row->>'value')::integer end;

    select product_id, stock, sku into v_product_id, v_previous_stock, v_sku
    from public.product_variants where id = v_variant_id for update;

    if v_product_id is null then
      raise exception 'A row in this import no longer matches an existing product (variant %). Re-download the template and try again.', v_variant_id;
    end if;

    if v_skip_stock then
      v_new_stock := v_previous_stock;
    else
      v_new_stock := case when p_mode = 'replace' then v_value else v_previous_stock + v_value end;

      if v_new_stock < 0 then
        raise exception 'Row for SKU % would result in negative stock (% %  %) — fix it and re-import.',
          coalesce(v_sku, v_variant_id::text), v_previous_stock, case when p_mode = 'adjust' then '+' else '→' end, v_value;
      end if;
    end if;

    v_delta := v_new_stock - v_previous_stock;

    if v_delta <> 0 then
      update public.product_variants set stock = v_new_stock where id = v_variant_id;

      insert into public.inventory_movements
        (variant_id, product_id, delta, previous_stock, new_stock, source, import_batch_id, actor_id)
      values
        (v_variant_id, v_product_id, v_delta, v_previous_stock, v_new_stock, 'import', v_batch_id, p_actor_id);
    end if;

    -- Box settings for this row's product (only if the row carried them).
    v_box_changed := false;
    if (v_row ? 'box_size') or (v_row ? 'box_discount') then
      select bottles_per_box, box_discount_percent into v_old_box, v_old_discount
      from public.products where id = v_product_id for update;

      v_new_box := case when v_row ? 'box_size'
                        then nullif((v_row->>'box_size')::integer, 0)
                        else v_old_box end;
      v_new_discount := case when v_row ? 'box_discount'
                             then (v_row->>'box_discount')::numeric
                             else v_old_discount end;

      if v_new_box is distinct from v_old_box or v_new_discount is distinct from v_old_discount then
        update public.products
        set bottles_per_box = v_new_box, box_discount_percent = v_new_discount
        where id = v_product_id;
        v_box_changed := true;
        v_box_products := v_box_products + 1;
      end if;
    end if;

    if v_delta <> 0 or v_box_changed then
      v_count := v_count + 1;
    end if;
  end loop;

  perform public.log_admin_activity(
    'inventory',
    'Imported inventory — ' || v_count || ' variant' || case when v_count = 1 then '' else 's' end || ' updated'
      || case when v_box_products > 0
              then ', box settings changed on ' || v_box_products || ' product' || case when v_box_products = 1 then '' else 's' end
              else '' end
      || case when p_filename is not null then ' (from ' || p_filename || ')' else '' end,
    'inventory_import', v_batch_id,
    jsonb_build_object('mode', p_mode, 'rows_updated', v_count, 'box_products_changed', v_box_products, 'filename', p_filename),
    p_actor_id
  );

  return query select v_batch_id, v_count;
end;
$$;
