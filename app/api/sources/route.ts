import { NextResponse } from "next/server";
import { initialSources, type TravelSource } from "@/lib/source-catalog";
import { romanianSources } from "@/lib/romanian-sources";
import { getSupabaseAdmin, getSupabaseConfigStatus } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const allSources = [...initialSources, ...romanianSources];

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: noStoreHeaders });
}

function toDatabaseSource(source: TravelSource) {
  return {
    id: source.id,
    name: source.name,
    source_type: source.kind === "tourism" ? "tourism_ministry" : source.kind,
    method: source.method,
    country_code: source.country,
    website_url: source.url,
    feed_url: source.feedUrl ?? null,
    active: source.active,
    official: source.kind !== "publication",
    scan_frequency_minutes: source.frequencyMinutes,
    updated_at: new Date().toISOString(),
  };
}

function fromDatabaseSource(row: Record<string, unknown>): TravelSource {
  const sourceType = String(row.source_type ?? "publication");
  return {
    id: String(row.id),
    name: String(row.name),
    country: String(row.country_code ?? "Global"),
    kind: sourceType === "tourism_ministry" ? "tourism" : sourceType as TravelSource["kind"],
    method: String(row.method ?? "web") as TravelSource["method"],
    url: String(row.website_url),
    feedUrl: row.feed_url ? String(row.feed_url) : undefined,
    active: Boolean(row.active),
    frequencyMinutes: Number(row.scan_frequency_minutes ?? 60),
  };
}

export async function GET() {
  const config = getSupabaseConfigStatus();
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return json({
      mode: "demo",
      sources: allSources,
      diagnostic: { ...config, message: "Lipsește URL-ul Supabase sau cheia server-side în Vercel." },
    });
  }

  try {
    const { error: seedError } = await supabase
      .from("tnc_sources")
      .upsert(allSources.map(toDatabaseSource), { onConflict: "id" });

    if (seedError) throw seedError;

    const { data: existing, error: readError } = await supabase
      .from("tnc_sources")
      .select("*")
      .order("name", { ascending: true });

    if (readError) throw readError;

    return json({
      mode: "live",
      seeded: true,
      catalogSize: allSources.length,
      sources: (existing ?? []).map(fromDatabaseSource),
      diagnostic: config,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Eroare necunoscută Supabase.";
    return json({
      mode: "degraded",
      sources: allSources,
      diagnostic: { ...config, message },
    });
  }
}
