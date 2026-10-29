
-- Pin search_path on functions
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end; $$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- Lock down public execute on security-definer helpers
revoke execute on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- Tighten permissive INSERT policies
drop policy if exists "anyone create orders" on public.orders;
create policy "create order as self or guest" on public.orders for insert
  with check (user_id is null or auth.uid() = user_id);

drop policy if exists "anyone create order items" on public.order_items;
create policy "create order items for accessible order" on public.order_items for insert
  with check (exists (
    select 1 from public.orders o where o.id = order_id
      and (o.user_id is null or o.user_id = auth.uid())
  ));

drop policy if exists "anyone log activity" on public.activity_log;
create policy "auth users log activity" on public.activity_log for insert to authenticated
  with check (user_id is null or user_id = auth.uid());
