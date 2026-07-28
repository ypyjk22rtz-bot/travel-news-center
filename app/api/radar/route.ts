import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ViralHeadline = { title: string; ctrScore: number };
type IntelligencePackage = {
  summary30s?: string;
  summary2m?: string;
  verdict?: string;
  verdictReason?: string;
  impactScore?: number;
  impactReasons?: string[];
  duplicateAssessment?: string;
  viralHeadlines?: ViralHeadline[];
  estimatedCtr?: number;
  trendingScore?: number;
};

function clamp(value: number) { return Math.max(0, Math.min(100, Math.round(value))); }

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

function normalizeWords(value: string) {
  return new Set(value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((word) => word.length > 3));
}

function similarity(a: string, b: string) {
  const left = normalizeWords(a);
  const right = normalizeWords(b);
  if (!left.size || !right.size) return 0;
  const intersection = Array.from(left).filter((word) => right.has(word)).length;
  const union = new Set(Array.from(left).concat(Array.from(right))).size;
  return union ? intersection / union : 0;
}

function parseIntelligence(ctaHtml: unknown): IntelligencePackage | null {
  const text = typeof ctaHtml === "string" ? ctaHtml : "";
  const match = text.match(/<!--\s*tnc-intelligence:([A-Za-z0-9+/=]+)\s*-->/);
  if (!match?.[1]) return null;
  try { return JSON.parse(Buffer.from(match[1], "base64").toString("utf8")) as IntelligencePackage; }
  catch { return null; }
}

function romaniaImpact(item: any, source: any, intelligence: IntelligencePackage | null) {
  const text = `${item.source_title || ""} ${item.source_excerpt || ""} ${item.category || ""} ${source?.country_code || ""}`.toLowerCase();
  const reasons: string[] = [];
  let score = 18;
  if (/romania|românia|romanian|bucharest|bucurești|bucuresti|cluj|iasi|iași|timisoara|timișoara|otopeni|henri coanda|buh|otp|ias|clj|tsr/.test(text)) { score += 42; reasons.push("Afectează direct România sau un aeroport românesc."); }
  if (/visa|viză|viza|passport|entry requirement/.test(text)) { score += 18; reasons.push("Poate modifica regulile de intrare pentru călători."); }
  if (/route|ruta|direct flight|new flight|launch|resume/.test(text)) { score += 15; reasons.push("Poate schimba opțiunile de zbor și conectivitatea."); }
  if (/strike|grev|cancel|delay|closure|closed|disruption/.test(text)) { score += 15; reasons.push("Poate afecta rezervări și plecări existente."); }
  if (/tax|fee|baggage|bagaj|carry-on/.test(text)) { score += 10; reasons.push("Poate modifica costurile sau condițiile călătoriei."); }
  if (source?.country_code === "RO") { score += 20; reasons.push("Sursa sau evenimentul este din România."); }
  if (intelligence?.impactScore) score = Math.round(score * 0.55 + Number(intelligence.impactScore) * 0.45);
  if (!reasons.length) reasons.push("Impact indirect; relevanța pentru români trebuie verificată editorial.");
  return { score: clamp(score), reasons: reasons.slice(0, 4) };
}

function priorityLabel(item: any) {
  const text = `${item.source_title || ""} ${item.source_excerpt || ""}`.toLowerCase();
  if (item.urgency === "critical") return "🔥 BREAKING";
  if (item.romania_impact >= 75) return "🇷🇴 ROMÂNIA";
  if (item.signal_type === "promotii") return "✈ FLIGHT DEAL";
  if (item.signal_type === "siguranta" || item.signal_type === "perturbari") return "⚠ ALERTĂ";
  if (/asia|japan|japonia|china|thailand|bangkok|vietnam|singapore|korea/.test(text)) return "🌏 ASIA";
  if (/island|beach|resort|destination|destina/.test(text)) return "🏖 DESTINAȚII";
  return item.urgency === "high" ? "⭐ IMPORTANT" : "📰 URMĂREȘTE";
}

