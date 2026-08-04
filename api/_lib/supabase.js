import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

let client = null;

/**
 * Service-role client. Bypasses RLS, so it must never be imported by
 * anything under src/ that ships to the browser.
 */
export function getSupabaseAdmin() {
  if (client) return client;
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw Object.assign(
      new Error("Supabase server credentials are not configured."),
      { statusCode: 500, code: "missing_env" },
    );
  }
  client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** Unwraps a supabase-js result, turning `error` into a thrown Error. */
export function unwrap({ data, error }, context) {
  if (error) {
    throw Object.assign(new Error(`${context}: ${error.message}`), {
      statusCode: 500,
      code: "supabase_error",
    });
  }
  return data;
}
