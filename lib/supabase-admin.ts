import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getSupabaseConfigStatus() {
  return {
    hasUrl: Boolean((process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim()),
    hasServiceKey: Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()),
  };
}
