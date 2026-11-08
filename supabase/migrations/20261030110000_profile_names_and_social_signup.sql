-- Separate first/last names on profiles, and a new-user trigger that understands both the
-- email sign-up form and social sign-in (Google, Apple).
--
-- Why
--   · Sign-up now collects first name and last name separately (plus phone and an 18+
--     confirmation) instead of one free-text "Full name".
--   · Google and Apple sign-in create the auth user with whatever the provider shares: Google
--     sends given_name / family_name / full_name / picture; Apple often sends just a full name
--     (and only the first time). The old trigger only looked at metadata `display_name`, so a
--     social user's profile name fell back to the email prefix.
--
-- What it does
--   · profiles gets first_name, last_name and age_confirmed_at.
--   · handle_new_user() fills them from raw_user_meta_data, accepting the form's keys
--     (first_name, last_name, phone, age_confirmed_at) and the providers' keys (given_name,
--     family_name, full_name / name, avatar_url / picture). A lone full name is split on the
--     first space. display_name stays "First Last" (what reviews already show).
--   · Existing profiles whose display_name clearly has two or more words get first/last
--     back-filled; single-word names are left alone rather than guessed at.
--
-- Safe to run more than once.

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists age_confirmed_at timestamptz;

comment on column public.profiles.age_confirmed_at is
  'When the customer ticked "I am 18 or older" at sign-up (alcohol retailer). Null for social sign-ups, who confirm at checkout.';

-- Best-effort back-fill, only where there is a space to split on.
update public.profiles
set first_name = split_part(btrim(display_name), ' ', 1),
    last_name  = nullif(btrim(substr(btrim(display_name), length(split_part(btrim(display_name), ' ', 1)) + 1)), '')
where first_name is null
  and last_name is null
  and display_name is not null
  and btrim(display_name) like '% %';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_first text := nullif(btrim(coalesce(meta->>'first_name', meta->>'given_name', '')), '');
  v_last  text := nullif(btrim(coalesce(meta->>'last_name',  meta->>'family_name', '')), '');
  v_full  text := nullif(btrim(coalesce(meta->>'full_name',  meta->>'name', '')), '');
  v_display text;
  v_age timestamptz;
begin
  -- A provider that only gave us one name: split it on the first space.
  if v_first is null and v_full is not null then
    v_first := split_part(v_full, ' ', 1);
    v_last := coalesce(v_last, nullif(btrim(substr(v_full, length(v_first) + 1)), ''));
  end if;

  -- Last resort is the email prefix — except Apple's private-relay addresses, whose prefix is a
  -- random string that would show publicly on reviews.
  v_display := coalesce(
    nullif(btrim(concat_ws(' ', v_first, v_last)), ''),
    nullif(btrim(meta->>'display_name'), ''),
    case when new.email ilike '%@privaterelay.appleid.com' then 'Customer'
         else split_part(new.email, '@', 1) end
  );

  -- Only trust a well-formed timestamp from the sign-up form; anything else is ignored.
  begin
    v_age := (meta->>'age_confirmed_at')::timestamptz;
  exception when others then
    v_age := null;
  end;

  insert into public.profiles (id, display_name, first_name, last_name, phone, avatar_url, age_confirmed_at)
  values (
    new.id,
    v_display,
    v_first,
    v_last,
    nullif(btrim(coalesce(meta->>'phone', '')), ''),
    coalesce(nullif(meta->>'avatar_url', ''), nullif(meta->>'picture', '')),
    v_age
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
