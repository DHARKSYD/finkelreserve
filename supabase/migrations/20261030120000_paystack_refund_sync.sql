-- Paystack refunds: make the webhook actually update refunds, finish returns automatically, and
-- let customers see where their refund is.
--
-- What was wrong
--   The webhook handler matched a refund notification to our refunds row by `data.id`, assuming
--   it equalled the refund id Paystack returned when we created the refund (stored as
--   refunds.gateway_reference). Paystack's documented refund webhook payload has no `id` — it
--   carries { status, transaction_reference, refund_reference (null until processed), amount
--   (a string, in kobo), currency, processor, customer, integration, domain }. So the handler's
--   guard (`event.data?.id != null`) was never true: no refund ever moved past "pending", orders
--   never became "refunded", and returns sat at "refund initiated" until someone ticked them off.
--
-- What this adds
--   · update_refund_status_by_transaction(): finds the refund from what the webhook DOES send —
--     the transaction reference (= orders.payment_reference) and the amount — and applies the
--     new status. (An id match is still tried first, in case a payload ever includes one.)
--   · _apply_refund_status(): the one place that applies a status. processed and failed are
--     FINAL (notifications can arrive out of order — a late "processing" must not undo
--     "processed"); a processed refund recomputes the order's payment_status; and when the last
--     open refund of a return is processed, the return moves refund_initiated → completed.
--   · update_refund_status() (existing, by Paystack refund id) now delegates to it, so both
--     paths behave identically.
--   · "needs-attention" (Paystack needs the customer's bank account — common when they paid by
--     transfer/USSD) is kept as status 'pending' with gateway_status 'needs-attention', so it
--     still reserves the amount against the order and the admin UI can flag it.
--   · my_return_refunds(): lets a signed-in customer read the status of refunds on THEIR returns
--     only (the refunds table itself stays admin-only; it holds gateway references and actor ids).
--
-- Safe to run more than once.

-- ── Shared status logic ────────────────────────────────────────────────
create or replace function public._apply_refund_status(
  p_refund_id uuid,
  p_status text,
  p_gateway_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_return_id uuid;
  v_current text;
  v_order_total numeric;
  v_total_processed numeric;
  v_open integer;
begin
  if p_status not in ('pending', 'processed', 'failed') then
    raise exception 'Invalid refund status: %', p_status;
  end if;

  select order_id, return_request_id, status
  into v_order_id, v_return_id, v_current
  from public.refunds where id = p_refund_id for update;

  if v_order_id is null then
    return;
  end if;

  -- processed / failed are final. Webhooks can be delivered out of order or twice.
  if v_current in ('processed', 'failed') then
    return;
  end if;

  update public.refunds
  set status = p_status,
      gateway_status = coalesce(p_gateway_status, gateway_status),
      updated_at = now()
  where id = p_refund_id;

  if p_status <> 'processed' then
    return;
  end if;

  -- The order is fully refunded once processed refunds cover its total.
  select total into v_order_total from public.orders where id = v_order_id for update;
  select coalesce(sum(amount), 0) into v_total_processed
  from public.refunds where order_id = v_order_id and status = 'processed';
  if v_total_processed >= v_order_total then
    update public.orders set payment_status = 'refunded' where id = v_order_id;
  end if;

  -- A return finishes when every refund raised for it has gone through.
  if v_return_id is not null then
    select count(*) into v_open
    from public.refunds where return_request_id = v_return_id and status = 'pending';
    if v_open = 0 and exists (
      select 1 from public.return_requests where id = v_return_id and status = 'refund_initiated'
    ) then
      begin
        perform public.update_return_status(v_return_id, 'completed', null, 'Refund processed by Paystack.');
      exception when others then
        -- Never let a bookkeeping hiccup on the return undo recording the refund itself.
        raise notice 'Could not auto-complete return %: %', v_return_id, sqlerrm;
      end;
    end if;
  end if;
end;
$$;

revoke execute on function public._apply_refund_status(uuid, text, text) from public, anon, authenticated;

-- ── By Paystack refund id (existing signature; now delegates) ──────────
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
begin
  if p_status not in ('pending', 'processed', 'failed') then
    raise exception 'Invalid refund status: %', p_status;
  end if;

  select id into v_refund_id from public.refunds where gateway_reference = p_gateway_reference;
  if v_refund_id is not null then
    perform public._apply_refund_status(v_refund_id, p_status, p_gateway_status);
  end if;
end;
$$;

revoke execute on function public.update_refund_status(text, text, text) from public, anon, authenticated;
grant execute on function public.update_refund_status(text, text, text) to service_role;

-- ── By transaction reference + amount (what Paystack's webhook really sends) ──
-- Returns a short outcome for the server log: updated | no_order | no_refund | ambiguous.
-- no_refund is normal (e.g. a refund made from the Paystack dashboard, or the "processed"
-- notification for one we already recorded as processed) — it is not an error.
create or replace function public.update_refund_status_by_transaction(
  p_transaction_reference text,
  p_amount numeric,
  p_status text,
  p_gateway_status text default null,
  p_gateway_reference text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refund_id uuid;
  v_order_id uuid;
  v_pending integer;
begin
  if p_status not in ('pending', 'processed', 'failed') then
    raise exception 'Invalid refund status: %', p_status;
  end if;

  -- 1) An exact Paystack refund id, if the payload happened to carry one.
  if p_gateway_reference is not null then
    select id into v_refund_id from public.refunds where gateway_reference = p_gateway_reference;
  end if;

  -- 2) Otherwise: the order that was paid with this transaction, and its still-open Paystack
  --    refund — the oldest one of exactly this amount, or the only one if there is just one.
  if v_refund_id is null then
    select id into v_order_id from public.orders where payment_reference = p_transaction_reference;
    if v_order_id is null then
      return 'no_order';
    end if;

    if p_amount is not null then
      select id into v_refund_id
      from public.refunds
      where order_id = v_order_id and method = 'paystack' and status = 'pending'
        and abs(amount - p_amount) < 0.01
      order by created_at asc
      limit 1;
    end if;

    if v_refund_id is null then
      select count(*) into v_pending
      from public.refunds where order_id = v_order_id and method = 'paystack' and status = 'pending';
      if v_pending = 1 then
        select id into v_refund_id
        from public.refunds where order_id = v_order_id and method = 'paystack' and status = 'pending';
      elsif v_pending > 1 then
        return 'ambiguous';
      end if;
    end if;
  end if;

  if v_refund_id is null then
    return 'no_refund';
  end if;

  perform public._apply_refund_status(v_refund_id, p_status, p_gateway_status);
  return 'updated';
end;
$$;

revoke execute on function public.update_refund_status_by_transaction(text, numeric, text, text, text) from public, anon, authenticated;
grant execute on function public.update_refund_status_by_transaction(text, numeric, text, text, text) to service_role;

-- ── Customer-visible refund status (their own returns only) ────────────
-- The refunds table is admin-only (gateway references, who issued it…). This exposes just
-- what a customer needs to see, and only for returns that are theirs. Executable by signed-in
-- users on purpose: it can only ever return the caller's own rows.
create or replace function public.my_return_refunds()
returns table (
  return_request_id uuid,
  amount numeric,
  status text,
  gateway_status text,
  method text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select f.return_request_id, f.amount, f.status, f.gateway_status, f.method, f.created_at, f.updated_at
  from public.refunds f
  join public.return_requests r on r.id = f.return_request_id
  where r.customer_id = auth.uid()
$$;

revoke execute on function public.my_return_refunds() from public, anon;
grant execute on function public.my_return_refunds() to authenticated;
