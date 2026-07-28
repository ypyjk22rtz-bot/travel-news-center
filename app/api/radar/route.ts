import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function signalType(item: any) {
  const text = `${item.source_title || ""} ${item.source_excerpt || ""} ${item.category || ""}`.toLowerCase();
  if (/visa|viză|viza|entry requirement|passport|pașaport/.test(text)) return "vize";
  if (/strike|grev|cancel|delay|disruption|perturb|closed|closure/.test(text)) return "perturbari";
  if (/tax|fee|charge|taxă|taxe/.test(text)) return "taxe";
  if (/baggage|bagaj|carry-on|luggage/.test(text)) return "bagaje";
  if (/safety|security|alert|warning|incident|accident|smoke|emergency/.test(text)) return "siguranta";
  if (/route|ruta|launch|resume|direct flight|new flight|airport/.test(text)) return "rute";
  if (/deal|sale|discount|promo|fare|price|ofert/.test(text)) return "promotii";
  return "general";
}

function urgency(item: any) {
  const score = Number(item.intelligence_score || 0);
  const discover = Number(item.discover_score || 0);
  const importance = String(item.importance || "").toLowerCase();
  if (importance === "critical" || score >= 85) return "critical";
  if (importance === "high" || score >= 70 || discover >= 80) return "high";
  if (score >= 50 || discover >= 60) return "medium";
  return "low";
}

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase nu este configurat." }, { status: 500 });

  const { data, error } = await supabase
    .from("tnc_news_items")
    .select("*")
    .neq("status", "rejected")
    .order("detected_at", { ascending: false })
    .limit(250);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const signals = (data || []).map((item) => ({
    ...item,
    signal_type: signalType(item),
    urgency: urgency(item),
  }));

  const counts = signals.reduce((acc: Record<string, number>, item: any) => {
    acc[item.signal_type] = (acc[item.signal_type] || 0) + 1;
    acc[item.urgency] = (acc[item.urgency] || 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    mode: "live",
    fetchedAt: new Date().toISOString(),
    signals,
    stats: {
      total: signals.length,
      critical: counts.critical || 0,
      high: counts.high || 0,
      routes: counts.rute || 0,
      visas: counts.vize || 0,
      disruptions: counts.perturbari || 0,
      promotions: counts.promotii || 0,
      safety: counts.siguranta || 0,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
