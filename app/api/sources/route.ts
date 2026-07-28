import { NextResponse } from "next/server";
import { initialSources } from "@/lib/source-catalog";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({ mode: "demo", sources: initialSources });
  }

  const { data, error } = await supabase
    .from("tnc_sources")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    mode: "live",
    sources: data && data.length ? data : initialSources,
  });
}