function editorialScores(item: any, intelligence: IntelligencePackage | null, duplicateCount: number, confidence: number) {
  const text = `${item.source_title || ""} ${item.source_excerpt || ""}`.toLowerCase();
  const travel = Number(item.intelligence_score || 0);
  const discover = Number(item.discover_score || 0);
  const romania = Number(item.romania_impact || 0);
  const trend = Number(intelligence?.trendingScore || 0);
  const ctr = Number(intelligence?.estimatedCtr || 0);
  let breaking = travel * 0.42 + discover * 0.18 + confidence * 0.15;
  if (/breaking|urgent|emergency|incident|accident|smoke|closure|strike|cancel|warning|alert/.test(text)) breaking += 22;
  if (item.urgency === "critical") breaking += 18;
  let viral = discover * 0.42 + travel * 0.2 + romania * 0.18 + trend * 0.12 + Math.min(10, ctr) * 0.8;
  if (/cheap|cheapest|new route|direct flight|visa-free|fără viză|record|surprise|surpriz/.test(text)) viral += 12;
  if (duplicateCount > 1) viral += Math.min(10, duplicateCount * 2);
  const breakingScore = clamp(breaking);
  const viralScore = clamp(viral);
  const aiConfidence = clamp(confidence * 0.72 + Math.min(100, duplicateCount * 18) * 0.28);
  const composite = clamp(travel * 0.27 + discover * 0.22 + romania * 0.19 + viralScore * 0.16 + breakingScore * 0.1 + aiConfidence * 0.06);
  const reasons: string[] = [];
  if (romania >= 70) reasons.push("Are impact ridicat pentru publicul din România.");
  if (discover >= 80) reasons.push("Are potențial puternic pentru Google Discover.");
  if (viralScore >= 80) reasons.push("Titlul și subiectul au probabilitate mare de distribuire și click.");
  if (breakingScore >= 80) reasons.push("Este urgent sau poate afecta călătorii în desfășurare.");
  if (duplicateCount >= 2) reasons.push(`Subiectul este confirmat de ${duplicateCount} surse.`);
  if (!reasons.length) reasons.push("Subiectul are relevanță moderată și trebuie urmărit înainte de publicare.");
  let autoVerdict = "IGNORĂ";
  if (composite >= 84 || breakingScore >= 90) autoVerdict = "PUBLICĂ ACUM";
  else if (composite >= 68 || viralScore >= 78) autoVerdict = "PUBLICĂ ÎN URMĂTOARELE 2 ORE";
  else if (composite >= 48) autoVerdict = "MONITORIZEAZĂ";
  return { viralScore, breakingScore, aiConfidence, compositeScore: composite, autoVerdict, autoVerdictReasons: reasons.slice(0, 4) };
}

