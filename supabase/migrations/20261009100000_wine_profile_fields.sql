-- Structured wine-profile fields for the product page.
--
-- products already carries `description`, `details`, `tasting_notes` and
-- `food_pairing`. A thorough wine page also wants the tasting note broken
-- down the way a sommelier would give it, plus serving, cellaring and
-- "who made it / how" context. All nullable: the product page renders only
-- the sections that are filled in, so a half-written profile degrades
-- gracefully and nothing here is required to publish a wine.

alter table public.products
  add column if not exists appearance text,
  add column if not exists nose text,
  add column if not exists palate text,
  add column if not exists finish text,
  add column if not exists serving_notes text,
  add column if not exists cellaring_notes text,
  add column if not exists producer_notes text,
  add column if not exists winemaking_notes text;

-- These render on public pages, so keep each one a sensible length.
alter table public.products drop constraint if exists products_profile_length;
alter table public.products
  add constraint products_profile_length check (
    char_length(coalesce(appearance, '')) <= 600
    and char_length(coalesce(nose, '')) <= 1200
    and char_length(coalesce(palate, '')) <= 1200
    and char_length(coalesce(finish, '')) <= 800
    and char_length(coalesce(serving_notes, '')) <= 1200
    and char_length(coalesce(cellaring_notes, '')) <= 1200
    and char_length(coalesce(producer_notes, '')) <= 2000
    and char_length(coalesce(winemaking_notes, '')) <= 2000
  );
