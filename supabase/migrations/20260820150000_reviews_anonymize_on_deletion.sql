-- Business decision (see this session's brief): a deleted customer's reviews
-- should stay — rating, text, and product association are useful social
-- proof — but the identity behind them shouldn't remain linked. This was
-- `on delete cascade`, so account deletion was silently deleting reviews
-- outright; changing it to the same detach-don't-destroy pattern used for
-- orders/return_requests/refunds elsewhere in this schema.
--
-- No new column, no application code change needed: reviews.ts's
-- attachNames() already falls back to "Adika Stakes customer" whenever a
-- review's user_id doesn't resolve to a profile (originally written for
-- data-integrity edge cases, but it's exactly the right behavior here too)
-- — so a null user_id after this migration degrades gracefully with zero
-- other changes. Deliberately not adding a frozen name snapshot on top of
-- that: the brief said not to unnecessarily rewrite the review system, and
-- "no longer exposed" is satisfied by the generic fallback without one.
--
-- Constraint name looked up rather than hardcoded, same reasoning as the
-- return_requests fix — this can't be dry-run against the live project
-- from this environment.
do $$
declare
  fk_name text;
begin
  select tc.constraint_name into fk_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'reviews'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'user_id';

  if fk_name is not null then
    execute format('alter table public.reviews drop constraint %I', fk_name);
  end if;

  alter table public.reviews alter column user_id drop not null;

  alter table public.reviews
    add constraint reviews_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete set null;
end $$;
