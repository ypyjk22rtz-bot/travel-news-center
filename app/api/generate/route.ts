import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

type EditorialPayload = {
  seoTitle: string;
  subtitle: string;
  slug: string;
  excerpt: string;
  metaDescription: string;
  articleHtml: string;
  keywords: string[];
  tags: string[];
  facebook: string;
  instagram: string;
  threads: string;
  xText: string;
  linkedin: string;
  youtubeCommunity: string;
  pushNotification: string;
  imagePrompt: string;
  viralHeadlines: Array<{ title: string; ctrScore: number }>;
  verdict: "PUBLICĂ IMEDIAT" | "PUBLICĂ" | "VERIFICĂ" | "NU MERITĂ";
  verdictReason: string;
  impactScore: number;
  impactReasons: string[];
  discoverScore: number;
  estimatedCtr: number;
  trendingScore: number;
  summary30s: string;
  summary2m: string;
  duplicateAssessment: string;
};

function extractOutputText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const item of payload?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (typeof content?.text === "string") return content.text;
    }
  }
  return "";
}

function normalizeWords(value: string) {
  return new Set(value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((word) => word.length > 3));
}

function similarity(a: string, b: string) {
  const left = normalizeWords(a);
  const right = normalizeWords(b);
  if (!left.size || !right.size) return 0;
  const intersection = [...left].filter((word) => right.has(word)).length;
  const union = new Set([...left, ...right]).size;
  return intersection / union;
}

function clampNumber(value: unknown, fallback: number, min = 0, max = 100) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

