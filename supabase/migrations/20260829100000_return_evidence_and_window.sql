-- Refines returns for a wine retailer specifically: report broken bottles
-- or damaged boxes promptly, with photo/video evidence, rather than a
-- general multi-day satisfaction window. Additive on top of
-- 20260816180000_returns.sql — nothing here changes the state machine or
-- eligibility logic, only the default window and what a request can carry.

-- ── Default return window: 7 days -> 1 day (24 hours) ──
-- Still admin-configurable (store_settings.return_window_days, checked
-- >0) via /admin/settings.
--
-- SET DEFAULT alone would be a no-op here: store_settings is a singleton
-- (one row, id = true, inserted by 20260816150000_store_settings.sql) and
-- that row already exists with return_window_days = 7, backfilled by the
-- column's original `default 7` when 20260816180000_returns.sql added it
-- via ALTER TABLE ADD COLUMN. SET DEFAULT only changes what *new* inserts
-- get — for a singleton table where no new row is ever inserted again,
-- that alone would silently do nothing to the value actually in use. The
-- explicit UPDATE below is what makes the new default real; SET DEFAULT
-- is kept too so the column's own definition stays accurate for anyone
-- reading the schema.
alter table public.store_settings alter column return_window_days set default 1;
update public.store_settings set return_window_days = 1
  where id = true and return_window_days = 7;

-- ── Evidence: photos/videos a customer attaches when requesting a return ──
-- Paths, not URLs — the bucket below is private, so display always goes
-- through a signed URL generated at read time (src/lib/queries/return-
-- evidence.ts), never a stored permanent link.
alter table public.return_requests add column evidence_paths text[] not null default '{}';

-- Private bucket (unlike the public `avatars` bucket from the account
-- redesign) — this can contain photos of a customer's home or delivery,
-- which isn't the kind of thing that should be guessable/public by URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'return-evidence',
  'return-evidence',
  false,
  52428800, -- 50MB — the real cap is enforced client-side per file type
            -- (src/lib/queries/return-evidence.ts); this is Storage's own
            -- backstop against a request that bypasses the client entirely.
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do nothing;

-- Path convention: {customer_id}/{random-filename} — enforced by checking
-- the first path segment against auth.uid(), same pattern as the avatars
-- bucket's owner-scoped policies. Scoped by customer_id rather than
-- return_id because evidence is uploaded *before* request_return() creates
-- the return row (the id doesn't exist yet at upload time).
create policy "customers upload own return evidence"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'return-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "customers and admins read return evidence"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'return-evidence'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.has_role(auth.uid(), 'admin')
    )
  );

-- No update/delete policy: evidence is submitted once per return request
-- and never edited or removed by the customer, same reasoning as order
-- immutability elsewhere in this project.

-- ── request_return(): accepts evidence paths, stores them atomically ──
-- Signature adds one parameter with a default, so this stays
-- backward-compatible with any caller that doesn't pass it.
create or replace function public.request_return(
  p_order_id uuid,
  p_customer_id uuid,
  p_reason text,
  p_customer_note text,
  p_items jsonb, -- [{ "order_item_id": uuid, "quantity": int }, ...]
  p_evidence_paths text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_window_days int;
  v_return_id uuid;
  v_item jsonb;
  v_order_item record;
  v_already_returned int;
  v_qty int;
  v_line_amount numeric;
begin
  select id, user_id, status, delivered_at into v_order
  from public.orders where id = p_order_id
  for update;

  if v_order.id is null then
    raise exception 'Order not found';
  end if;
  if v_order.user_id is distinct from p_customer_id then
    raise exception 'This order does not belong to you';
  end if;
  if v_order.status <> 'delivered' then
    raise exception 'Only delivered orders are eligible for return';
  end if;

  select return_window_days into v_window_days from public.store_settings where id = true;

  if v_order.delivered_at is null or now() > v_order.delivered_at + make_interval(days => v_window_days) then
    raise exception 'The %s-day return window for this order has passed', v_window_days;
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Select at least one item to return';
  end if;
  if exists (
    select 1 from public.return_requests
    where order_id = p_order_id and status not in ('rejected')
  ) then
    raise exception 'This order already has an active return request';
  end if;

  insert into public.return_requests (order_id, customer_id, reason, customer_note, evidence_paths)
  values (
    p_order_id,
    p_customer_id,
    p_reason,
    nullif(trim(p_customer_note), ''),
    coalesce(p_evidence_paths, '{}')
  )
  returning id into v_return_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select oi.id, oi.order_id, oi.price, oi.qty into v_order_item
    from public.order_items oi
    where oi.id = (v_item->>'order_item_id')::uuid;

    if v_order_item.id is null or v_order_item.order_id <> p_order_id then
      raise exception 'One of the selected items does not belong to this order';
    end if;

    select coalesce(sum(ri.quantity), 0) into v_already_returned
    from public.return_items ri
    join public.return_requests r on r.id = ri.return_request_id
    where ri.order_item_id = v_order_item.id and r.status <> 'rejected';

    v_qty := (v_item->>'quantity')::int;
    if v_qty is null or v_qty <= 0 or v_qty + v_already_returned > v_order_item.qty then
      raise exception 'Invalid return quantity for one of the items';
    end if;

    v_line_amount := v_order_item.price * v_qty;

    insert into public.return_items (return_request_id, order_item_id, quantity, refund_amount)
    values (v_return_id, v_order_item.id, v_qty, v_line_amount);
  end loop;

  perform public.log_admin_activity(
    'return_requested',
    'Return requested for order ' || left(p_order_id::text, 8),
    'return', v_return_id,
    jsonb_build_object('order_id', p_order_id),
    p_customer_id
  );

  return v_return_id;
end;
$$;

revoke execute on function public.request_return(uuid, uuid, text, text, jsonb, text[]) from public, anon, authenticated;
grant execute on function public.request_return(uuid, uuid, text, text, jsonb, text[]) to service_role;
