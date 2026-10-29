-- ─────────────────────────────────────────────────────────────────
-- Refunds. Money amounts stay in Naira throughout (matching orders.total,
-- order_items.price, etc. — this schema's existing convention); conversion
-- to kobo happens only at the Paystack API boundary in refunds.ts, same
-- place checkout.ts/paystack.ts already do it for charges.
--
-- Deliberately does NOT add a value to payment_status for "partially
-- refunded" — the spec asks the Payments page to show that state, but it's
-- computed by comparing sum(processed refunds) against orders.total, not
-- stored. payment_status only flips to 'refunded' once that sum reaches
-- the total. A stored partial-refund enum value would just be a second
-- source of truth for something already derivable, with its own way to
-- drift out of sync.
-- ─────────────────────────────────────────────────────────────────

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  amount numeric not null check (amount > 0),
  reason text,
  method text not null check (method in ('paystack', 'manual')),
  gateway_reference text,
  gateway_status text,
  status text not null check (status in ('pending', 'processed', 'failed')),
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.refunds enable row level security;

create policy "admins read refunds" on public.refunds
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
-- No insert/update/delete policy for authenticated/anon — same append/
-- update-via-function-only pattern as inventory_movements/activity_log.
-- Writes happen only through record_refund and update_refund_status below,
-- both service_role only.

create index refunds_order_idx on public.refunds (order_id, created_at desc);
create unique index refunds_gateway_reference_key
  on public.refunds (gateway_reference) where gateway_reference is not null;

-- ═══════════════════════════════════════════════════════════════════
-- Admin-initiated refund (Payments page). One call covers both paths:
--   method='paystack' — refunds.ts already called Paystack's /refund
--     endpoint before this runs; p_status/p_gateway_status/p_gateway_reference
--     reflect what Paystack actually returned, not an assumption.
--   method='manual'   — a cash/COD refund the admin is asserting happened
--     outside the system; no gateway involved, p_status is always
--     'processed' since there's no async confirmation to wait for.
-- Row-locks the order so two refund requests for the same order can't both
-- read a stale "already refunded" total and jointly over-refund it.
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.record_refund(
  p_order_id uuid,
  p_amount numeric,
  p_reason text,
  p_method text,
  p_gateway_reference text,
  p_gateway_status text,
  p_status text,
  p_actor_id uuid
)
returns table(refund_id uuid, order_fully_refunded boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_total numeric;
  v_payment_status text;
  v_already_committed numeric;
  v_refund_id uuid;
  v_total_processed numeric;
  v_fully_refunded boolean;
begin
  if p_method not in ('paystack', 'manual') then
    raise exception 'Invalid refund method: %', p_method;
  end if;
  if p_status not in ('pending', 'processed', 'failed') then
    raise exception 'Invalid refund status: %', p_status;
  end if;
  if p_amount <= 0 then
    raise exception 'Refund amount must be greater than zero.';
  end if;

  select total, payment_status into v_order_total, v_payment_status
  from public.orders where id = p_order_id for update;

  if v_order_total is null then
    raise exception 'Order not found.';
  end if;
  if v_payment_status <> 'paid' then
    raise exception 'This order is not in a paid state, so there is nothing to refund.';
  end if;

  select coalesce(sum(amount), 0) into v_already_committed
  from public.refunds where order_id = p_order_id and status in ('pending', 'processed');

  -- A failed attempt didn't move any money, so it shouldn't be blocked by
  -- (or count toward) the "can't exceed the order total" check — only
  -- pending/processed refunds reserve against the total.
  if p_status <> 'failed' and (v_already_committed + p_amount) > v_order_total then
    raise exception 'Refund of % would exceed the order total of % (% already refunded or in progress).',
      p_amount, v_order_total, v_already_committed;
  end if;

  insert into public.refunds
    (order_id, amount, reason, method, gateway_reference, gateway_status, status, actor_id)
  values
    (p_order_id, p_amount, p_reason, p_method, p_gateway_reference, p_gateway_status, p_status, p_actor_id)
  returning id into v_refund_id;

  select coalesce(sum(amount), 0) into v_total_processed
  from public.refunds where order_id = p_order_id and status = 'processed';
  v_fully_refunded := v_total_processed >= v_order_total;

  if v_fully_refunded then
    update public.orders set payment_status = 'refunded' where id = p_order_id;
  end if;

  perform public.log_admin_activity(
    'payment',
    initcap(p_method) || ' refund ' || p_status || ' — ₦' || to_char(p_amount, 'FM999,999,999'),
    'order', p_order_id,
    jsonb_build_object('amount', p_amount, 'method', p_method, 'status', p_status, 'reason', p_reason),
    p_actor_id
  );

  return query select v_refund_id, v_fully_refunded;
end;
$$;

revoke execute on function public.record_refund(uuid, numeric, text, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.record_refund(uuid, numeric, text, text, text, text, text, uuid) to service_role;

-- ═══════════════════════════════════════════════════════════════════
-- Webhook-driven status update (refund.processed / refund.failed). Looks
-- up the refund by the reference record_refund stored, not by anything
-- the webhook payload could be spoofed to control unchecked — the payload
-- only ever selects an *existing* row, never creates one. Re-delivery of
-- the same event is a genuine no-op (status already matches → return
-- early before touching anything), which is what makes this safe to call
-- more than once for the same event, a real possibility with webhooks.
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.update_refund_status(
  p_gateway_reference text,
  p_status text,
  p_gateway_status text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refund_id uuid;
  v_order_id uuid;
  v_current_status text;
  v_order_total numeric;
  v_total_processed numeric;
begin
  if p_status not in ('pending', 'processed', 'failed') then
    raise exception 'Invalid refund status: %', p_status;
  end if;

  select id, order_id, status into v_refund_id, v_order_id, v_current_status
  from public.refunds where gateway_reference = p_gateway_reference for update;

  if v_refund_id is null or v_current_status = p_status then
    return;
  end if;

  update public.refunds
  set status = p_status, gateway_status = coalesce(p_gateway_status, gateway_status), updated_at = now()
  where id = v_refund_id;

  select total into v_order_total from public.orders where id = v_order_id for update;

  select coalesce(sum(amount), 0) into v_total_processed
  from public.refunds where order_id = v_order_id and status = 'processed';

  if v_total_processed >= v_order_total then
    update public.orders set payment_status = 'refunded' where id = v_order_id;
  end if;
end;
$$;

revoke execute on function public.update_refund_status(text, text, text) from public, anon, authenticated;
grant execute on function public.update_refund_status(text, text, text) to service_role;
