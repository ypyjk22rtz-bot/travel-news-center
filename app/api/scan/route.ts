import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { initialSources } from "@/lib/source-catalog";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

function stripHtml(value: string) {
  return value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return stripHtml(match?.[1] ?? "Actualizare detectată").slice(0, 220);
}

export async function POST() {
  const startedAt = new Date().toISOString();
  const sources = initialSources.filter((source) => source.active).slice(0, 8);
  const results = [] as Array<Record<string, unknown>>;

  for (const source of sources) {
    try {
      const response = await fetch(source.feedUrl ?? source.url, {
        headers: { "User-Agent": "TravelNewsCenter/0.2 (+https://travelistul.com)" },
        redirect: "follow",
        signal: AbortSignal.timeout(12000),
        cache: "no-store",
      });
      const body = await response.text();
      const hash = createHash("sha256").update(body).digest("hex");
      results.push({
        sourceId: source.id,
        source: source.name,
        ok: response.ok,
        status: response.status,
        title: extractTitle(body),
        hash,
        checkedAt: new Date().toISOString(),
      });
    } catch (error) {
      results.push({
        sourceId: source.id,
        source: source.name,
        ok: false,
        error: error instanceof Error ? error.message : "Eroare necunoscută",
        checkedAt: new Date().toISOString(),
      });
    }
  }

  const supabase = getSupabaseAdmin();
  if (supabase) {
    await supabase.from("source_checks").insert(results.map((result) => ({
      source_id: result.sourceId,
      status: result.ok ? "ok" : "error",
      http_status: result.status ?? null,
      content_hash: result.hash ?? null,
      error_message: result.error ?? null,
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
    results,
  });
}
