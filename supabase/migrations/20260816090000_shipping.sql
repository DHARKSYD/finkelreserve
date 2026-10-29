-- Shipping zones and rates, replacing the flat-fee formula in src/lib/pricing.ts.
-- Checkout keeps computing price server-side (see src/lib/actions/checkout.ts) —
-- this only moves shipping's *inputs* into the database so they're admin-editable
-- instead of a code constant. Checkout and the customer-facing rate lookup both
-- go through server functions using the service-role client (matching checkout.ts's
-- existing pattern), not direct client queries — so there's no public SELECT policy
-- here, only admin access.

create table public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  states text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.shipping_zones(id) on delete cascade,
  name text not null,
  price_ngn integer not null check (price_ngn >= 0),
  min_order_ngn integer check (min_order_ngn >= 0),
  free_shipping_threshold_ngn integer check (free_shipping_threshold_ngn >= 0),
  estimated_days_min smallint not null check (estimated_days_min >= 0),
  estimated_days_max smallint not null check (estimated_days_max >= estimated_days_min),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shipping_rates_zone_id_idx on public.shipping_rates(zone_id);
create index shipping_rates_active_idx on public.shipping_rates(active) where active;

-- Record which rate an order actually used — needed for analytics (real
-- shipping revenue, not a formula) and support ("what did this customer pick").
-- Nullable + on delete set null: an admin deleting a rate later shouldn't be
-- blocked by, or silently corrupt, historical orders that used it.
alter table public.orders add column shipping_rate_id uuid references public.shipping_rates(id) on delete set null;
alter table public.orders add column shipping_state text;

alter table public.shipping_zones enable row level security;
alter table public.shipping_rates enable row level security;

create policy "admins manage shipping zones" on public.shipping_zones for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create policy "admins manage shipping rates" on public.shipping_rates for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create trigger touch_shipping_zones before update on public.shipping_zones
  for each row execute function public.touch_updated_at();
create trigger touch_shipping_rates before update on public.shipping_rates
  for each row execute function public.touch_updated_at();

-- A state can only usefully belong to one zone (checkout needs a single
-- unambiguous rate list per address) — enforced here rather than left as an
-- admin-UI-only rule, since the UI isn't the only path that can write these rows.
create or replace function public.check_no_overlapping_zone_states()
returns trigger language plpgsql as $$
declare
  conflicting_zone text;
begin
  select z.name into conflicting_zone
  from public.shipping_zones z
  where z.id <> new.id
    and z.states && new.states
  limit 1;

  if conflicting_zone is not null then
    raise exception 'One or more of these states is already assigned to zone "%"', conflicting_zone;
  end if;

  return new;
end;
$$;

create trigger shipping_zones_no_state_overlap
  before insert or update on public.shipping_zones
  for each row execute function public.check_no_overlapping_zone_states();

-- Seed: exactly the policy currently live in code (₦5,000 flat, free above
-- ₦180,000, nationwide) so this migration changes *where* the rule lives, not
-- what it does. Split this into real zones/rates whenever the actual per-region
-- pricing is decided — see the audit doc.
insert into public.shipping_zones (name, states) values (
  'Nationwide',
  array['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
        'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','Gombe','Imo','Jigawa',
        'Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger',
        'Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe',
        'Zamfara','FCT']
);

insert into public.shipping_rates
  (zone_id, name, price_ngn, free_shipping_threshold_ngn, estimated_days_min, estimated_days_max)
select id, 'Standard Delivery', 5000, 180000, 2, 7
from public.shipping_zones where name = 'Nationwide';
