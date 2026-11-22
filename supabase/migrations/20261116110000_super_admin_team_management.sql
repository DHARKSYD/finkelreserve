-- Super admin, step 2 of 2: let a super admin watch and manage the other admins.
--
-- Run 20261116100000_super_admin_role.sql first (a new enum value cannot be used in the
-- transaction that adds it). This file is safe to run more than once.
--
-- WHAT THIS DOES
--   1. Closes a privilege-escalation hole. Until now the "admins manage roles" policy let ANY
--      admin grant or revoke ANY role, including the owner's. After this migration nobody can
--      write user_roles through the API. Roles change only through the functions in section 6
--      (super admin only) or through privileged SQL.
--   2. Adds admin_members, the team register: status, who added the person, a private note.
--   3. Adds guard rails in SQL, not only in the UI: you cannot act on yourself, you cannot act
--      on another super admin, and the last super admin cannot be removed.
--   4. Adds read functions for the Team screens (team list, performance, activity feed, daily
--      chart) and write functions (grant, suspend, reactivate, remove, note). Every role change
--      is written to activity_log with type 'team'.
--
-- CREATING THE FIRST SUPER ADMIN (one time, in the Supabase SQL editor, never through the UI):
--   insert into public.user_roles (user_id, role)
--   select id, 'admin' from auth.users where email = 'owner@example.com'
--   on conflict (user_id, role) do nothing;
--   insert into public.user_roles (user_id, role)
--   select id, 'super_admin' from auth.users where email = 'owner@example.com'
--   on conflict (user_id, role) do nothing;
-- A super admin must ALSO hold the admin role, because every existing policy and the
-- requireAdmin() check look for 'admin'.
--
-- WHAT THE NUMBERS MEAN, AND THEIR LIMITS
--   Performance is computed from data that already exists: activity_log (admin action types
--   only, only entries written by team members, only after they joined the team),
--   refunds.actor_id and inventory_movements.actor_id.
--   activity_log also holds customer events. Entries without an entity_type (orders placed,
--   account deletions) and types such as return_requested are never counted.
--   Price edits are not written to the audit trail today, so they cannot be flagged.
--   The refund and inventory columns are written only by trusted server functions. The
--   activity_log columns are only as trustworthy as the audit trail itself.

-- ---------------------------------------------------------------------------------------------
-- 1. Small pure helpers (internal, not callable from the API)
-- ---------------------------------------------------------------------------------------------

-- The activity_log types that count as an admin action.
create or replace function public.admin_action_types()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array[
    'product', 'order', 'payment', 'review', 'inventory', 'promotion',
    'return_status_changed', 'refund_retried', 'team'
  ]::text[]
$$;

-- Groups the raw types into the categories shown on the Team screens.
create or replace function public.admin_action_category(p_type text)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_type
    when 'order' then 'orders'
    when 'return_status_changed' then 'returns'
    when 'payment' then 'payments'
    when 'refund_retried' then 'payments'
    when 'product' then 'products'
    when 'inventory' then 'inventory'
    when 'promotion' then 'promotions'
    when 'review' then 'reviews'
    when 'team' then 'team'
    else 'other'
  end
$$;

-- Refunds at or above this many naira are flagged for review. To change it, replace this
-- function in a new migration, and change LARGE_REFUND_NGN in src/lib/queries/team.ts to match
-- (the Team screen quotes the amount in its footnote).
create or replace function public.admin_large_refund_threshold()
returns numeric
language sql
immutable
set search_path = public
as $$ select 100000::numeric $$;

