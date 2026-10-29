-- Business decision (see this session's brief): customized items are
-- non-refundable by default — already the product page's own copy, but
-- until now that was UI text only. request_return() itself is left
-- untouched (a customer can still submit a return request that includes a
-- customized item; declining it, or approving it as a deliberate
-- exception, is the admin's call either way — request_return never
-- refunds anything by itself, it just creates the record admin reviews).
-- The actual enforcement sits at the one point that matters: admin moving
-- a return to 'approved', inside update_return_status — matching the
-- explicit instruction not to touch the existing request/review pipeline
-- more than necessary.
alter table public.return_requests
  add column if not exists customization_override boolean not null default false;

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
  v_has_customized boolean;
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

  -- Checks both the legacy (custom_name/custom_number) and current
  -- (custom_selections) snapshot shapes — a return can include items
  -- placed either before or after the customization migration, and both
  -- count as "customized" here.
  if p_new_status = 'approved' then
    select exists (
      select 1
      from public.return_items ri
      join public.order_items oi on oi.id = ri.order_item_id
      where ri.return_request_id = p_return_id
        and (
          oi.custom_name is not null
          or oi.custom_number is not null
          or oi.custom_selections <> '[]'::jsonb
        )
    ) into v_has_customized;

    if v_has_customized and not p_customization_override then
      raise exception
        'This return includes a customized item, which is non-refundable by default. Approving it requires an explicit override.';
    end if;
  end if;

  update public.return_requests
  set
    status = p_new_status,
    admin_note = coalesce(nullif(trim(p_admin_note), ''), admin_note),
    -- Sticky once set — later transitions on this same return
    -- (item_received, refund_initiated, completed) call this again with
    -- p_customization_override defaulting back to false, which must not
    -- erase a genuine override recorded at the 'approved' step.
    customization_override =
      customization_override or (p_new_status = 'approved' and p_customization_override)
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

revoke execute on function public.update_return_status(uuid, text, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.update_return_status(uuid, text, uuid, text, boolean) to service_role;
