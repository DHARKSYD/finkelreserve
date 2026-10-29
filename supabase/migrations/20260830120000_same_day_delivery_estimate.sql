-- The seeded "Standard Delivery" rate (20260816090000_shipping.sql) carried
-- forward the adikastakes jersey business's estimate of 2-7 business days
-- unexamined. That's not just stale prose — it's the live data the
-- shipping-rates table (and therefore the cart, checkout, and shipping
-- policy page) actually displays, and it directly contradicts the
-- confirmed same-day/next-day delivery capability. 0 = same-day.
update public.shipping_rates
set estimated_days_min = 0, estimated_days_max = 1
where name = 'Standard Delivery' and estimated_days_min = 2 and estimated_days_max = 7;
