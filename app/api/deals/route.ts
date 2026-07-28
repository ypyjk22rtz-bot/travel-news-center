import { NextResponse } from "next/server";
import { demoDeals } from "@/lib/deal-engine";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ mode: "demo", deals: demoDeals });

  const { data, error } = await supabase
    .from("flight_deals")
    .select("*")
    .in("status", ["new", "review", "approved"])
    .order("deal_score", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ mode: "live", deals: data ?? [] });
}
