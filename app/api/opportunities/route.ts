import { NextResponse } from "next/server";
import { GET as getRadar } from "@/app/api/radar/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RadarSignal = Record<string, any>;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

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

  return {
    ...signal,
    opportunity_score: score,
    opportunity_bucket: bucket,
    opportunity_reasons: reasons.slice(0, 4),
    monetization: money,
    novelty_score: novelty,
  };
}

export async function GET() {
  const radarResponse = await getRadar();
  const radarPayload = await radarResponse.json().catch(() => ({}));
  if (!radarResponse.ok) return NextResponse.json(radarPayload, { status: radarResponse.status });

  const opportunities = (radarPayload.signals || []).map(opportunity).sort((a: any, b: any) => b.opportunity_score - a.opportunity_score);
  const buckets = opportunities.reduce((acc: Record<string, number>, item: any) => {
    acc[item.opportunity_bucket] = (acc[item.opportunity_bucket] || 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    opportunities,
    stats: {
      total: opportunities.length,
      publicaAcum: buckets.publica_acum || 0,
      romania: buckets.romania || 0,
      flightDeals: buckets.flight_deals || 0,
      discover: buckets.discover || 0,
      monetizare: buckets.monetizare || 0,
      monitorizeaza: buckets.monitorizeaza || 0,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
