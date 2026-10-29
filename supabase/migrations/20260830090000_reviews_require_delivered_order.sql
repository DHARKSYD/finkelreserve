-- Closes a real gap: "users create own review" only checked that a
-- reviewer wasn't impersonating someone else (auth.uid() = user_id) — it
-- never checked they'd actually bought the product, let alone received
-- it. Any signed-in account could review any product with zero purchase
-- history. This replaces that policy with one that additionally requires
-- a delivered order containing the product being reviewed.
--
-- Enforced here, at the RLS layer — not just in the UI — because the
-- existing review submission (src/lib/queries/reviews.ts) inserts
-- directly via the client SDK with no server function in front of it.
-- A UI-only check would be trivially bypassed by anyone calling the
-- Supabase REST/insert API directly with a valid session.
drop policy if exists "users create own review" on public.reviews;

create policy "users create review for delivered order" on public.reviews
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.product_id = reviews.product_id
        and o.user_id = auth.uid()
        and o.status = 'delivered'
    )
  );

-- Update ("users update own review") and delete policies are unchanged —
-- they only ever touch a review that already passed this check at
-- creation, so there's nothing new to verify there.
