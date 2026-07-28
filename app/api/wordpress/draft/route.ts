import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { generateFeaturedImage } from "@/lib/openai-image";
import { createWordPressPost, getWordPressConfig, uploadWordPressMedia } from "@/lib/wordpress";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function extractImagePrompt(ctaHtml: string | null | undefined, fallback: string) {
  const match = ctaHtml?.match(/<!--\s*image-prompt:\s*([\s\S]*?)\s*-->/i);
  return match?.[1]?.trim() || `Editorial travel news image illustrating: ${fallback}`;
}

function safeFilename(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "travel-news-featured-image";
}

export async function POST(request: Request) {
  try {
    const { newsItemId } = await request.json();
    if (!newsItemId) return NextResponse.json({ error: "Lipsește newsItemId." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const config = getWordPressConfig();
    if (!supabase) return NextResponse.json({ error: "Supabase nu este configurat." }, { status: 500 });
    if (!config) return NextResponse.json({ error: "WordPress nu este configurat în Vercel." }, { status: 500 });

    const [{ data: item, error: itemError }, { data: generated, error: generatedError }, { data: social }] = await Promise.all([
      supabase.from("tnc_news_items").select("*").eq("id", newsItemId).single(),
      supabase.from("tnc_generated_content").select("*").eq("news_item_id", newsItemId).single(),
      supabase.from("tnc_social_content").select("*").eq("news_item_id", newsItemId).maybeSingle(),
    ]);

    if (itemError || !item) return NextResponse.json({ error: itemError?.message || "Știrea nu există." }, { status: 404 });
    if (generatedError || !generated) return NextResponse.json({ error: "Generează mai întâi pachetul editorial AI." }, { status: 400 });

    const { data: source } = item.source_id
      ? await supabase.from("tnc_sources").select("name").eq("id", item.source_id).maybeSingle()
      : { data: null } as any;

    const editorial = {
      seoTitle: generated.seo_title || item.source_title,
      slug: generated.slug || "",
      excerpt: generated.excerpt || item.source_excerpt || "",
      metaDescription: generated.meta_description || "",
      article: generated.article_html || "",
      keywords: generated.keywords || [],
      tags: generated.tags || [],
      facebook: social?.facebook || "",
      x: social?.x_text || "",
      pushTitle: generated.seo_title || item.source_title,
      pushBody: social?.push_notification || "",
      sourceNote: "Informație verificată în sursa oficială înainte de publicare.",
      sourceName: source?.name || item.source_id || "Sursa oficială",
      sourceUrl: item.source_url,
    };

    const job = await supabase.from("tnc_publication_jobs").insert({
      news_item_id: newsItemId,
      destination: "travelistul.com",
      requested_status: "draft",
      status: "processing",
    }).select("id").single();

    try {
      const imagePrompt = extractImagePrompt(generated.cta_html, editorial.seoTitle);
      const image = await generateFeaturedImage(imagePrompt);
      const media = await uploadWordPressMedia(
        config,
        image.bytes,
        `${safeFilename(editorial.slug || editorial.seoTitle)}.${image.extension}`,
        image.mimeType,
        editorial.seoTitle,
      );

      const post = await createWordPressPost(config, editorial, "draft", media.id);
      const now = new Date().toISOString();
      await supabase.from("tnc_news_items").update({ status: "wordpress_draft", updated_at: now }).eq("id", newsItemId);
      if (job.data?.id) {
        await supabase.from("tnc_publication_jobs").update({
          wordpress_post_id: post.id,
          wordpress_url: post.editLink,
          status: "completed",
          completed_at: now,
        }).eq("id", job.data.id);
      }
      await supabase.from("tnc_activity_logs").insert({
        event_type: "wordpress_draft_created",
        entity_type: "news_item",
        entity_id: newsItemId,
        message: `Draft WordPress cu featured image creat: ${editorial.seoTitle}`,
        metadata: {
          wordpressPostId: post.id,
          editLink: post.editLink,
          featuredMediaId: media.id,
          featuredImageUrl: media.sourceUrl,
          imageModel: image.model,
        },
      });
      return NextResponse.json({ ok: true, post, featuredImage: media });
    } catch (publishError) {
      const message = publishError instanceof Error ? publishError.message : "Eroare la crearea draftului.";
      if (job.data?.id) await supabase.from("tnc_publication_jobs").update({ status: "failed", error_message: message }).eq("id", job.data.id);
      throw publishError;
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Eroare WordPress." }, { status: 500 });
  }
}
