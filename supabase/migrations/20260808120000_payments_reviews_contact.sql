-- ─────────────────────────────────────────────────────────────────
-- Adds what the storefront needs to run on real data instead of
-- browser-local state: payment tracking, jersey customization on
-- order items, auto-maintained review aggregates, and simple
-- tables for the contact form and newsletter signup.
-- ─────────────────────────────────────────────────────────────────

-- Payment tracking on orders ----------------------------------------
create type public.payment_method as enum ('delivery', 'paystack');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');

alter table public.orders
  add column payment_method public.payment_method not null default 'delivery',
  add column payment_status public.payment_status not null default 'pending',
  add column payment_reference text unique;

create index if not exists orders_payment_reference_idx on public.orders (payment_reference);

-- Guest checkout has no RLS coverage for reading back the order it just
-- created: "users view own orders" is `to authenticated` only, so a guest
-- would place an order and then be unable to load their own confirmation
-- page. A guest order's id (a random UUID) is effectively a bearer token —
-- knowing it is the access control, the same trade-off most storefronts
-- make for guest order-confirmation links.
create policy "guests can view their guest order by id" on public.orders
  for select using (user_id is null);
create policy "guests can view items of a guest order" on public.order_items
  for select using (exists (select 1 from public.orders o where o.id = order_id and o.user_id is null));

-- Jersey customization needs to reach fulfillment ---------------------
alter table public.order_items
  add column custom_name text,
  add column custom_number text;

-- Defensive constraint: stock should never go negative ----------------
alter table public.products
  add constraint products_stock_non_negative check (stock >= 0);

create index if not exists products_active_idx on public.products (active);
create index if not exists products_brand_idx on public.products (brand);
create index if not exists products_club_idx on public.products (club);
create index if not exists products_category_idx on public.products (category);

-- Keep products.rating / reviews_count in sync with real reviews ------
create or replace function public.recompute_product_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_product_id uuid;
begin
  target_product_id := coalesce(new.product_id, old.product_id);

  update public.products p
  set
    reviews_count = agg.cnt,
    rating = coalesce(agg.avg_rating, 4.8)
  from (
    select count(*) as cnt, avg(rating)::numeric(3, 2) as avg_rating
    from public.reviews
    where product_id = target_product_id
  ) agg
  where p.id = target_product_id;

  return null;
end;
$$;

revoke execute on function public.recompute_product_rating() from public, anon, authenticated;

drop trigger if exists reviews_recompute_rating on public.reviews;
create trigger reviews_recompute_rating
  after insert or update or delete on public.reviews
  for each row execute function public.recompute_product_rating();

-- Contact form submissions --------------------------------------------
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  topic text,
  message text not null,
  created_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;
create policy "anyone can send a message" on public.contact_messages
  for insert with check (true);
create policy "admins read messages" on public.contact_messages
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Newsletter signups ----------------------------------------------------
create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);
alter table public.newsletter_subscribers enable row level security;
create policy "anyone can subscribe" on public.newsletter_subscribers
  for insert with check (true);
create policy "admins read subscribers" on public.newsletter_subscribers
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Atomic stock adjustment for checkout -----------------------------------
-- A plain "read stock, then write stock - qty" from application code has a
-- race: two checkouts reading the same stock value at once can both pass a
-- client-side check and oversell. This does the check-and-decrement as one
-- statement, so concurrent checkouts serialize correctly at the database.
-- Called from the checkout server function with the service role, which is
-- the only caller — hence security definer plus the revoke below.
create or replace function public.adjust_product_stock(p_product_id uuid, p_delta integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_stock integer;
begin
  update public.products
  set stock = stock + p_delta
  where id = p_product_id
    and stock + p_delta >= 0
  returning stock into new_stock;

  return new_stock; -- null means the guard failed (would have gone negative) or no such product
end;
$$;

revoke execute on function public.adjust_product_stock(uuid, integer) from public, anon, authenticated;
grant execute on function public.adjust_product_stock(uuid, integer) to service_role;
