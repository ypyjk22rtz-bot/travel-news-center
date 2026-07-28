import { createClient } from "@supabase/supabase-js";

function normalizeSupabaseUrl(value: string) {
  return value
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/i, "");
}

const noStoreFetch: typeof fetch = (input, init = {}) => {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  headers.set("Pragma", "no-cache");

  return fetch(input, {
    ...init,
    cache: "no-store",
    headers,
  });
};

export function getSupabaseAdmin() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const url = normalizeSupabaseUrl(rawUrl);
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: noStoreFetch },
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
