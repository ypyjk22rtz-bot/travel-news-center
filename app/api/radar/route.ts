import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type IntelligencePackage = {
  summary30s?: string;
  summary2m?: string;
  verdict?: string;
  verdictReason?: string;
  impactScore?: number;
  impactReasons?: string[];
  duplicateAssessment?: string;
};

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
  return new Set(
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3),
  );
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
  try {
    return JSON.parse(Buffer.from(match[1], "base64").toString("utf8")) as IntelligencePackage;
  } catch {
    return null;
  }
}

function romaniaImpact(item: any, source: any, intelligence: IntelligencePackage | null) {
  const text = `${item.source_title || ""} ${item.source_excerpt || ""} ${item.category || ""} ${source?.country_code || ""}`.toLowerCase();
  const reasons: string[] = [];
  let score = 18;

  if (/romania|românia|romanian|bucharest|bucurești|bucuresti|cluj|iasi|iași|timisoara|timișoara|otopeni|henri coanda|buh|otp|ias|clj|tsr/.test(text)) {
    score += 42;
    reasons.push("Afectează direct România sau un aeroport românesc.");
  }
  if (/visa|viză|viza|passport|entry requirement/.test(text)) {
    score += 18;
    reasons.push("Poate modifica regulile de intrare pentru călători.");
  }
  if (/route|ruta|direct flight|new flight|launch|resume/.test(text)) {
    score += 15;
    reasons.push("Poate schimba opțiunile de zbor și conectivitatea.");
  }
  if (/strike|grev|cancel|delay|closure|closed|disruption/.test(text)) {
    score += 15;
    reasons.push("Poate afecta rezervări și plecări existente.");
  }
  if (/tax|fee|baggage|bagaj|carry-on/.test(text)) {
    score += 10;
    reasons.push("Poate modifica costurile sau condițiile călătoriei.");
  }
  if (source?.country_code === "RO") {
    score += 20;
    reasons.push("Sursa sau evenimentul este din România.");
  }
  if (intelligence?.impactScore) score = Math.round(score * 0.55 + Number(intelligence.impactScore) * 0.45);

  const finalScore = Math.max(0, Math.min(100, score));
  if (!reasons.length) reasons.push("Impact indirect; relevanța pentru români trebuie verificată editorial.");
  return { score: finalScore, reasons: reasons.slice(0, 4) };
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

  const ids = (data || []).map((item) => item.id);
  const sourceIds = Array.from(new Set((data || []).map((item) => item.source_id).filter(Boolean)));
  const [{ data: generated }, { data: sources }] = await Promise.all([
    ids.length
      ? supabase.from("tnc_generated_content").select("news_item_id, seo_title, subtitle, excerpt, cta_html").in("news_item_id", ids)
      : Promise.resolve({ data: [] as any[] }),
    sourceIds.length
      ? supabase.from("tnc_sources").select("id, name, country_code, source_type").in("id", sourceIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const enriched = (data || []).map((item) => {
    const generatedRow = (generated || []).find((row) => row.news_item_id === item.id) || null;
    const source = (sources || []).find((row) => row.id === item.source_id) || null;
    const intelligence = parseIntelligence(generatedRow?.cta_html);
    const impact = romaniaImpact(item, source, intelligence);
    return {
      ...item,
      signal_type: signalType(item),
      urgency: urgency(item),
      source_name: source?.name || "Sursă necunoscută",
      source_country: source?.country_code || "Global",
      generated_title: generatedRow?.seo_title || null,
      summary30s: intelligence?.summary30s || generatedRow?.excerpt || item.source_excerpt || "Rezumatul AI nu a fost încă generat.",
      summary2m: intelligence?.summary2m || "Generează pachetul AI Intelligence în Approval Center pentru rezumatul extins.",
      verdict: intelligence?.verdict || null,
      verdict_reason: intelligence?.verdictReason || null,
      duplicate_assessment: intelligence?.duplicateAssessment || null,
      romania_impact: impact.score,
      romania_reasons: impact.reasons,
    };
  });

  const consumed = new Set<string>();
  const signals: any[] = [];
  for (const primary of enriched) {
    if (consumed.has(primary.id)) continue;
    const related = enriched.filter((candidate) => {
      if (candidate.id === primary.id || consumed.has(candidate.id)) return false;
      if (candidate.signal_type !== primary.signal_type) return false;
      return similarity(primary.source_title, candidate.source_title) >= 0.42;
    });
    related.forEach((candidate) => consumed.add(candidate.id));
    consumed.add(primary.id);

    const group = [primary].concat(related).sort((a, b) => Number(b.intelligence_score || 0) - Number(a.intelligence_score || 0));
    const leader = group[0];
    signals.push({
      ...leader,
      duplicate_count: group.length,
      confirmations: group.map((item) => ({
        id: item.id,
        title: item.source_title,
        sourceName: item.source_name,
        sourceUrl: item.source_url,
        detectedAt: item.detected_at,
      })),
      confidence: Math.min(100, 54 + Math.max(0, group.length - 1) * 12 + Math.round(Number(leader.intelligence_score || 0) * 0.22)),
    });
  }

  signals.sort((a, b) => {
    const priority = { critical: 4, high: 3, medium: 2, low: 1 } as Record<string, number>;
    return (priority[b.urgency] || 0) - (priority[a.urgency] || 0)
      || Number(b.romania_impact || 0) - Number(a.romania_impact || 0)
      || Number(b.intelligence_score || 0) - Number(a.intelligence_score || 0);
  });

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
      rawItems: enriched.length,
      groupedDuplicates: Math.max(0, enriched.length - signals.length),
      critical: counts.critical || 0,
      high: counts.high || 0,
      routes: counts.rute || 0,
      visas: counts.vize || 0,
      disruptions: counts.perturbari || 0,
      promotions: counts.promotii || 0,
      safety: counts.siguranta || 0,
      highRomaniaImpact: signals.filter((item) => Number(item.romania_impact || 0) >= 70).length,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