function buildTrending(signals: any[]) {
  const stop = new Set(["care", "este", "sunt", "after", "with", "from", "this", "that", "into", "pentru", "despre", "unei", "unui", "the", "and", "travel", "flight", "flights", "airport"]);
  const counts = new Map<string, { label: string; count: number; score: number }>();
  for (const item of signals) {
    const words = `${item.generated_title || item.source_title || ""}`.replace(/[^A-Za-zÀ-ž0-9 ]/g, " ").split(/\s+/).filter(Boolean);
    for (const raw of words) {
      const key = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (key.length < 4 || stop.has(key) || /^\d+$/.test(key)) continue;
      const current = counts.get(key) || { label: raw, count: 0, score: 0 };
      current.count += 1;
      current.score += Number(item.composite_score || item.intelligence_score || 0) + Number(item.discover_score || 0) + Number(item.romania_impact || 0);
      counts.set(key, current);
    }
  }
  return Array.from(counts.values()).filter((item) => item.count >= 2).sort((a, b) => b.count - a.count || b.score - a.score).slice(0, 10).map((item, index) => ({ rank: index + 1, topic: item.label, mentions: item.count, heat: Math.min(100, Math.round(item.score / Math.max(1, item.count * 2.2))) }));
}

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase nu este configurat." }, { status: 500 });
  const { data, error } = await supabase.from("tnc_news_items").select("*").neq("status", "rejected").order("detected_at", { ascending: false }).limit(250);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (data || []).map((item) => item.id);
  const sourceIds = Array.from(new Set((data || []).map((item) => item.source_id).filter(Boolean)));
  const [{ data: generated }, { data: sources }] = await Promise.all([
    ids.length ? supabase.from("tnc_generated_content").select("news_item_id, seo_title, subtitle, excerpt, cta_html").in("news_item_id", ids) : Promise.resolve({ data: [] as any[] }),
    sourceIds.length ? supabase.from("tnc_sources").select("id, name, country_code, source_type").in("id", sourceIds) : Promise.resolve({ data: [] as any[] }),
  ]);

  const enriched = (data || []).map((item) => {
    const generatedRow = (generated || []).find((row) => row.news_item_id === item.id) || null;
    const source = (sources || []).find((row) => row.id === item.source_id) || null;
    const intelligence = parseIntelligence(generatedRow?.cta_html);
    const impact = romaniaImpact(item, source, intelligence);
    const base = {
      ...item,
      signal_type: signalType(item), urgency: urgency(item),
      source_name: source?.name || "Sursă necunoscută", source_country: source?.country_code || "Global",
      generated_title: generatedRow?.seo_title || null, generated: Boolean(generatedRow),
      viral_headlines: intelligence?.viralHeadlines || [], estimated_ctr: intelligence?.estimatedCtr || null,
      trending_score: intelligence?.trendingScore || null,
      summary30s: intelligence?.summary30s || generatedRow?.excerpt || item.source_excerpt || "Rezumatul AI nu a fost încă generat.",
      summary2m: intelligence?.summary2m || "Generează pachetul AI Intelligence pentru rezumatul extins.",
      verdict: intelligence?.verdict || null, verdict_reason: intelligence?.verdictReason || null,
      duplicate_assessment: intelligence?.duplicateAssessment || null,
      romania_impact: impact.score, romania_reasons: impact.reasons,
      _intelligence: intelligence,
    };
    return { ...base, priority_label: priorityLabel(base) };
  });

  const consumed = new Set<string>();
  const signals: any[] = [];
  for (const primary of enriched) {
    if (consumed.has(primary.id)) continue;
    const related = enriched.filter((candidate) => candidate.id !== primary.id && !consumed.has(candidate.id) && candidate.signal_type === primary.signal_type && similarity(primary.source_title, candidate.source_title) >= 0.42);
    related.forEach((candidate) => consumed.add(candidate.id)); consumed.add(primary.id);
    const group = [primary].concat(related).sort((a, b) => Number(b.intelligence_score || 0) - Number(a.intelligence_score || 0));
    const leader = group[0];
    const confidence = clamp(54 + Math.max(0, group.length - 1) * 12 + Number(leader.intelligence_score || 0) * 0.22);
    const extra = editorialScores(leader, leader._intelligence, group.length, confidence);
    const { _intelligence, ...cleanLeader } = leader;
    signals.push({
      ...cleanLeader, ...extra,
      composite_score: extra.compositeScore,
      auto_verdict: extra.autoVerdict,
      auto_verdict_reasons: extra.autoVerdictReasons,
      duplicate_count: group.length,
      confirmations: group.map((item) => ({ id: item.id, title: item.source_title, sourceName: item.source_name, sourceUrl: item.source_url, detectedAt: item.detected_at })),
      confidence,
    });
  }

  signals.sort((a, b) => Number(b.composite_score || 0) - Number(a.composite_score || 0) || Number(b.breaking_score || 0) - Number(a.breaking_score || 0));
  const counts = signals.reduce((acc: Record<string, number>, item: any) => { acc[item.signal_type] = (acc[item.signal_type] || 0) + 1; acc[item.urgency] = (acc[item.urgency] || 0) + 1; return acc; }, {});
  return NextResponse.json({
    mode: "live", fetchedAt: new Date().toISOString(), signals, trending: buildTrending(signals),
    stats: {
      total: signals.length, rawItems: enriched.length, groupedDuplicates: Math.max(0, enriched.length - signals.length),
      critical: counts.critical || 0, high: counts.high || 0, routes: counts.rute || 0, visas: counts.vize || 0,
      disruptions: counts.perturbari || 0, promotions: counts.promotii || 0, safety: counts.siguranta || 0,
      highRomaniaImpact: signals.filter((item) => Number(item.romania_impact || 0) >= 70).length,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
