-- Saved delivery addresses. Simple owned-row CRUD (unlike Returns, nothing
-- here needs cross-table atomicity), so this goes through direct client
-- calls under RLS, same as shipping/settings admin CRUD — not a server
-- function or RPC.
create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  recipient_name text not null,
  phone text not null,
  address_line text not null,
  city text not null,
  state text not null,
  delivery_instructions text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customer_addresses_customer_idx on public.customer_addresses(customer_id);

alter table public.customer_addresses enable row level security;

create policy "customers manage own addresses" on public.customer_addresses for all to authenticated
  using (customer_id = auth.uid()) with check (customer_id = auth.uid());

create trigger touch_customer_addresses before update on public.customer_addresses
  for each row execute function public.touch_updated_at();

-- Trigger rather than a partial unique index on (customer_id) where
-- is_default: a unique index would reject "make this one the new default"
-- until the old default is unset first, forcing two round trips from the
-- client. This unsets any other default for the same customer in the same
-- statement, so "set as default" is a single atomic update either way.
create or replace function public.enforce_single_default_address()
returns trigger language plpgsql as $$
begin
  if new.is_default then
    update public.customer_addresses
    set is_default = false
    where customer_id = new.customer_id and id <> new.id and is_default;
  end if;
  return new;
end;
$$;

create trigger customer_addresses_single_default
  before insert or update on public.customer_addresses
  for each row execute function public.enforce_single_default_address();

-- profiles already exists (from the original schema) with display_name +
-- avatar_url, but nothing in the app used it yet — account.tsx read the
-- name from auth user_metadata instead, and there was no phone field
-- anywhere on the customer's own profile. Reusing the existing table
-- (adding phone) rather than creating a second one.
alter table public.profiles add column phone text;

-- Avatar storage. No bucket existed before this. Public read (avatars need
-- to display in the UI without an auth round-trip) but write/update/delete
-- scoped to the owner's own folder (avatars/{user_id}/...) — a user can
-- only ever touch a path starting with their own ID, not overwrite or
-- delete anyone else's file.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "public read avatars" on storage.objects for select
  using (bucket_id = 'avatars');

create policy "users upload own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users update own avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users delete own avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
