// Canonical site URL. Set VITE_SITE_URL in your deployment environment to
// override — must NOT have a trailing slash. Deployment-time infrastructure
// config, not a business setting — unlike store name/support email/social
// links below, changing your domain isn't something an admin edits in a
// form, so this correctly stays a code constant rather than moving to
// store_settings.
export const SITE_URL =
  (typeof import.meta !== "undefined" ? import.meta.env?.VITE_SITE_URL : undefined) ||
  process.env.SITE_URL ||
  "https://finkelreserve.com";

// Store name, support email, and social links used to live here as
// constants. They're now in the store_settings table (src/lib/queries/settings.ts,
// useSettings()) so an admin can edit them without a redeploy — see
// /admin/settings. Nothing imports the old exports anymore; removed rather
// than left as unused dead code.
