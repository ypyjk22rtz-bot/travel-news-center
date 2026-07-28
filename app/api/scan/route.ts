import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { initialSources } from "@/lib/source-catalog";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { discoverFeedUrl, looksLikeFeed, parseFeed, stripMarkup } from "@/lib/rss-engine";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const revalidate = 0;

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return stripMarkup(match?.[1] ?? "Actualizare detectată").slice(0, 220);
}

async function fetchText(url: string) {
  const started = Date.now();
  const response = await fetch(url, {
    headers: {
      "User-Agent": "TravelNewsCenter/0.3 (+https://travelistul.com)",
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });
  return {
    response,
    body: await response.text(),
    durationMs: Date.now() - started,
  };
}

export async function POST() {
  const startedAt = new Date().toISOString();
  const supabase = getSupabaseAdmin();

  const sourceRows = supabase
    ? await supabase.from("tnc_sources").select("*").eq("active", true).order("name", { ascending: true }).limit(8)
    : { data: null, error: null };

  const sources = sourceRows.data?.length
    ? sourceRows.data.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        url: String(row.website_url),
        feedUrl: row.feed_url ? String(row.feed_url) : undefined,
        active: Boolean(row.active),
        country: String(row.country_code ?? "Global"),
      }))
    : initialSources.filter((source) => source.active).slice(0, 8);

  const results: Array<Record<string, unknown>> = [];
  const discoveredNews: Array<Record<string, unknown>> = [];

  for (const source of sources) {
    const checkedAt = new Date().toISOString();
    try {
      const first = await fetchText(source.feedUrl ?? source.url);
      let feedUrl = source.feedUrl ?? null;
      let feedBody = first.body;
      let response = first.response;
      let durationMs = first.durationMs;

      if (!looksLikeFeed(first.body, first.response.headers.get("content-type") ?? "")) {
        feedUrl = discoverFeedUrl(first.body, source.url);
        if (feedUrl) {
          const feed = await fetchText(feedUrl);
          feedBody = feed.body;
          response = feed.response;
          durationMs += feed.durationMs;
        }
      }

      const items = feedUrl && looksLikeFeed(feedBody, response.headers.get("content-type") ?? "")
        ? parseFeed(feedBody, feedUrl, 12)
        : [];

      if (supabase && items.length) {
        const rows = items.map((item) => ({
          source_id: source.id,
          source_url: item.url,
          canonical_url: item.url,
          source_title: item.title,
          source_excerpt: item.excerpt || null,
          source_language: null,
          country_codes: source.country && source.country !== "Global" ? [source.country] : [],
          category: item.category,
          status: "new",
          importance: "medium",
          intelligence_score: 50,
          discover_score: 50,
          factual_confidence: 70,
          content_hash: item.contentHash,
          source_published_at: item.publishedAt,
        }));

        const { data: inserted, error: insertError } = await supabase
          .from("tnc_news_items")
          .upsert(rows, { onConflict: "content_hash", ignoreDuplicates: true })
          .select("id, source_title, source_url, category");

        if (insertError) throw insertError;
        if (inserted?.length) discoveredNews.push(...inserted);
      }

      const hash = createHash("sha256").update(feedBody).digest("hex");
      results.push({
        sourceId: source.id,
        source: source.name,
        ok: response.ok,
        status: response.status,
        title: extractTitle(first.body),
        hash,
        feedUrl,
        itemsFound: items.length,
        durationMs,
        checkedAt,
      });
    } catch (error) {
      const message = error && typeof error === "object" && "message" in error ? String(error.message) : "Eroare necunoscută";
      results.push({ sourceId: source.id, source: source.name, ok: false, error: message, durationMs: 0, checkedAt });
    }
  }

  if (supabase) {
    await supabase.from("tnc_source_checks").insert(results.map((result) => ({
      source_id: result.sourceId,
      status: result.ok ? "ok" : "error",
      http_status: result.status ?? null,
      content_hash: result.hash ?? null,
      page_title: result.title ?? null,
      error_message: result.error ?? null,
      duration_ms: result.durationMs ?? null,
      items_found: result.itemsFound ?? 0,
      checked_at: result.checkedAt,
    })));
  }

  return NextResponse.json({
    mode: supabase ? "live" : "demo",
    startedAt,
    completedAt: new Date().toISOString(),
    checked: results.length,
    successful: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok).length,
    newsFound: results.reduce((sum, item) => sum + Number(item.itemsFound ?? 0), 0),
    newsInserted: discoveredNews.length,
    results,
  }, { headers: { "Cache-Control": "no-store" } });
}