-- An entry is "sensitive" when it deserves a second pair of eyes: a deletion, a new coupon,
-- any change to the team, or a large refund.
create or replace function public.admin_is_sensitive(p_type text, p_message text, p_metadata jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    coalesce(p_message like 'Deleted %', false)
    or (p_type = 'promotion' and coalesce(p_message like 'Created coupon%', false))
    or p_type = 'team'
    or (
      p_type = 'payment'
      and coalesce(p_metadata ->> 'amount', '') ~ '^[0-9]+(\.[0-9]+)?$'
      and (p_metadata ->> 'amount')::numeric >= public.admin_large_refund_threshold()
      and coalesce(p_metadata ->> 'status', '') <> 'failed'
    )
$$;

-- ---------------------------------------------------------------------------------------------
-- 2. user_roles: nobody writes through the API any more
-- ---------------------------------------------------------------------------------------------

drop policy if exists "users read own roles" on public.user_roles;
drop policy if exists "admins manage roles" on public.user_roles;
drop policy if exists "super admins read all roles" on public.user_roles;

create policy "users read own roles" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);

create policy "super admins read all roles" on public.user_roles
  for select to authenticated using (public.has_role(auth.uid(), 'super_admin'));

-- No insert, update or delete policy on purpose. Belt and braces: also remove the privileges,
-- so a policy added by mistake later still cannot open writes to the API roles.
revoke insert, update, delete, truncate on public.user_roles from anon, authenticated;
revoke all on public.user_roles from anon;

-- The last super admin can never be removed or demoted, by any writer (including SQL and the
-- cascade that runs when an auth user is deleted). To rotate the owner, add the new super
-- admin first, then remove the old one.
create or replace function public.guard_last_super_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'super_admin'
     and (tg_op = 'DELETE' or new.role is distinct from old.role or new.user_id is distinct from old.user_id)
     and not exists (
       select 1 from public.user_roles r where r.role = 'super_admin' and r.id <> old.id
     ) then
    raise exception 'The last super admin cannot be removed';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists user_roles_guard_last_super_admin on public.user_roles;
create trigger user_roles_guard_last_super_admin
  before update or delete on public.user_roles
  for each row execute function public.guard_last_super_admin();

-- ---------------------------------------------------------------------------------------------
-- 3. admin_members: the team register
-- ---------------------------------------------------------------------------------------------

create table if not exists public.admin_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'suspended', 'removed')),
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now(),
  note text,
  updated_at timestamptz not null default now()
);

alter table public.admin_members enable row level security;

drop policy if exists "super admins read admin members" on public.admin_members;
create policy "super admins read admin members" on public.admin_members
  for select to authenticated using (public.has_role(auth.uid(), 'super_admin'));

-- Read only for the API. Writes happen through the functions below and privileged SQL.
revoke all on public.admin_members from anon, authenticated;
grant select on public.admin_members to authenticated;

-- Everyone who holds an admin or super admin role today joins the register. Their start date is
-- the date the first of those roles was granted.
insert into public.admin_members (user_id, status, added_by, added_at)
select r.user_id, 'active', null, min(r.created_at)
from public.user_roles r
where r.role in ('admin', 'super_admin')
group by r.user_id
on conflict (user_id) do nothing;

-- Keep the register in step when a role is granted by any route (for example the SQL editor).
create or replace function public.sync_admin_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role in ('admin', 'super_admin') then
    insert into public.admin_members (user_id, status, added_by, added_at)
    values (new.user_id, 'active', auth.uid(), now())
    on conflict (user_id) do update
      set status = 'active', updated_at = now()
      where public.admin_members.status <> 'active';
  end if;
  return new;
end;
$$;

drop trigger if exists user_roles_sync_admin_member on public.user_roles;
create trigger user_roles_sync_admin_member
  after insert on public.user_roles
  for each row execute function public.sync_admin_member();

-- If the admin role row disappears by any route, the register must not keep saying "active".
create or replace function public.mark_admin_member_removed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.admin_members
  set status = 'removed', updated_at = now()
  where user_id = old.user_id and status = 'active';
  return old;
end;
$$;

drop trigger if exists user_roles_mark_member_removed on public.user_roles;
create trigger user_roles_mark_member_removed
  after delete on public.user_roles
  for each row
  when (old.role = 'admin')
  execute function public.mark_admin_member_removed();

-- ---------------------------------------------------------------------------------------------
-- 4. Internal helpers used by the functions below
-- ---------------------------------------------------------------------------------------------

