import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { initialSources } from "@/lib/source-catalog";
import { romanianSources } from "@/lib/romanian-sources";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { discoverFeedUrl, looksLikeFeed, parseFeed, stripMarkup } from "@/lib/rss-engine";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";
export const revalidate = 0;

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return stripMarkup(match?.[1] ?? "Actualizare detectată").slice(0, 220);
}

async function fetchText(url: string, timeoutMs = 12000) {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Travelistul-News-Center/1.0 (+https://travelistul.com)",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8",
      },
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
    });
    return {
      response,
      body: await response.text(),
      durationMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveFeed(source: { url: string; feedUrl?: string }) {
  const first = await fetchText(source.feedUrl ?? source.url);
  if (looksLikeFeed(first.body, first.response.headers.get("content-type") ?? "")) {
    return { feedUrl: first.response.url, feedBody: first.body, response: first.response, durationMs: first.durationMs, pageBody: first.body };
  }

  const discovered = discoverFeedUrl(first.body, first.response.url || source.url);
  if (discovered) {
    const feed = await fetchText(discovered);
    if (looksLikeFeed(feed.body, feed.response.headers.get("content-type") ?? "")) {
      return { feedUrl: feed.response.url, feedBody: feed.body, response: feed.response, durationMs: first.durationMs + feed.durationMs, pageBody: first.body };
    }
  }

  const origin = new URL(first.response.url || source.url).origin;
  const candidates = ["/feed/", "/feed", "/rss", "/rss.xml", "/feed.xml", "/atom.xml"];
  for (const path of candidates) {
    try {
      const candidate = new URL(path, origin).toString();
      const feed = await fetchText(candidate, 7000);
      if (looksLikeFeed(feed.body, feed.response.headers.get("content-type") ?? "")) {
        return { feedUrl: feed.response.url, feedBody: feed.body, response: feed.response, durationMs: first.durationMs + feed.durationMs, pageBody: first.body };
      }
    } catch {
      // încearcă următoarea adresă uzuală
    }
  }

  return { feedUrl: null, feedBody: first.body, response: first.response, durationMs: first.durationMs, pageBody: first.body };
}

function score(title: string, excerpt: string, country: string) {
  const text = `${title} ${excerpt}`.toLowerCase();
  let intelligence = 46;
  let discover = 42;
  if (country === "RO" || /romania|românia|bucharest|bucurești|bucuresti|cluj|iasi|iași|timisoara|timișoara|otp|buh|clj|ias|tsr/.test(text)) {
    intelligence += 24;
    discover += 18;
  }
  if (/new route|route launch|direct flight|ruta nou|zbor direct|resume|resumes/.test(text)) {
    intelligence += 18;
    discover += 16;
  }
  if (/visa|viză|viza|passport|entry requirement/.test(text)) {
    intelligence += 20;
    discover += 18;
  }
  if (/strike|grev|cancel|delay|closure|incident|emergency|warning|alert/.test(text)) {
    intelligence += 20;
    discover += 20;
  }
  if (/deal|sale|discount|promo|fare|price|ofert/.test(text)) {
    intelligence += 12;
    discover += 14;
  }
  intelligence = Math.max(0, Math.min(100, intelligence));
  discover = Math.max(0, Math.min(100, discover));
  return {
    intelligence,
    discover,
    importance: intelligence >= 85 ? "critical" : intelligence >= 70 ? "high" : intelligence >= 50 ? "medium" : "low",
  };
}

async function scan(request: Request) {
  const startedAt = new Date().toISOString();
  const supabase = getSupabaseAdmin();
  const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
  const requestedLimit = Number(body.limit || 16);
  const limit = Math.max(1, Math.min(24, requestedLimit));

  const sourceRows = supabase
    ? await supabase.from("tnc_sources").select("*").eq("active", true).order("id", { ascending: true })
    : { data: null, error: null };

  if (sourceRows.error) throw sourceRows.error;

  const fallback = [...romanianSources, ...initialSources].filter((source) => source.active);
  const allSources = sourceRows.data?.length
    ? sourceRows.data.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        url: String(row.website_url),
        feedUrl: row.feed_url ? String(row.feed_url) : undefined,
        active: Boolean(row.active),
        country: String(row.country_code ?? "Global"),
      }))
    : fallback;

  if (!allSources.length) throw new Error("Nu există surse active.");

  const explicitOffset = body.offset === undefined ? null : Number(body.offset);
  const rotatingOffset = Math.floor(Date.now() / (15 * 60 * 1000)) * limit % allSources.length;
  const start = Number.isFinite(explicitOffset) && explicitOffset !== null ? Math.max(0, explicitOffset) % allSources.length : rotatingOffset;
  const sources = Array.from({ length: Math.min(limit, allSources.length) }, (_, index) => allSources[(start + index) % allSources.length]);

  const results: Array<Record<string, unknown>> = [];
  const discoveredNews: Array<Record<string, unknown>> = [];

  for (const source of sources) {
    const checkedAt = new Date().toISOString();
    try {
      const resolved = await resolveFeed(source);
      const items = resolved.feedUrl && looksLikeFeed(resolved.feedBody, resolved.response.headers.get("content-type") ?? "")
        ? parseFeed(resolved.feedBody, resolved.feedUrl, 15)
        : [];

      if (supabase && items.length) {
        const rows = items.map((item) => {
          const ranking = score(item.title, item.excerpt, source.country);
          return {
            source_id: source.id,
            source_url: item.url,
            canonical_url: item.url,
            source_title: item.title,
            source_excerpt: item.excerpt || null,
            source_language: null,
            country_codes: source.country && source.country !== "Global" ? [source.country] : [],
            category: item.category,
            status: "new",
            importance: ranking.importance,
            intelligence_score: ranking.intelligence,
            discover_score: ranking.discover,
            factual_confidence: 72,
            content_hash: item.contentHash,
            source_published_at: item.publishedAt,
          };
        });

        const { data: inserted, error: insertError } = await supabase
          .from("tnc_news_items")
          .upsert(rows, { onConflict: "content_hash", ignoreDuplicates: true })
          .select("id, source_title, source_url, category");

        if (insertError) throw insertError;
        if (inserted?.length) discoveredNews.push(...inserted);
      }

      if (supabase && resolved.feedUrl && !source.feedUrl) {
        await supabase.from("tnc_sources").update({ feed_url: resolved.feedUrl, method: "rss", updated_at: checkedAt }).eq("id", source.id);
      }

      const hash = createHash("sha256").update(resolved.feedBody).digest("hex");
      results.push({
        sourceId: source.id,
        source: source.name,
        country: source.country,
        ok: resolved.response.ok,
        status: resolved.response.status,
        title: extractTitle(resolved.pageBody),
        hash,
        feedUrl: resolved.feedUrl,
        itemsFound: items.length,
        durationMs: resolved.durationMs,
        checkedAt,
      });
    } catch (error) {
      const message = error && typeof error === "object" && "message" in error ? String(error.message) : "Eroare necunoscută";
      results.push({ sourceId: source.id, source: source.name, country: source.country, ok: false, error: message, durationMs: 0, checkedAt });
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

    await supabase.from("tnc_activity_logs").insert({
      event_type: "scanner_run",
      entity_type: "system",
      message: `Scanner: ${results.length} surse, ${discoveredNews.length} știri noi.`,
      metadata: { start, nextOffset: (start + sources.length) % allSources.length, failed: results.filter((item) => !item.ok).length },
    });
  }

  return NextResponse.json({
    mode: supabase ? "live" : "demo",
    startedAt,
    completedAt: new Date().toISOString(),
    catalogSize: allSources.length,
    offset: start,
    nextOffset: (start + sources.length) % allSources.length,
    checked: results.length,
    successful: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok).length,
    newsFound: results.reduce((sum, item) => sum + Number(item.itemsFound ?? 0), 0),
    newsInserted: discoveredNews.length,
    results,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    return await scan(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scanarea a eșuat.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    return await scan(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scanarea a eșuat.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
