import { NextResponse } from "next/server";
import { initialSources } from "@/lib/source-catalog";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function toDatabaseSource(source: (typeof initialSources)[number]) {
  return {
    id: source.id,
    name: source.name,
    source_type: source.kind === "tourism" ? "tourism_ministry" : source.kind,
    method: source.method,
    country_code: source.country,
    website_url: source.url,
    feed_url: source.feedUrl ?? null,
    active: source.active,
    official: true,
    scan_frequency_minutes: source.frequencyMinutes,
    updated_at: new Date().toISOString(),
  };
}

export async function GET() {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({ mode: "demo", sources: initialSources });
  }

  const { data: existing, error: readError } = await supabase
    .from("tnc_sources")
    .select("*")
    .order("name", { ascending: true });

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }

  if (!existing?.length) {
    const rows = initialSources.map(toDatabaseSource);
    const { error: seedError } = await supabase
      .from("tnc_sources")
      .upsert(rows, { onConflict: "id" });

    if (seedError) {
      return NextResponse.json({ error: seedError.message }, { status: 500 });
    }

    const { data: seeded, error: seededReadError } = await supabase
      .from("tnc_sources")
      .select("*")
      .order("name", { ascending: true });

    if (seededReadError) {
      return NextResponse.json({ error: seededReadError.message }, { status: 500 });
    }

    return NextResponse.json({ mode: "live", seeded: true, sources: seeded ?? [] });
  }

  return NextResponse.json({ mode: "live", seeded: false, sources: existing });
}
