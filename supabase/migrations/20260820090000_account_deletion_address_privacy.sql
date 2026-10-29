-- ─────────────────────────────────────────────────────────────────
-- Final production-readiness pass, three independent fixes bundled
-- into one migration since they all ship together this session:
--   1) checkout/saved-address consistency
--   2) account deletion: preserve the return/refund audit trail
--   3) profiles: close a public phone-number leak
-- ─────────────────────────────────────────────────────────────────

-- 1) Checkout/saved-address consistency -------------------------------------
-- orders.shipping_address has always been a single freeform string, while
-- customer_addresses (added last phase) correctly splits address_line/city/
-- state/delivery_instructions. Checkout inherited the old flat shape, which
-- is why an address saved *from checkout* ended up with a blank city (the
-- form only ever collected one string). Adding the two missing structured
-- columns here; shipping_address keeps meaning exactly what it already
-- means (the street/address-line text) rather than being repurposed, so
-- nothing that currently reads it needs to change.
alter table public.orders
  add column shipping_city text,
  add column shipping_landmark text;

-- 2) Account deletion: preserve the return/refund audit trail ---------------
-- return_requests.customer_id was `on delete cascade`, unlike every other
-- customer-owned-but-business-relevant row in this schema (orders.user_id
-- and refunds.actor_id are both already `on delete set null`). Left as-is,
-- deleting a customer's auth account would silently delete their return
-- requests too — including ones tied to a refund that already happened —
-- which breaks "don't destroy historical business records" the moment
-- self-service account deletion exists. Fixed the same way orders/refunds
-- already handle it: detach, don't destroy. The order itself (which the
-- return still references via order_id, untouched by this) keeps its own
-- name/email/phone snapshot regardless, so the admin-facing return detail
-- view stays fully readable even after this.
--
-- The constraint name is looked up rather than hardcoded — this migration
-- can't be dry-run against the live project from this environment, and an
-- inline, unnamed `references` clause gets Postgres's auto-generated name,
-- which is very likely `return_requests_customer_id_fkey` but isn't worth
-- gambling a broken migration on when it costs nothing to check.
do $$
declare
  fk_name text;
begin
  select tc.constraint_name into fk_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'return_requests'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'customer_id';

  if fk_name is not null then
    execute format('alter table public.return_requests drop constraint %I', fk_name);
  end if;

  alter table public.return_requests alter column customer_id drop not null;

  alter table public.return_requests
    add constraint return_requests_customer_id_fkey
    foreign key (customer_id) references auth.users(id) on delete set null;
end $$;

-- 3) profiles: close a public phone-number leak ------------------------------
-- "profiles readable by all" (using (true)) was written back when the table
-- only held display_name/avatar_url, for showing a reviewer's name next to
-- their review. profiles.phone was added later (account_profile migration)
-- onto the *same* table, so that same public policy has been exposing every
-- customer's phone number to anyone with the public anon key via a direct
-- PostgREST call — not just through this app's own UI. RLS is row-level,
-- not column-level: which columns *our* queries happen to select was never
-- actually the security boundary here.
--
-- Fix: restrict the base table to owner+admin (the same pattern every other
-- customer-owned table in this schema already uses — customer_addresses,
-- orders, return_requests), then re-expose only the columns anything
-- public-facing genuinely needs through a narrow view. reviews.ts
-- (id, display_name) is the only real public consumer today and never
-- needed phone; avatar_url is included since it's a reasonable thing to
-- show next to a reviewer's name, but phone never is.
drop policy "profiles readable by all" on public.profiles;

create policy "users read own profile" on public.profiles for select to authenticated
  using (auth.uid() = id or public.has_role(auth.uid(), 'admin'));

create view public.public_profiles
  with (security_invoker = false)
  as select id, display_name, avatar_url from public.profiles;

grant select on public.public_profiles to anon, authenticated;
