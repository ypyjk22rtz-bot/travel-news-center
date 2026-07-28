import { createClient } from "@supabase/supabase-js";

function normalizeSupabaseUrl(value: string) {
  return value
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/i, "");
}

export function getSupabaseAdmin() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const url = normalizeSupabaseUrl(rawUrl);
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getSupabaseConfigStatus() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";

  return {
    hasUrl: Boolean(rawUrl.trim()),
    hasServiceKey: Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()),
    urlWasNormalized: /\/rest\/v1\/?$/i.test(rawUrl.trim()),
  };
}