export async function POST(request: Request) {
  try {
    const { newsItemId } = await request.json();
    if (!newsItemId) return NextResponse.json({ error: "Lipsește newsItemId." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Supabase nu este configurat." }, { status: 500 });

    const { data: item, error: itemError } = await supabase.from("tnc_news_items").select("*").eq("id", newsItemId).single();
    if (itemError || !item) return NextResponse.json({ error: itemError?.message || "Știrea nu există." }, { status: 404 });

    const { data: source } = item.source_id
      ? await supabase.from("tnc_sources").select("name, source_type, country_code").eq("id", item.source_id).maybeSingle()
      : { data: null } as any;

    const { data: recentItems } = await supabase
      .from("tnc_news_items")
      .select("id, source_title, source_url, detected_at")
      .neq("id", newsItemId)
      .order("detected_at", { ascending: false })
      .limit(80);

    const duplicateCandidates = (recentItems || [])
      .map((candidate) => ({ ...candidate, similarity: similarity(item.source_title, candidate.source_title) }))
      .filter((candidate) => candidate.similarity >= 0.35)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY nu este configurată în Vercel." }, { status: 500 });

    const prompt = `Ești redactorul-șef și analistul de audiență al Travelistul.com. Creează în limba română un pachet editorial factual bazat EXCLUSIV pe sursa furnizată. Nu inventa date, prețuri, rute, termene, citate sau reguli. Articolul trebuie să aibă 600-900 de cuvinte, HTML curat, paragrafe și H2. Explică impactul practic pentru călătorii români și marchează ce trebuie reverificat.

Sursă: ${source?.name || item.source_id || "Sursă oficială"}
Tip sursă: ${source?.source_type || "necunoscut"}
Țară: ${source?.country_code || "Global"}
Titlu original: ${item.source_title}
Rezumat original: ${item.source_excerpt || "Nu există rezumat."}
URL oficial: ${item.source_url}
Categorie: ${item.category}
Data publicării: ${item.source_published_at || "necunoscută"}
Scor intern existent: ${item.intelligence_score || 0}/100
Scor Discover existent: ${item.discover_score || 0}/100

Posibile duplicate detectate algoritmic:
${duplicateCandidates.length ? duplicateCandidates.map((candidate) => `- ${candidate.source_title} (${Math.round(candidate.similarity * 100)}% similar)`).join("\n") : "- Niciun candidat evident."}

Cerințe:
- 10 titluri virale, fiecare cu ctrScore 0-100, ordonate descrescător.
- verdict editorial dintre: PUBLICĂ IMEDIAT, PUBLICĂ, VERIFICĂ, NU MERITĂ.
- impactScore 0-100 și motive concrete.
- discoverScore 0-100, estimatedCtr procentual realist 0-20 și trendingScore 1-5.
- rezumat de aproximativ 30 secunde și rezumat de aproximativ 2 minute.
- duplicateAssessment care explică dacă este probabil duplicat și ce trebuie unit/verificat.
- pachet social separat pentru Facebook, Instagram, Threads, X, LinkedIn și YouTube Community.
- imagePrompt profesional, landscape, fără text în imagine.

Returnează STRICT JSON cu câmpurile: seoTitle, subtitle, slug, excerpt, metaDescription, articleHtml, keywords, tags, facebook, instagram, threads, xText, linkedin, youtubeCommunity, pushNotification, imagePrompt, viralHeadlines, verdict, verdictReason, impactScore, impactReasons, discoverScore, estimatedCtr, trendingScore, summary30s, summary2m, duplicateAssessment.`;

    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: prompt, text: { format: { type: "json_object" } } }),
    });

    const openai = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: openai?.error?.message || `OpenAI HTTP ${response.status}` }, { status: 502 });

    const raw = extractOutputText(openai);
    let editorial: EditorialPayload;
    try {
      editorial = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "OpenAI nu a returnat JSON valid.", raw: raw.slice(0, 500) }, { status: 502 });
    }

    editorial.impactScore = clampNumber(editorial.impactScore, item.intelligence_score || 50);
    editorial.discoverScore = clampNumber(editorial.discoverScore, item.discover_score || 50);
    editorial.estimatedCtr = clampNumber(editorial.estimatedCtr, 4, 0, 20);
    editorial.trendingScore = clampNumber(editorial.trendingScore, 3, 1, 5);
    editorial.viralHeadlines = Array.isArray(editorial.viralHeadlines) ? editorial.viralHeadlines.slice(0, 10) : [];

    const intelligencePackage = {
      viralHeadlines: editorial.viralHeadlines,
      verdict: editorial.verdict,
      verdictReason: editorial.verdictReason,
      impactScore: editorial.impactScore,
      impactReasons: editorial.impactReasons || [],
      discoverScore: editorial.discoverScore,
      estimatedCtr: editorial.estimatedCtr,
      trendingScore: editorial.trendingScore,
      summary30s: editorial.summary30s,
      summary2m: editorial.summary2m,
      duplicateAssessment: editorial.duplicateAssessment,
      duplicateCandidates,
      socialExtended: {
        instagram: editorial.instagram,
        threads: editorial.threads,
        linkedin: editorial.linkedin,
        youtubeCommunity: editorial.youtubeCommunity,
      },
    };

    const encodedIntelligence = Buffer.from(JSON.stringify(intelligencePackage), "utf8").toString("base64");
    const now = new Date().toISOString();
    const { error: generatedError } = await supabase.from("tnc_generated_content").upsert({
      news_item_id: newsItemId,
      seo_title: editorial.seoTitle,
      subtitle: editorial.subtitle,
      article_html: editorial.articleHtml,
      meta_description: editorial.metaDescription,
      slug: editorial.slug,
      excerpt: editorial.excerpt,
      keywords: editorial.keywords || [],
      tags: editorial.tags || [],
      cta_html: `<!-- image-prompt: ${editorial.imagePrompt || ""} -->\n<!-- tnc-intelligence:${encodedIntelligence} -->`,
      model,
      prompt_version: "tnc-editorial-v2-intelligence",
      updated_at: now,
    }, { onConflict: "news_item_id" });
    if (generatedError) throw generatedError;

    const { error: socialError } = await supabase.from("tnc_social_content").upsert({
      news_item_id: newsItemId,
      facebook: editorial.facebook,
      x_text: editorial.xText,
      push_notification: editorial.pushNotification,
      updated_at: now,
    }, { onConflict: "news_item_id" });
    if (socialError) throw socialError;

    await supabase.from("tnc_news_items").update({
      status: "generated",
      intelligence_score: editorial.impactScore,
      discover_score: editorial.discoverScore,
      updated_at: now,
    }).eq("id", newsItemId);

    await supabase.from("tnc_activity_logs").insert({
      event_type: "content_generated_v2",
      entity_type: "news_item",
      entity_id: newsItemId,
      message: `Pachet Intelligence generat pentru: ${item.source_title}`,
      metadata: { model, verdict: editorial.verdict, duplicateCandidates: duplicateCandidates.length },
    });

    return NextResponse.json({ ok: true, editorial, intelligence: intelligencePackage });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Eroare necunoscută la generare.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
