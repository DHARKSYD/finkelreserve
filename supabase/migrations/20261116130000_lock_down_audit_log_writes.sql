-- Audit trail, part 2 of 2: nobody can write the audit trail through the API.
--
-- THE PROBLEM
--   Any signed-in user could insert activity_log rows directly (the "auth users log activity"
--   policy) and could call log_admin_activity() with any actor id. So an entry, and therefore
--   the numbers on the Team screens, could be forged or pinned on someone else.
--
-- THE FIX
--   Remove those two doors. Every real writer is either a security-definer function or trigger
--   (they run as the database owner) or a server function using the service key, and none of
--   those are affected. Reading stays as it is: admins read the log, nobody edits or deletes it.
--   Safe to run more than once.

drop policy if exists "auth users log activity" on public.activity_log;

revoke insert, update, delete, truncate on public.activity_log from anon, authenticated;

revoke execute on function public.log_admin_activity(text, text, text, uuid, jsonb, uuid)
  from public, anon, authenticated;