-- Raises unless the caller is a signed-in super admin who also still holds the admin role.
create or replace function public.assert_super_admin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
     or not public.has_role(auth.uid(), 'super_admin')
     or not public.has_role(auth.uid(), 'admin') then
    raise exception 'Super admin only' using errcode = '42501';
  end if;
end;
$$;

-- A readable name for a person: first and last name, else display name, else the email prefix.
create or replace function public.admin_member_name(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''),
    nullif(btrim(p.display_name), ''),
    split_part(u.email, '@', 1)
  )
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = p_user
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. Read functions (super admin only, checked inside)
-- ---------------------------------------------------------------------------------------------

-- The team: one row per person who is or was an admin.
create or replace function public.admin_team()
returns table (
  user_id uuid,
  email text,
  full_name text,
  is_super_admin boolean,
  has_admin_role boolean,
  status text,
  added_at timestamptz,
  added_by uuid,
  added_by_name text,
  note text,
  last_sign_in_at timestamptz,
  last_action_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  perform public.assert_super_admin();

  return query
  select
    m.user_id,
    u.email::text,
    public.admin_member_name(m.user_id),
    exists (select 1 from public.user_roles r where r.user_id = m.user_id and r.role = 'super_admin'),
    exists (select 1 from public.user_roles r where r.user_id = m.user_id and r.role = 'admin'),
    m.status,
    m.added_at,
    m.added_by,
    public.admin_member_name(m.added_by),
    m.note,
    u.last_sign_in_at,
    greatest(
      (select max(a.created_at) from public.activity_log a
        where a.user_id = m.user_id and a.entity_type is not null
          and a.type = any (public.admin_action_types()) and a.created_at >= m.added_at),
      (select max(rf.created_at) from public.refunds rf
        where rf.actor_id = m.user_id and rf.created_at >= m.added_at),
      (select max(im.created_at) from public.inventory_movements im
        where im.actor_id = m.user_id and im.created_at >= m.added_at)
    )
  from public.admin_members m
  join auth.users u on u.id = m.user_id
  order by
    case m.status when 'active' then 0 when 'suspended' then 1 else 2 end,
    m.added_at;
end;
$$;

-- Per-person numbers for a period (p_from inclusive, p_to exclusive).
create or replace function public.admin_performance(p_from timestamptz, p_to timestamptz)
returns table (
  user_id uuid,
  total_actions integer,
  orders_handled integer,
  returns_approved integer,
  returns_rejected integer,
  returns_completed integer,
  returns_actions integer,
  payment_actions integer,
  product_actions integer,
  inventory_actions integer,
  promotion_actions integer,
  review_actions integer,
  team_actions integer,
  refunds_count integer,
  refunds_value numeric,
  inventory_changes integer,
  inventory_units_adjusted bigint,
  returns_first_actions integer,
  avg_return_response_hours numeric,
  sensitive_actions integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  perform public.assert_super_admin();
  if p_from is null or p_to is null or p_to <= p_from then
    raise exception 'Choose a valid date range';
  end if;

  return query
  with members as (
    select m.user_id, m.added_at from public.admin_members m
  ),
  acts as (
    select a.user_id, a.type, a.message, a.metadata
    from public.activity_log a
    join members m on m.user_id = a.user_id
    where a.entity_type is not null
      and a.type = any (public.admin_action_types())
      and a.created_at >= greatest(p_from, m.added_at)
      and a.created_at < p_to
  ),
  act_counts as (
    select
      x.user_id,
      count(*)::integer as total,
      count(*) filter (where x.type = 'order')::integer as orders,
      count(*) filter (where x.type = 'return_status_changed' and x.metadata ->> 'to' = 'approved')::integer as approved,
      count(*) filter (where x.type = 'return_status_changed' and x.metadata ->> 'to' = 'rejected')::integer as rejected,
      count(*) filter (where x.type = 'return_status_changed' and x.metadata ->> 'to' = 'completed')::integer as completed,
      count(*) filter (where x.type = 'return_status_changed')::integer as returns_all,
      count(*) filter (where public.admin_action_category(x.type) = 'payments')::integer as payments,
      count(*) filter (where x.type = 'product')::integer as products,
      count(*) filter (where x.type = 'inventory')::integer as inventory,
      count(*) filter (where x.type = 'promotion')::integer as promotions,
      count(*) filter (where x.type = 'review')::integer as reviews,
      count(*) filter (where x.type = 'team')::integer as team,
      count(*) filter (where public.admin_is_sensitive(x.type, x.message, x.metadata))::integer as sensitive
    from acts x
    group by x.user_id
  ),
  refund_counts as (
    select rf.actor_id as user_id, count(*)::integer as cnt, coalesce(sum(rf.amount), 0) as val
    from public.refunds rf
    join members m on m.user_id = rf.actor_id
    where rf.status in ('pending', 'processed')
      and rf.created_at >= greatest(p_from, m.added_at)
      and rf.created_at < p_to
    group by rf.actor_id
  ),
  inv_counts as (
    select im.actor_id as user_id, count(*)::integer as cnt, coalesce(sum(abs(im.delta)), 0)::bigint as units
    from public.inventory_movements im
    join members m on m.user_id = im.actor_id
    where im.created_at >= greatest(p_from, m.added_at)
      and im.created_at < p_to
    group by im.actor_id
  ),
  first_actions as (
    select distinct on (a.entity_id) a.entity_id as return_id, a.user_id, a.created_at as acted_at
    from public.activity_log a
    join members m on m.user_id = a.user_id
    where a.type = 'return_status_changed'
      and a.entity_type = 'return'
      and a.entity_id is not null
      and a.created_at >= m.added_at
    order by a.entity_id, a.created_at asc, a.id asc
  ),
  response as (
    select
      f.user_id,
      count(*)::integer as cnt,
      round(avg(extract(epoch from (f.acted_at - rr.created_at)) / 3600.0)::numeric, 1) as avg_hours
    from first_actions f
    join public.return_requests rr on rr.id = f.return_id
    where f.acted_at >= p_from and f.acted_at < p_to
    group by f.user_id
  )
  select
    m.user_id,
    coalesce(c.total, 0),
    coalesce(c.orders, 0),
    coalesce(c.approved, 0),
    coalesce(c.rejected, 0),
    coalesce(c.completed, 0),
    coalesce(c.returns_all, 0),
    coalesce(c.payments, 0),
    coalesce(c.products, 0),
    coalesce(c.inventory, 0),
    coalesce(c.promotions, 0),
    coalesce(c.reviews, 0),
    coalesce(c.team, 0),
    coalesce(rc.cnt, 0),
    coalesce(rc.val, 0),
    coalesce(ic.cnt, 0),
    coalesce(ic.units, 0)::bigint,
    coalesce(rs.cnt, 0),
    rs.avg_hours,
    coalesce(c.sensitive, 0)
  from members m
  left join act_counts c on c.user_id = m.user_id
  left join refund_counts rc on rc.user_id = m.user_id
  left join inv_counts ic on ic.user_id = m.user_id
  left join response rs on rs.user_id = m.user_id
  order by coalesce(c.total, 0) desc, m.user_id;
end;
$$;

-- The audit feed. p_user filters to one person, p_type to one category (orders, returns,
-- payments, products, inventory, promotions, reviews, team) or to 'sensitive'. p_before is a
-- cursor: pass the created_at of the last row you already have to get the next page.
create or replace function public.admin_activity_feed(
  p_user uuid default null,
  p_type text default null,
  p_before timestamptz default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  user_id uuid,
  actor_name text,
  category text,
  type text,
  message text,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz,
  sensitive boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  perform public.assert_super_admin();

  return query
  select
    a.id,
    a.user_id,
    public.admin_member_name(a.user_id),
    public.admin_action_category(a.type),
    a.type,
    a.message,
    a.entity_type,
    a.entity_id,
    a.metadata,
    a.created_at,
    public.admin_is_sensitive(a.type, a.message, a.metadata)
  from public.activity_log a
  join public.admin_members m on m.user_id = a.user_id
  where a.entity_type is not null
    and a.type = any (public.admin_action_types())
    and a.created_at >= m.added_at
    and (p_user is null or a.user_id = p_user)
    and (p_before is null or a.created_at < p_before)
    and (
      p_type is null
      or (p_type = 'sensitive' and public.admin_is_sensitive(a.type, a.message, a.metadata))
      or (p_type <> 'sensitive' and public.admin_action_category(a.type) = p_type)
    )
  order by a.created_at desc, a.id desc
  limit v_limit;
end;
$$;

-- One row per day (Lagos time) for the activity chart. p_user null means the whole team.
create or replace function public.admin_daily_activity(
  p_user uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (day date, actions integer)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  perform public.assert_super_admin();
  if p_from is null or p_to is null or p_to <= p_from then
    raise exception 'Choose a valid date range';
  end if;
  if p_to - p_from > interval '366 days' then
    raise exception 'Choose a range of one year or less';
  end if;

  return query
  with days as (
    select g::date as day
    from generate_series(
      (p_from at time zone 'Africa/Lagos')::date,
      ((p_to - interval '1 second') at time zone 'Africa/Lagos')::date,
      interval '1 day'
    ) g
  ),
  counts as (
    select (a.created_at at time zone 'Africa/Lagos')::date as day, count(*)::integer as n
    from public.activity_log a
    join public.admin_members m on m.user_id = a.user_id
    where a.entity_type is not null
      and a.type = any (public.admin_action_types())
      and a.created_at >= greatest(p_from, m.added_at)
      and a.created_at < p_to
      and (p_user is null or a.user_id = p_user)
    group by 1
  )
  select d.day, coalesce(c.n, 0)
  from days d
  left join counts c on c.day = d.day
  order by d.day;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 6. Write functions (super admin only, checked inside). Their messages are shown to the user.
-- ---------------------------------------------------------------------------------------------

-- Give an existing, email-confirmed account the admin role.
create or replace function public.admin_grant(p_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_user uuid;
  v_confirmed timestamptz;
begin
  perform public.assert_super_admin();

  if v_email = '' or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter a valid email address';
  end if;

  select u.id, u.email_confirmed_at into v_user, v_confirmed
  from auth.users u
  where lower(u.email) = v_email
  limit 1;

  if v_user is null then
    raise exception 'No account uses that email. They need to sign up first';
  end if;
  if v_confirmed is null then
    raise exception 'That account has not confirmed its email yet';
  end if;
  if v_user = auth.uid() then
    raise exception 'You cannot change your own access';
  end if;
  if exists (select 1 from public.user_roles r where r.user_id = v_user and r.role = 'super_admin') then
    raise exception 'That account is a super admin already';
  end if;
  if exists (select 1 from public.user_roles r where r.user_id = v_user and r.role = 'admin') then
    raise exception 'That account is already an admin';
  end if;

  -- The user_roles trigger creates, or reactivates, the admin_members row.
  insert into public.user_roles (user_id, role) values (v_user, 'admin');

  perform public.log_admin_activity(
    'team',
    'Granted admin access to ' || v_email,
    'admin_member',
    v_user,
    jsonb_build_object('action', 'grant', 'email', v_email)
  );

  return v_user;
end;
$$;

-- Suspend, remove or reactivate an admin. Suspending or removing takes the admin role away at
-- once, so they are locked out of every admin screen and every admin database policy.
create or replace function public.admin_set_status(p_user uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old text;
  v_email text;
  v_verb text;
begin
  perform public.assert_super_admin();

  if p_status is null or p_status not in ('active', 'suspended', 'removed') then
    raise exception 'Unknown status';
  end if;
  if p_user is null or p_user = auth.uid() then
    raise exception 'You cannot change your own access';
  end if;
  if exists (select 1 from public.user_roles r where r.user_id = p_user and r.role = 'super_admin') then
    raise exception 'Super admins cannot be changed here';
  end if;

  select m.status into v_old
  from public.admin_members m
  where m.user_id = p_user
  for update;

  if not found then
    raise exception 'That person is not on the admin team';
  end if;
  if v_old = p_status then
    return;
  end if;

  if p_status = 'active' then
    insert into public.user_roles (user_id, role) values (p_user, 'admin')
    on conflict (user_id, role) do nothing;
  else
    delete from public.user_roles r where r.user_id = p_user and r.role = 'admin';
  end if;

  update public.admin_members m
  set status = p_status, updated_at = now()
  where m.user_id = p_user;

  select u.email into v_email from auth.users u where u.id = p_user;
  v_verb := case p_status when 'active' then 'Reactivated' when 'suspended' then 'Suspended' else 'Removed' end;

  perform public.log_admin_activity(
    'team',
    v_verb || ' admin ' || coalesce(v_email, p_user::text),
    'admin_member',
    p_user,
    jsonb_build_object('action', 'set_status', 'from', v_old, 'to', p_status)
  );
end;
$$;

-- A private note about a team member. Only super admins can read or write it.
create or replace function public.admin_set_note(p_user uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  perform public.assert_super_admin();

  if p_user is null or p_user = auth.uid() then
    raise exception 'You cannot add a note about yourself';
  end if;
  if exists (select 1 from public.user_roles r where r.user_id = p_user and r.role = 'super_admin') then
    raise exception 'Super admins cannot be changed here';
  end if;
  if v_note is not null and char_length(v_note) > 2000 then
    raise exception 'Keep the note under 2000 characters';
  end if;

  update public.admin_members m
  set note = v_note, updated_at = now()
  where m.user_id = p_user;

  if not found then
    raise exception 'That person is not on the admin team';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 7. Who may call what
-- ---------------------------------------------------------------------------------------------

-- Internal helpers and trigger functions: nobody calls these through the API.
revoke execute on function public.admin_action_types() from public, anon, authenticated;
revoke execute on function public.admin_action_category(text) from public, anon, authenticated;
revoke execute on function public.admin_large_refund_threshold() from public, anon, authenticated;
revoke execute on function public.admin_is_sensitive(text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.assert_super_admin() from public, anon, authenticated;
revoke execute on function public.admin_member_name(uuid) from public, anon, authenticated;
revoke execute on function public.guard_last_super_admin() from public, anon, authenticated;
revoke execute on function public.sync_admin_member() from public, anon, authenticated;
revoke execute on function public.mark_admin_member_removed() from public, anon, authenticated;

-- The Team screens call these as the signed-in user. Each one checks super admin inside.
revoke execute on function public.admin_team() from public, anon;
revoke execute on function public.admin_performance(timestamptz, timestamptz) from public, anon;
revoke execute on function public.admin_activity_feed(uuid, text, timestamptz, integer) from public, anon;
revoke execute on function public.admin_daily_activity(uuid, timestamptz, timestamptz) from public, anon;
revoke execute on function public.admin_grant(text) from public, anon;
revoke execute on function public.admin_set_status(uuid, text) from public, anon;
revoke execute on function public.admin_set_note(uuid, text) from public, anon;

grant execute on function public.admin_team() to authenticated;
grant execute on function public.admin_performance(timestamptz, timestamptz) to authenticated;
grant execute on function public.admin_activity_feed(uuid, text, timestamptz, integer) to authenticated;
grant execute on function public.admin_daily_activity(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.admin_grant(text) to authenticated;
grant execute on function public.admin_set_status(uuid, text) to authenticated;
grant execute on function public.admin_set_note(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 8. Indexes for the per-person feed and metrics
-- ---------------------------------------------------------------------------------------------

create index if not exists activity_log_user_created_idx
  on public.activity_log (user_id, created_at desc);

create index if not exists refunds_actor_created_idx
  on public.refunds (actor_id, created_at desc);

create index if not exists inventory_movements_actor_created_idx
  on public.inventory_movements (actor_id, created_at desc);
