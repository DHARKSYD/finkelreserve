-- ─────────────────────────────────────────────────────────────────
-- Product Customization — one generic, admin-configurable model for
-- Name, Number, and Patches (and anything added later), replacing the
-- hardcoded CUSTOMIZATION_FEE_NGN flat fee + isJersey gate.
--
-- custom_name/custom_number on order_items (added months ago in the
-- payments_reviews_contact migration) are NOT touched or reinterpreted —
-- every existing order keeps displaying exactly as it does today. New
-- orders keep populating them too (backward-compat value snapshot, no
-- pricing attached), alongside the new custom_selections column below,
-- which is the actual, structured, self-contained, generic snapshot —
-- see the comment above that column for the exact reasoning.
-- ─────────────────────────────────────────────────────────────────

-- Admin-configured catalog of customization kinds, reusable across
-- products. 'text' covers Name/Number-shaped input; 'select_many' covers
-- Patches-shaped input (zero or more priced choices). Not adding a
-- speculative third kind ('select_one' etc.) — nothing needs it yet, and
-- extending this CHECK later if something does is a one-line migration,
-- not a rewrite.
create table public.customization_types (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  input_kind text not null check (input_kind in ('text', 'select_many')),
  -- text:        { feeNgn: number, maxLength: number, numericOnly: boolean }
  -- select_many: { minSelections: number, maxSelections: number | null }
  --              (each choice is priced individually — see customization_choices)
  config jsonb not null default '{}',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.customization_types enable row level security;

create policy "customization types readable by all" on public.customization_types for select
  using (active = true or public.has_role(auth.uid(), 'admin'));
create policy "admins manage customization types" on public.customization_types for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create trigger touch_customization_types before update on public.customization_types
  for each row execute function public.touch_updated_at();

-- Priced choices for select_many types (e.g. individual patches).
create table public.customization_choices (
  id uuid primary key default gen_random_uuid(),
  customization_type_id uuid references public.customization_types(id) on delete cascade not null,
  label text not null,
  price_ngn numeric not null default 0 check (price_ngn >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customization_choices_type_idx on public.customization_choices(customization_type_id);
alter table public.customization_choices enable row level security;

create policy "customization choices readable by all" on public.customization_choices for select
  using (active = true or public.has_role(auth.uid(), 'admin'));
create policy "admins manage customization choices" on public.customization_choices for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create trigger touch_customization_choices before update on public.customization_choices
  for each row execute function public.touch_updated_at();

-- Which types apply to which product (not every product offers every
-- type — a product with no rows here simply isn't customizable).
create table public.product_customization_types (
  product_id uuid references public.products(id) on delete cascade not null,
  customization_type_id uuid references public.customization_types(id) on delete cascade not null,
  required boolean not null default false,
  sort_order integer not null default 0,
  primary key (product_id, customization_type_id)
);
create index product_customization_types_type_idx on public.product_customization_types(customization_type_id);
alter table public.product_customization_types enable row level security;

-- Mirrors "variants readable by all" on product_variants exactly — same
-- reasoning: a product's own active flag gates visibility of things
-- attached to it, consistently, everywhere.
create policy "product customization types readable by all" on public.product_customization_types
  for select using (
    exists (
      select 1 from public.products p
      where p.id = product_id and (p.active = true or public.has_role(auth.uid(), 'admin'))
    )
  );
create policy "admins manage product customization types" on public.product_customization_types
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- The actual order-item snapshot. Structured and self-contained by design
-- (per the brief): every entry carries its own label, value, and price, so
-- reading it back never needs a join to customization_types/choices —
-- those can change or disappear later without altering what an existing
-- order shows. This is the *authoritative* snapshot going forward;
-- custom_name/custom_number (existing columns, untouched) stay populated
-- alongside it purely for the display code that already reads them.
--
-- Shape: jsonb array of
--   { typeKey: string, typeLabel: string, inputKind: 'text' | 'select_many',
--     value: string | string[], priceNgn: number, choiceIds?: string[] }
-- priceNgn on each entry is that entry's total (e.g. the sum of every
-- selected patch's price, not per-choice) — a reader sums priceNgn across
-- entries for the full customization fee without needing to know the
-- per-kind rules for how that total was derived.
alter table public.order_items add column custom_selections jsonb not null default '[]';

-- Version (2025/26 Home, Retro 1998, Third Kit, ...) is a product
-- attribute, not a customer-selected customization and not a tag — kept
-- structurally separate from both, matching how league/club/brand are
-- already their own columns rather than folded into the tags array.
alter table public.products add column version text;

-- ── Seed: replicate current behavior so nothing goes dark on deploy ──
-- Today: every "jersey" product can take a name and/or number for one
-- flat ₦8,000 (CUSTOMIZATION_FEE_NGN), regardless of which/how many
-- fields are filled. Going forward, Name and Number are priced
-- independently — that's the actual point of making this configurable —
-- so this seed picks reasonable starting numbers (5,000 + 3,000 ≈ the old
-- flat 8,000 for the common case of using both) rather than trying to
-- preserve the old flat-regardless-of-selection quirk exactly. These are
-- editable in the new admin UI immediately; nothing here is meant to be
-- the last word on pricing.
insert into public.customization_types (key, label, input_kind, config, sort_order) values
  ('player_name', 'Player Name', 'text',
    jsonb_build_object('feeNgn', 5000, 'maxLength', 12, 'numericOnly', false), 0),
  ('jersey_number', 'Jersey Number', 'text',
    jsonb_build_object('feeNgn', 3000, 'maxLength', 2, 'numericOnly', true), 1),
  ('patches', 'Patch', 'select_many',
    jsonb_build_object('minSelections', 0, 'maxSelections', null), 2);

insert into public.customization_choices (customization_type_id, label, price_ngn, sort_order)
select id, c.label, c.price_ngn, c.sort_order
from public.customization_types t
cross join (values
  ('Champions League Patch', 1500, 0),
  ('Premier League Patch', 1500, 1),
  ('Cup Patch', 1000, 2)
) as c(label, price_ngn, sort_order)
where t.key = 'patches';

-- Wire every existing jersey to Name + Number (matching today's behavior
-- exactly — every jersey could take a name/number before this migration)
-- and to Patches (new — jerseys are exactly what patches are for, and
-- leaving the type seeded but wired to nothing would make the feature
-- invisible until someone manually enables it product-by-product; a
-- merchandising call to turn it off per-product is a one-click toggle
-- away in the new admin UI, a much smaller ask than the reverse).
insert into public.product_customization_types (product_id, customization_type_id, sort_order)
select p.id, t.id, t.sort_order
from public.products p
cross join public.customization_types t
where p.category = 'jersey';
