-- contact_messages and newsletter_subscribers used to accept a direct
-- insert from any client (anon or authenticated) via `with check (true)`,
-- because the form itself had no server-side validation or rate limiting
-- to put in front of it. Both now go through server functions
-- (src/lib/actions/contact.ts) that validate input and rate-limit by IP,
-- using the service-role client — which bypasses RLS by design, so it
-- needs no policy here at all.
--
-- Dropping the old insert policies closes the gap those server functions
-- would otherwise not actually close: without this, anyone could still
-- reach the table directly through Supabase's REST API with the public
-- anon key, skipping the new validation and rate limiting entirely.
drop policy if exists "anyone can send a message" on public.contact_messages;
drop policy if exists "anyone can subscribe" on public.newsletter_subscribers;

-- Defense-in-depth length bounds. Application-level validation (Zod, in the
-- server functions) is the primary check and gives better error messages —
-- these are a backstop in case a future code path ever writes to these
-- tables without going through it. Added `not valid` so this can't fail
-- against any pre-existing rows that predate the app-level limits; run
-- `alter table ... validate constraint ...` later once you've confirmed
-- nothing violates them.
alter table public.contact_messages
  add constraint contact_messages_name_length check (char_length(name) <= 100) not valid,
  add constraint contact_messages_email_length check (char_length(email) <= 200) not valid,
  add constraint contact_messages_message_length check (char_length(message) <= 5000) not valid;

alter table public.reviews
  add constraint reviews_text_length check (char_length(text) <= 2000) not valid;
