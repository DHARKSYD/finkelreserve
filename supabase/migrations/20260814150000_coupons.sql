-- ─────────────────────────────────────────────────────────────────
-- Coupons. Admin CRUD goes through direct RLS-gated client calls, same as
-- products — not a server function — because there's no multi-table
-- atomicity need for creating/editing a coupon row, and it lets
-- log_coupon_change piggyback on auth.uid() as log_product_change already
-- does, with zero extra plumbing.
--
-- Redemption is the one part that genuinely needs a service-role atomic
-- function: validateCoupon/placeOrder run as service_role (they handle
-- unauthenticated customer input), and usage_limit enforcement needs a
-- race-safe increment — two checkouts redeeming the last slot of a
-- limited code at the same moment must not both succeed.
-- ─────────────────────────────────────────────────────────────────

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null check (type in ('percentage', 'fixed')),
  value numeric not null check (value > 0),
  free_shipping boolean not null default false,
  min_order_amount numeric check (min_order_amount is null or min_order_amount >= 0),
  max_discount_amount numeric check (max_discount_amount is null or max_discount_amount >= 0),
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  per_customer_limit integer check (per_customer_limit is null or per_customer_limit > 0),
  usage_count integer not null default 0,
  starts_at timestamptz,
  expires_at timestamptz,
  active boolean not null default true,
  first_order_only boolean not null default false,
  -- Empty/null on either means "no restriction" — most coupons are
  -- site-wide, so the common case needs neither array populated.
  applicable_product_ids uuid[],
  applicable_categories text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.coupons enable row level security;

create policy "admins manage coupons" on public.coupons for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create trigger touch_coupons before update on public.coupons
  for each row execute function public.touch_updated_at();

create index coupons_code_idx on public.coupons (code);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id),
  order_id uuid not null references public.orders(id),
  customer_email text not null,
  amount_off numeric not null,
  created_at timestamptz not null default now()
);
alter table public.coupon_redemptions enable row level security;

create policy "admins read coupon redemptions" on public.coupon_redemptions
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
-- Written only by record_coupon_redemption (service_role) — same
-- append-only-via-function pattern as inventory_movements/refunds.

create index coupon_redemptions_coupon_idx on public.coupon_redemptions (coupon_id);
create index coupon_redemptions_customer_idx on public.coupon_redemptions (coupon_id, customer_email);

-- Mirrors log_product_change exactly: only fires on the transitions worth
-- a line in the activity feed, using auth.uid() implicitly since this
-- always runs as the authenticated admin who made the client-side edit.
create or replace function public.log_coupon_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_admin_activity('promotion', 'Created coupon "' || new.code || '"', 'coupon', new.id);
    return new;
  elsif tg_op = 'UPDATE' then
    if old.active is distinct from new.active then
      perform public.log_admin_activity(
        'promotion',
        case when new.active then 'Activated coupon "' else 'Deactivated coupon "' end || new.code || '"',
        'coupon', new.id
      );
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    perform public.log_admin_activity('promotion', 'Deleted coupon "' || old.code || '"', 'coupon', old.id);
    return old;
  end if;
  return null;
end;
$$;

revoke execute on function public.log_coupon_change() from public, anon, authenticated;

create trigger coupons_log_changes
  after insert or update or delete on public.coupons
  for each row execute function public.log_coupon_change();

-- ═══════════════════════════════════════════════════════════════════
-- Atomic, race-safe redemption. The UPDATE's WHERE clause re-checks
-- usage_limit at the instant of the increment, not against a value read
-- earlier — the standard safe-counter pattern. If two checkouts redeem the
-- last remaining slot simultaneously, only one UPDATE affects a row; the
-- other returns false here.
--
-- Deliberately does NOT roll back the order if this returns false: by the
-- time this runs, the order already exists with the discount already
-- applied to its total (computed moments earlier in placeOrder, itself
-- validated against the coupon's state at that moment). Reversing an
-- already-placed order over a usage-limit race that's this narrow a
-- window would be worse for the customer than the business occasionally
-- honoring one discount beyond its nominal limit — a deliberate,
-- proportionate tradeoff, not an oversight.
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.record_coupon_redemption(
  p_coupon_id uuid,
  p_order_id uuid,
  p_customer_email text,
  p_amount_off numeric
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated boolean := false;
begin
  update public.coupons
  set usage_count = usage_count + 1
  where id = p_coupon_id
    and active = true
    and (usage_limit is null or usage_count < usage_limit)
  returning true into v_updated;

  if v_updated then
    insert into public.coupon_redemptions (coupon_id, order_id, customer_email, amount_off)
    values (p_coupon_id, p_order_id, lower(trim(p_customer_email)), p_amount_off);
  end if;

  return coalesce(v_updated, false);
end;
$$;

revoke execute on function public.record_coupon_redemption(uuid, uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.record_coupon_redemption(uuid, uuid, text, numeric) to service_role;
