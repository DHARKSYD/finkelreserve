import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * A service-role client that also tells the database WHICH admin is acting.
 *
 * The service key has no user identity, so a change made with it used to be logged with no
 * actor. This client sends the admin's id in an x-actor-id header, and the database reads it
 * (only on service-key requests) when it writes the audit entry. See migration
 * 20261116120000_attribute_server_order_changes.sql.
 *
 * Only ever pass an id that came from requireAdmin(), never one taken from a request body.
 */
export function supabaseAdminAs(actorId: string) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase environment variable(s): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient<Database>(url, key, {
    global: { headers: { "x-actor-id": actorId } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}
