-- delivered_at anchors the return window. orders.updated_at is NOT safe for
-- this: any unrelated edit to an old delivered order (e.g. a payment_status
-- change) would bump updated_at and incorrectly re-open eligibility.
--
-- Also flips payment_method='delivery' orders to payment_status='paid' on
-- delivery — nothing in the codebase did this before (checkout.ts leaves
-- every order, including pay-on-delivery, at 'pending'), which meant
-- record_refund() would reject *every* refund on a POD order with "not in
-- a paid state" the moment Returns tried to use it, since POD is presumably
-- the more common payment method for this store. Only flips from 'pending'
-- specifically, so it can't clobber a 'failed' or already-'refunded' order.
alter table public.orders add column delivered_at timestamptz;

create or replace function public.set_delivered_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'delivered' and old.status is distinct from 'delivered' then
    new.delivered_at := now();
    if new.payment_method = 'delivery' and new.payment_status = 'pending' then
      new.payment_status := 'paid';
    end if;
  end if;
  return new;
end;
$$;

create trigger orders_set_delivered_at before update on public.orders
  for each row execute function public.set_delivered_at();

-- Configurable return window, read by request_return() below instead of a
-- hardcoded constant — matches the actual Returns Policy page (7 days) so
-- this migration changes *where* the rule lives, not what it does, same as
-- the shipping migration did for the flat-fee formula.
alter table public.store_settings add column return_window_days integer not null default 7 check (return_window_days > 0);

create table public.return_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  customer_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'requested'
    check (status in ('requested', 'under_review', 'approved', 'rejected', 'item_received', 'refund_initiated', 'completed')),
  reason text not null,
  customer_note text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.return_items (
  id uuid primary key default gen_random_uuid(),
  return_request_id uuid not null references public.return_requests(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id),
  quantity integer not null check (quantity > 0),
  -- order_items.price * quantity at request time — server-computed inside
  -- request_return(), never trusted from the client, and deliberately not
  -- recalculated later if the product's price ever changes.
  refund_amount numeric not null check (refund_amount >= 0)
);

create index return_requests_order_idx on public.return_requests(order_id);
create index return_requests_customer_idx on public.return_requests(customer_id, created_at desc);
create index return_requests_status_idx on public.return_requests(status);
create index return_items_request_idx on public.return_items(return_request_id);
create index return_items_order_item_idx on public.return_items(order_item_id);

alter table public.return_requests enable row level security;
alter table public.return_items enable row level security;

create policy "customers view own returns" on public.return_requests for select to authenticated
  using (customer_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "admins manage returns" on public.return_requests for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
-- No insert policy for customers: return_requests are only ever created
-- through request_return() below (service_role only, called from a server
-- function that's already verified the customer's JWT — same pattern as
-- checkout.ts's createOrder). That function does every eligibility check;
-- RLS alone can't express "order was delivered within the window."

create policy "return items follow return_requests" on public.return_items for select to authenticated
  using (exists (select 1 from public.return_requests r where r.id = return_request_id and (r.customer_id = auth.uid() or public.has_role(auth.uid(), 'admin'))));
create policy "admins manage return items" on public.return_items for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create trigger touch_return_requests before update on public.return_requests
  for each row execute function public.touch_updated_at();

-- Creates a return request with its line items, enforcing every eligibility
-- rule atomically: ownership, delivered status, return window, valid items,
-- and that the requested quantity (plus anything already returned and not
-- rejected) never exceeds what was actually purchased. `for update` locks
-- the order row for the duration of the check, closing the race where two
-- concurrent requests could otherwise both pass a "not yet returned" check.
create or replace function public.request_return(
  p_order_id uuid,
  p_customer_id uuid,
  p_reason text,
  p_customer_note text,
  p_items jsonb -- [{ "order_item_id": uuid, "quantity": int }, ...]
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
    -- Deliberately one active return per order at a time, not per item —
    -- keeps admin review simple and matches how the customer UI presents it
    -- (a single "Request Return" action per order). A customer whose return
    -- was rejected can request again; nothing blocks that.
    raise exception 'This order already has an active return request';
  end if;

  insert into public.return_requests (order_id, customer_id, reason, customer_note)
  values (p_order_id, p_customer_id, p_reason, nullif(trim(p_customer_note), ''))
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

revoke execute on function public.request_return from public, anon, authenticated;
grant execute on function public.request_return to service_role;

-- Admin-only state transitions. Rejects any move not in this explicit map —
-- a customer (or a buggy admin click) can't skip from "requested" straight
-- to "completed", and there's no way back out of a terminal state.
--
-- Deliberately does NOT call record_refund itself. src/lib/actions/refunds.ts
-- already has a complete requestRefund — rate-limited, re-derives the
-- refundable amount from the DB, and for Paystack-paid orders calls the
-- live Paystack /refund API before recording anything (pay-on-delivery
-- orders record a manual refund instead, since there's no gateway
-- transaction to refund). The 'refund_initiated' transition is orchestrated
-- from src/lib/actions/returns.ts, which calls that existing function and
-- only reaches this one afterward — so this function's job is purely the
-- state transition + audit log, never a second refund mechanism.
-- Links a refund back to the return that caused it (for the admin return
-- detail view) once returns.ts has called requestRefund — set from there,
-- not here. Nullable: most refunds aren't return-triggered.
alter table public.refunds add column return_request_id uuid references public.return_requests(id);

create or replace function public.update_return_status(
  p_return_id uuid,
  p_new_status text,
  p_actor_id uuid,
  p_admin_note text default null
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
  set status = p_new_status, admin_note = coalesce(nullif(trim(p_admin_note), ''), admin_note)
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

revoke execute on function public.update_return_status from public, anon, authenticated;
grant execute on function public.update_return_status to service_role;
