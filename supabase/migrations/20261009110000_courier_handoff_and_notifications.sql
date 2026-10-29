-- Courier hand-off + customer notifications.
--
-- 1) Courier hand-off: once a delivery is booked with an outside courier
--    (Glovo, Kwik, an own rider, …) the admin records who has it. These
--    fields feed the customer-facing tracking link and the "on its way"
--    message. Nothing here calls a courier API — see README "Delivery
--    hand-off".
-- 2) Notification consent: captured per order at checkout, because guest
--    checkout means there isn't always an account to hang preferences on.
--    notify_consent_at records when the customer ticked the boxes.
-- 3) notification_log: one row per (order, event, channel). The unique key
--    is what makes sending idempotent — the Paystack webhook and the
--    verify-on-return page can both fire for the same payment, and only
--    the first one gets to send.

alter table public.orders
  add column if not exists notify_email boolean not null default true,
  add column if not exists notify_sms boolean not null default false,
  add column if not exists notify_consent_at timestamptz,
  add column if not exists courier_provider text,
  add column if not exists courier_reference text,
  add column if not exists courier_tracking_url text,
  add column if not exists courier_rider_name text,
  add column if not exists courier_rider_phone text,
  add column if not exists courier_handed_off_at timestamptz;

-- The tracking URL is rendered as a link in the customer's account and in
-- emails/SMS, so only ever allow http(s) (never javascript:/data:).
alter table public.orders drop constraint if exists orders_courier_tracking_url_http;
alter table public.orders
  add constraint orders_courier_tracking_url_http check (
    courier_tracking_url is null or courier_tracking_url ~* '^https?://[^[:space:]]+$'
  );

alter table public.orders drop constraint if exists orders_courier_field_length;
alter table public.orders
  add constraint orders_courier_field_length check (
    char_length(coalesce(courier_provider, '')) <= 40
    and char_length(coalesce(courier_reference, '')) <= 120
    and char_length(coalesce(courier_tracking_url, '')) <= 500
    and char_length(coalesce(courier_rider_name, '')) <= 120
    and char_length(coalesce(courier_rider_phone, '')) <= 40
  );

create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event text not null check (
    event in ('order_placed', 'payment_received', 'out_for_delivery', 'delivered', 'cancelled')
  ),
  channel text not null check (channel in ('email', 'sms')),
  recipient text not null,
  provider text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  provider_message_id text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint notification_log_once_per_event unique (order_id, event, channel)
);

create index if not exists notification_log_order_idx on public.notification_log (order_id);

alter table public.notification_log enable row level security;

-- Written only by the server (service role bypasses RLS); the only reader
-- is the admin screen. No insert/update/delete policies on purpose.
drop policy if exists "admins read notification log" on public.notification_log;
create policy "admins read notification log" on public.notification_log
  for select using (public.has_role(auth.uid(), 'admin'));
