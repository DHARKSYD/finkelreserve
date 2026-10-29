-- store_settings was created by the jersey business this project was forked
-- from, and its column defaults still describe that business ("Adika
-- Stakes — Football Jerseys & Streetwear" as the SEO title, its social
-- links, …). A fresh Finkel database would therefore serve those as the
-- site <title> and footer links until someone happened to save Settings.
--
-- Fix the defaults, and fix the singleton row only if it still holds the
-- inherited values (so anything an admin already edited is left alone).
-- support_email is deliberately NOT touched: it is NOT NULL and there is
-- no Finkel address to put here — set it in Admin → Settings.

alter table public.store_settings
  alter column store_name set default 'Finkel Wines',
  alter column seo_title set default 'Finkel Wines — Exceptional Wines, Curated for Nigeria',
  alter column seo_description set default 'Nigeria''s home for exceptional wine — curated bottles, trusted provenance, and unforgettable moments, delivered nationwide.',
  alter column instagram_url drop default,
  alter column twitter_url drop default,
  alter column youtube_url drop default,
  alter column facebook_url drop default;

update public.store_settings set store_name = 'Finkel Wines' where store_name = 'Adika Stakes';
update public.store_settings
  set seo_title = 'Finkel Wines — Exceptional Wines, Curated for Nigeria'
  where seo_title like 'Adika Stakes%';
update public.store_settings
  set seo_description = 'Nigeria''s home for exceptional wine — curated bottles, trusted provenance, and unforgettable moments, delivered nationwide.'
  where seo_description like '%football jerseys%';
update public.store_settings set instagram_url = null where instagram_url ilike '%adikastakes%';
update public.store_settings set twitter_url = null where twitter_url ilike '%adikastakes%';
update public.store_settings set facebook_url = null where facebook_url ilike '%adikastakes%';
update public.store_settings
  set youtube_url = null
  where youtube_url = 'https://www.youtube.com/channel/UCMCNDW3uarK9vwNBaqZ2NbQ';
