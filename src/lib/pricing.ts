// Single source of truth for pricing rules that aren't stored in the
// database. This file has no server-only imports, so it's safe to pull into
// client-bundled routes — unlike src/lib/actions/checkout.ts, which imports
// the service-role Supabase client.
//
// FREE_SHIPPING_THRESHOLD_NGN used to live here as a constant; it's now
// real, admin-managed data instead (shipping_zones/shipping_rates), since a
// hardcoded number here silently drifts from whatever an admin actually
// sets in /admin/shipping. Checkout and the Shipping Policy page read the
// live tables directly now — see src/lib/actions/checkout.ts and
// src/lib/actions/shipping.ts — so there's nothing left for this file to
// export.
//
// (The jersey product line — name/number/patch customization and its flat
// CUSTOMIZATION_FEE_NGN — doesn't carry over to wine and was removed
// entirely rather than adapted; see the wine-product-model migration.)
