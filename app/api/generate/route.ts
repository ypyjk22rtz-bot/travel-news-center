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
  xText: string;
  pushNotification: string;
  imagePrompt: string;
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

export async function POST(request: Request) {
  try {
    const { newsItemId } = await request.json();
    if (!newsItemId) return NextResponse.json({ error: "Lipsește newsItemId." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Supabase nu este configurat." }, { status: 500 });

    const { data: item, error: itemError } = await supabase
      .from("tnc_news_items")
      .select("*")
      .eq("id", newsItemId)
      .single();
    if (itemError || !item) return NextResponse.json({ error: itemError?.message || "Știrea nu există." }, { status: 404 });

    const { data: source } = item.source_id
      ? await supabase.from("tnc_sources").select("name, source_type, country_code").eq("id", item.source_id).maybeSingle()
      : { data: null } as any;

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY nu este configurată în Vercel." }, { status: 500 });

    const prompt = `Ești redactorul-șef al Travelistul.com. Creează în limba română un pachet editorial factual, clar și util, bazat EXCLUSIV pe informațiile sursei de mai jos. Nu inventa date, prețuri, rute, termene sau reguli. Marchează explicit în articol ce trebuie reverificat în sursa oficială. Articolul trebuie să aibă 500-700 de cuvinte, HTML curat cu paragrafe și subtitluri H2. Include impactul practic pentru călătorii români și un CTA relevant către ecosistemul Travelistul, fără linkuri inventate.

Sursă: ${source?.name || item.source_id || "Sursă oficială"}
Tip sursă: ${source?.source_type || "necunoscut"}
Țară: ${source?.country_code || "Global"}
Titlu original: ${item.source_title}
Rezumat original: ${item.source_excerpt || "Nu există rezumat."}
URL oficial: ${item.source_url}
Categorie: ${item.category}
Data publicării: ${item.source_published_at || "necunoscută"}

Returnează strict JSON cu câmpurile: seoTitle, subtitle, slug, excerpt, metaDescription, articleHtml, keywords (array), tags (array), facebook, xText, pushNotification, imagePrompt.`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
        input: prompt,
        text: { format: { type: "json_object" } },
      }),
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
      cta_html: `<!-- image-prompt: ${editorial.imagePrompt || ""} -->`,
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      prompt_version: "tnc-editorial-v1",
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

    await supabase.from("tnc_news_items").update({ status: "generated", updated_at: now }).eq("id", newsItemId);
    await supabase.from("tnc_activity_logs").insert({
      event_type: "content_generated",
      entity_type: "news_item",
      entity_id: newsItemId,
      message: `Pachet editorial generat pentru: ${item.source_title}`,
      metadata: { model: process.env.OPENAI_MODEL || "gpt-5-mini" },
    });

    return NextResponse.json({ ok: true, editorial });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Eroare necunoscută la generare.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
