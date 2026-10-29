import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Best-effort caller identity for server functions that must also work for
 * guests (checkout). Returns the verified user id from the request's bearer
 * token, or null if there isn't one / it doesn't check out — never throws.
 *
 * This intentionally re-derives identity from the JWT rather than trusting
 * a `userId` field the client could include in the request body: checkout
 * uses the service-role client (it bypasses RLS to manage stock), so if we
 * trusted a client-supplied id directly, anyone could attribute an order to
 * another shopper's account just by sending their user id in the payload.
 */
export async function getVerifiedUserId(): Promise<string | null> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;

  const authHeader = getRequest()?.headers?.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length);
  if (!token) return null;

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub as string;
}

/**
 * Verified admin identity for server functions that must reject anyone
 * else. Re-derives both identity (from the JWT, via getVerifiedUserId —
 * never a client-supplied id) and role (a fresh user_roles lookup via the
 * service-role client, not a claim on the token) before returning the
 * user id callers should attribute the action to. Throws on anything
 * short of a verified admin, so callers can treat a normal return as
 * "safe to proceed."
 */
export async function requireAdmin(): Promise<string> {
  const userId = await getVerifiedUserId();
  if (!userId) throw new Error("Sign in required.");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Admin access required.");
  return userId;
}
