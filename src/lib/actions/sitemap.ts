import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { POSTS } from "@/content/blog";

// Resolved at request time so it picks up the correct env var on the worker.
// Placeholder fallback only — SITE_URL should be set to the real domain
// once one exists; nothing else in the codebase hardcodes this one.
function getSiteUrl(): string {
  return process.env.SITE_URL || "https://finkelreserve.com";
}

function urlEntry(path: string, priority: string, changefreq: string): string {
  return [
    "  <url>",
    `    <loc>${getSiteUrl()}${path}</loc>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    "  </url>",
  ].join("\n");
}

// Static paths that are always part of the sitemap.
// Do NOT include: /admin/*, /account, /cart, /wishlist, /auth, /order-confirmation/*
const STATIC_ENTRIES = [
  urlEntry("/", "1.0", "daily"),
  urlEntry("/shop", "0.9", "daily"),
  urlEntry("/about", "0.5", "monthly"),
  urlEntry("/blog", "0.6", "weekly"),
  urlEntry("/contact", "0.5", "monthly"),
  urlEntry("/privacy", "0.3", "monthly"),
  urlEntry("/terms", "0.3", "monthly"),
  urlEntry("/shipping-policy", "0.3", "monthly"),
  urlEntry("/returns-policy", "0.3", "monthly"),
];

export async function handleSitemap(): Promise<Response> {
  // Fetch only the slug column of active products — no RLS bypass needed,
  // but using supabaseAdmin keeps the import pattern consistent with the
  // rest of server.ts and guarantees we see every active slug even if the
  // anon policy ever changes.
  const { data: products, error } = await supabaseAdmin
    .from("products")
    .select("slug")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[sitemap] Supabase error:", error.message);
  }

  const productEntries = (products ?? []).map((p) =>
    urlEntry(`/product/${p.slug}`, "0.8", "weekly"),
  );

  const blogEntries = POSTS.map((p) => urlEntry(`/blog/${p.slug}`, "0.6", "monthly"));

  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...STATIC_ENTRIES,
    ...productEntries,
    ...blogEntries,
    `</urlset>`,
  ].join("\n");

  return new Response(xml, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      // Cache for 1 hour at the edge — long enough to avoid hammering the DB,
      // short enough that a newly published product appears quickly.
      "cache-control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

export function handleRobots(): Response {
  const siteUrl = getSiteUrl();
  const body = [
    "User-agent: *",
    "Allow: /",
    "",
    "# Private / transactional pages",
    "Disallow: /admin",
    "Disallow: /admin/",
    "Disallow: /account",
    "Disallow: /cart",
    "Disallow: /wishlist",
    "Disallow: /auth",
    "Disallow: /order-confirmation/",
    "",
    `Sitemap: ${siteUrl}/sitemap.xml`,
  ].join("\n");

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}
