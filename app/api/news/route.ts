import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ mode: "demo", items: [], error: "Supabase nu este configurat." }, { headers: { "Cache-Control": "no-store" } });
  }

  const { data, error } = await supabase
    .from("tnc_news_items")
    .select("id, source_id, source_url, source_title, source_excerpt, category, status, importance, intelligence_score, discover_score, factual_confidence, source_published_at, detected_at")
    .order("detected_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ mode: "degraded", items: [], error: error.message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({ mode: "live", items: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
