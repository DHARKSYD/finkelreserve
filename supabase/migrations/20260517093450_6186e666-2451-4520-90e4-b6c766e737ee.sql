
-- Roles enum and table
create type public.app_role as enum ('admin', 'moderator', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "users read own roles" on public.user_roles
  for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "admins manage roles" on public.user_roles
  for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles readable by all" on public.profiles for select using (true);
create policy "users update own profile" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "users insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Products (admin-managed catalog)
create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  details text,
  price numeric not null,
  old_price numeric,
  category text not null,
  brand text not null,
  league text,
  club text,
  images text[] not null default '{}',
  sizes text[] not null default '{}',
  colors text[] not null default '{}',
  badge text,
  rating numeric not null default 4.8,
  reviews_count integer not null default 0,
  highlights text[],
  material text,
  fit text,
  stock integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.products enable row level security;
create policy "products readable by all" on public.products for select using (active = true or public.has_role(auth.uid(), 'admin'));
create policy "admins manage products" on public.products for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Reviews (one per user per product)
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  rating smallint not null check (rating between 1 and 5),
  title text,
  text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, user_id)
);
alter table public.reviews enable row level security;
create policy "reviews readable by all" on public.reviews for select using (true);
create policy "users create own review" on public.reviews for insert to authenticated with check (auth.uid() = user_id);
create policy "users update own review" on public.reviews for update to authenticated using (auth.uid() = user_id);
create policy "users delete own review" on public.reviews for delete to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

-- Orders
create type public.order_status as enum ('pending', 'processing', 'shipped', 'delivered', 'cancelled');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  shipping_address text not null,
  subtotal numeric not null,
  shipping numeric not null default 0,
  discount numeric not null default 0,
  total numeric not null,
  status order_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.orders enable row level security;
create policy "users view own orders" on public.orders for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "anyone create orders" on public.orders for insert with check (true);
create policy "admins update orders" on public.orders for update to authenticated using (public.has_role(auth.uid(), 'admin'));

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  image text,
  size text,
  color text,
  price numeric not null,
  qty integer not null
);
alter table public.order_items enable row level security;
create policy "order items follow orders" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))));
create policy "anyone create order items" on public.order_items for insert with check (true);

-- Activity log
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  type text not null,
  message text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);
alter table public.activity_log enable row level security;
create policy "admins read activity" on public.activity_log for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "anyone log activity" on public.activity_log for insert with check (true);

-- updated_at trigger helper
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger touch_products before update on public.products for each row execute function public.touch_updated_at();
create trigger touch_reviews before update on public.reviews for each row execute function public.touch_updated_at();
create trigger touch_orders before update on public.orders for each row execute function public.touch_updated_at();
create trigger touch_profiles before update on public.profiles for each row execute function public.touch_updated_at();
