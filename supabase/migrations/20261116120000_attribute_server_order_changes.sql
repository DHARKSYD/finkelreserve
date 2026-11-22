-- Audit trail, part 1 of 2: record WHICH admin changed an order when a server function made
-- the change.
--
-- THE PROBLEM
--   The Orders screen changes an order's status through a server function that uses the service
--   key (so it can email the customer). The service key carries no user identity, so the
--   log_order_change trigger wrote those changes with no actor, and the Team screens could not
--   credit them to anyone.
--
-- THE FIX
--   Server functions that act for a signed-in admin now send that admin's id in an x-actor-id
--   request header, and the trigger reads it, but ONLY when the request was made with the
--   service key. Anyone else's header is ignored, and a missing or malformed header leaves the
--   entry without an actor, exactly as before. Safe to run more than once.

-- Who is acting right now: the signed-in user if there is one, otherwise the admin named by a
-- service-key request, otherwise nobody. It never raises: an entry with no actor is better than
-- a failed order update.
create or replace function public.trusted_actor_id()
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  v_uid uuid;
  v_role text;
begin
  v_uid := auth.uid();
  if v_uid is not null then
    return v_uid;
  end if;

  v_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role'
  );
  if coalesce(v_role, '') <> 'service_role' then
    return null;
  end if;

  return nullif(nullif(current_setting('request.headers', true), '')::json ->> 'x-actor-id', '')::uuid;
exception when others then
  return null;
end;
$$;

revoke execute on function public.trusted_actor_id() from public, anon, authenticated;

-- Same logging as before (see 20260812120000_admin_platform_foundations.sql); the only change
-- is that the actor now comes from trusted_actor_id() instead of auth.uid() alone.
create or replace function public.log_order_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.trusted_actor_id();
begin
  if old.status is distinct from new.status and new.status <> 'cancelled' then
    perform public.log_admin_activity(
      'order', 'Order ' || left(new.id::text, 8) || ' status changed to ' || new.status,
      'order', new.id, null, v_actor
    );
  end if;
  if old.payment_status is distinct from new.payment_status then
    perform public.log_admin_activity(
      'payment', 'Order ' || left(new.id::text, 8) || ' payment marked ' || new.payment_status,
      'order', new.id, null, v_actor
    );
  end if;
  return new;
end;
$$;

revoke execute on function public.log_order_change() from public, anon, authenticated;
