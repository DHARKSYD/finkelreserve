-- Fix: logged-out visitors (and server-side rendering) could not read the catalog.
--
-- What was wrong
--   20260517093508 revoked EXECUTE on public.has_role() from public/anon/authenticated and
--   granted it back to `authenticated` only. But the public-read policies on `products`
--   ("products readable by all") and `product_variants` ("variants readable by all") are
--   written  using (active = true or public.has_role(auth.uid(), 'admin'))  with no role
--   clause, so they apply to `anon` too. Postgres checks EXECUTE on every function in a
--   policy expression when it starts the query — even for rows where `active = true` makes
--   the OR irrelevant — so every anonymous read of those tables failed with
--   "permission denied for function has_role".
--
--   Signed-in users were fine (they hold the grant), which hid the problem in testing. The
--   anonymous cases:
--     · the storefront for any logged-out visitor (empty shop, empty homepage);
--     · server-side rendering — a page refresh is always anonymous (the session lives in the
--       browser), so refreshing /product/<slug> looked up the product as `anon`, got an error,
--       and the route's loader turned "no data" into a 404.
--
-- The fix
--   Let `anon` execute has_role, but make the function answer ONLY about the caller:
--   it returns true only when _user_id is the authenticated user making the request. All 45
--   policy uses are has_role(auth.uid(), …) — always the caller — so behaviour for signed-in
--   users is unchanged, and for anonymous callers it is simply false. The original reason for
--   the revoke (the function being callable over the API as a way to ask "is user X an
--   admin?") is kept: asking about anyone other than yourself now always returns false.
--
-- Same signature, so `create or replace` keeps the existing grants; we add the missing one.
-- Safe to run more than once.

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(_user_id = auth.uid(), false)
     and exists (
       select 1 from public.user_roles
       where user_id = _user_id and role = _role
     )
$$;

grant execute on function public.has_role(uuid, public.app_role) to anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
