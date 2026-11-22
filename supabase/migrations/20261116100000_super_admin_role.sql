-- Super admin, step 1 of 2: add the role value.
--
-- A new enum value cannot be used in the same transaction that adds it, so this file does only
-- that. Run it first, then 20261116110000_super_admin_team_management.sql.
-- Safe to run more than once.

alter type public.app_role add value if not exists 'super_admin';
