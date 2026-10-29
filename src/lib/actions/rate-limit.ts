import { getRequest } from "@tanstack/react-start/server";

/**
 * Best-effort rate limiting, keyed by caller IP within a named bucket.
 *
 * Honest limitation: this counts requests in memory, scoped to whichever
 * Worker isolate handles the request. Cloudflare can and does run multiple
 * isolates across edge locations, so a caller hitting different PoPs gets a
 * separate counter at each one — this raises the bar for casual abuse (a
 * single script hammering one endpoint) but is not a hard distributed
 * guarantee. For that, pair this with Cloudflare's edge-level Rate Limiting
 * Rules (dashboard-configurable, no code required) — this function is a
 * floor, not a replacement for it.
 */

type Bucket = { count: number; windowStart: number };
const buckets = new Map<string, Bucket>();

// Prevent unbounded memory growth from an attacker cycling through many
// fake identifiers — evict the oldest entries once this gets large rather
// than trusting window expiry alone to keep it bounded.
const MAX_TRACKED_KEYS = 5000;

function callerIp(): string {
  const headers = getRequest()?.headers;
  return (
    headers?.get("cf-connecting-ip") ??
    headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export async function checkRateLimit(
  bucketName: string,
  maxRequests: number,
  windowMs: number,
): Promise<{ ok: boolean; remaining: number }> {
  const key = `${bucketName}:${callerIp()}`;
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStart >= windowMs) {
    if (buckets.size >= MAX_TRACKED_KEYS) {
      const oldestKey = buckets.keys().next().value;
      if (oldestKey) buckets.delete(oldestKey);
    }
    buckets.set(key, { count: 1, windowStart: now });
    return { ok: true, remaining: maxRequests - 1 };
  }

  if (existing.count >= maxRequests) {
    return { ok: false, remaining: 0 };
  }

  existing.count += 1;
  return { ok: true, remaining: maxRequests - existing.count };
}
