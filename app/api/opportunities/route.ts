import { NextResponse } from "next/server";
import { GET as getRadar } from "@/app/api/radar/route";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RadarSignal = Record<string, any>;

function clamp(value: number) { return Math.max(0, Math.min(100, Math.round(value))); }

function monetization(signal: RadarSignal) {
  const text = `${signal.source_title || ""} ${signal.source_excerpt || ""} ${signal.category || ""}`.toLowerCase();
  const channels: Array<{ name: string; score: number; reason: string }> = [];
  if (/flight|zbor|route|ruta|airline|airport|fare|ticket|bilet/.test(text)) channels.push({ name: "Travelpayouts", score: 96, reason: "Potrivit pentru căutarea și compararea zborurilor." });
  if (/hotel|resort|accommodation|cazare|destination|destina/.test(text)) channels.push({ name: "Booking / Agoda", score: 88, reason: "Poate converti prin recomandări de cazare." });
  if (/esim|roaming|internet|connectivity|conectivitate/.test(text)) channels.push({ name: "Yesim", score: 82, reason: "Subiect relevant pentru conectivitate în călătorie." });
  if (/insurance|asigurare|incident|safety|warning|alert|emergency/.test(text)) channels.push({ name: "VisitorsCoverage", score: 84, reason: "Poate susține un CTA pentru asigurare de călătorie." });
  if (/train|bus|ferry|transfer|transport/.test(text)) channels.push({ name: "12Go", score: 80, reason: "Relevant pentru transport local sau regional." });
  if (/car rental|rent a car|închiriere auto|inchiriere auto/.test(text)) channels.push({ name: "Rent-a-car", score: 78, reason: "Poate include un CTA pentru închiriere auto." });
  if (!channels.length) channels.push({ name: "Editorial", score: 52, reason: "Monetizare indirectă prin trafic și newsletter." });
  return channels.sort((a, b) => b.score - a.score).slice(0, 3);
}

function opportunity(signal: RadarSignal) {
  const travel = Number(signal.intelligence_score || 0);
  const discover = Number(signal.discover_score || 0);
  const romania = Number(signal.romania_impact || 0);
  const viral = Number(signal.viral_score || 0);
  const breaking = Number(signal.breaking_score || 0);
  const confidence = Number(signal.ai_confidence || signal.confidence || 0);
  const confirmations = Number(signal.duplicate_count || 1);
  const money = monetization(signal);
  const monetizationScore = money[0]?.score || 0;
  const novelty = confirmations <= 2 ? 88 : Math.max(55, 92 - confirmations * 4);
  const score = clamp(travel * 0.19 + discover * 0.2 + romania * 0.17 + viral * 0.16 + breaking * 0.08 + confidence * 0.08 + monetizationScore * 0.08 + novelty * 0.04);

  let bucket = "monitorizeaza";
  if (score >= 82) bucket = "publica_acum";
  else if (romania >= 72) bucket = "romania";
  else if (signal.signal_type === "promotii" || /FLIGHT DEAL/.test(String(signal.priority_label || ""))) bucket = "flight_deals";
  else if (discover >= 78) bucket = "discover";
  else if (monetizationScore >= 80) bucket = "monetizare";

  const reasons: string[] = [];
  if (discover >= 78) reasons.push("Potențial ridicat pentru Google Discover.");
  if (romania >= 70) reasons.push("Interes direct pentru publicul din România.");
  if (viral >= 75) reasons.push("Probabilitate bună de click și distribuire.");
  if (breaking >= 78) reasons.push("Subiect urgent, cu fereastră editorială scurtă.");
  if (confirmations > 1) reasons.push(`Confirmat de ${confirmations} surse.`);
  if (monetizationScore >= 80) reasons.push(`Monetizare recomandată prin ${money[0].name}.`);
  if (!reasons.length) reasons.push("Subiect util de urmărit pentru evoluții ulterioare.");

  return { ...signal, opportunity_score: score, opportunity_bucket: bucket, opportunity_reasons: reasons.slice(0, 4), monetization: money, novelty_score: novelty, opportunity_kind: "news" };
}

function flightDealOpportunity(deal: any) {
  const score = Number(deal.deal_score || 0);
  const romania = Number(deal.relevance_romania || 0);
  const price = Number(deal.price || 0);
  const discover = clamp(score * 0.62 + romania * 0.25 + (price > 0 && price <= 100 ? 13 : 0));
  return {
    id: `flight-${deal.external_id}`,
    deal_external_id: deal.external_id,
    source_title: deal.title,
    generated_title: null,
    source_excerpt: `${deal.origin || "?"} → ${deal.destination || "?"}, ${price} ${deal.currency || "EUR"}. Tarif orientativ din cache; verificarea finală este obligatorie.`,
    source_url: deal.booking_url,
    source_name: "Travelpayouts",
    status: deal.status || "new",
    signal_type: "promotii",
    priority_label: "✈ FLIGHT DEAL",
    opportunity_score: clamp(score * 0.72 + romania * 0.18 + discover * 0.1),
    opportunity_bucket: score >= 82 ? "publica_acum" : "flight_deals",
    opportunity_reasons: [score >= 82 ? "Deal Score ridicat; merită verificat editorial imediat." : "Tarif relevant pentru pagina Flight Deals.", romania >= 90 ? "Plecare din România." : "Plecare accesibilă publicului român.", "Monetizare directă prin Travelpayouts."],
    monetization: [{ name: "Travelpayouts", score: 98, reason: "Conversie directă prin căutarea zborului." }],
    intelligence_score: score,
    discover_score: discover,
    romania_impact: romania,
    viral_score: clamp(score * 0.8 + (price <= 100 ? 15 : 0)),
    breaking_score: 25,
    ai_confidence: deal.verified ? 85 : 68,
    duplicate_count: 1,
    generated: false,
    opportunity_kind: "flight_deal",
    booking_url: deal.booking_url,
  };
}

export async function GET() {
  const radarResponse = await getRadar();
  const radarPayload = await radarResponse.json().catch(() => ({}));
  if (!radarResponse.ok) return NextResponse.json(radarPayload, { status: radarResponse.status });

  const newsOpportunities = (radarPayload.signals || []).map(opportunity);
  const supabase = getSupabaseAdmin();
  let flightOpportunities: any[] = [];
  if (supabase) {
    const { data } = await supabase.from("flight_deals").select("*").eq("status", "new").order("deal_score", { ascending: false }).limit(20);
    flightOpportunities = (data || []).filter((deal) => Number(deal.deal_score || 0) >= 60).map(flightDealOpportunity);
  }

  const opportunities = [...newsOpportunities, ...flightOpportunities].sort((a: any, b: any) => b.opportunity_score - a.opportunity_score);
  const buckets = opportunities.reduce((acc: Record<string, number>, item: any) => { acc[item.opportunity_bucket] = (acc[item.opportunity_bucket] || 0) + 1; return acc; }, {});

  return NextResponse.json({
    opportunities,
    stats: {
      total: opportunities.length,
      publicaAcum: buckets.publica_acum || 0,
      romania: buckets.romania || 0,
      flightDeals: opportunities.filter((item: any) => item.opportunity_kind === "flight_deal").length,
      discover: buckets.discover || 0,
      monetizare: buckets.monetizare || 0,
      monitorizeaza: buckets.monitorizeaza || 0,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}