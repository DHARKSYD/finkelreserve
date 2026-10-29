-- Singleton store configuration. `id boolean primary key default true` with
-- `check (id = true)` is a standard Postgres pattern for enforcing exactly
-- one row: boolean has only two possible values and the check rules one out,
-- so a second insert can never succeed.
--
-- Publicly readable (footer, legal pages, and the root route's SEO head all
-- need it on every page load) — nothing sensitive belongs in this table.
-- Secrets (Paystack keys, service-role key, webhook secrets) live in
-- environment variables, never here or anywhere else in Supabase.
create table public.store_settings (
  id boolean primary key default true,
  check (id = true),

  -- Store identity
  store_name text not null default 'Adika Stakes',
  logo_url text,

  -- Contact — matches what's actually live in src/lib/config.ts today.
  -- Phone and address are genuinely undefined anywhere in the codebase, so
  -- they stay nullable rather than getting invented values.
  support_email text not null default 'adikastakes@gmail.com',
  support_phone text,
  business_address text,
  instagram_url text default 'https://www.instagram.com/adikastakes',
  twitter_url text default 'https://x.com/adikastakes',
  -- YouTube/Facebook were previously just a same-handle guess off
  -- Instagram/Twitter (a comment in Footer.tsx flagged them as
  -- unverified). Since confirmed via search — same "For Collaborations,
  -- contact: adikastakes@gmail.com" bio (matching support_email above)
  -- appears verbatim on both, plus the same adikastakes.store link. Real
  -- page/channel-ID URLs, not the handle format that was guessed before.
  youtube_url text default 'https://www.youtube.com/channel/UCMCNDW3uarK9vwNBaqZ2NbQ',
  facebook_url text default 'https://www.facebook.com/p/Adikastakes-61561816883580/',

  -- Commerce — a default for new-product forms to pre-fill, not a
  -- retroactive change to existing products (those keep their own
  -- products.low_stock_threshold). Currency isn't here: the app is NGN
  -- throughout (formatNGN, Paystack, kobo handling) and isn't actually
  -- switchable, so a "currency" setting would be a toggle with no effect —
  -- exactly what's not supposed to go in this table.
  default_low_stock_threshold integer not null default 5 check (default_low_stock_threshold >= 0),

  -- SEO — matches the current hardcoded defaults in src/routes/__root.tsx.
  seo_title text not null default 'Adika Stakes — Football Jerseys & Streetwear, Made for Naija',
  seo_description text not null default 'Nigeria''s home for football jerseys — club colours, Super Eagles & Super Falcons national team pride, and stadium-ready streetwear.',
  og_image_url text,

  updated_at timestamptz not null default now()
);

alter table public.store_settings enable row level security;

create policy "anyone can read store settings" on public.store_settings
  for select using (true);

create policy "admins update store settings" on public.store_settings
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create trigger touch_store_settings before update on public.store_settings
  for each row execute function public.touch_updated_at();

-- The one and only row.
insert into public.store_settings (id) values (true);
