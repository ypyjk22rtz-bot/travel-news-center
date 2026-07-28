import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DealPayload = {
  id?: string;
  title?: string;
  originCode?: string;
  destinationCode?: string;
  price?: number;
  currency?: string;
  departureDate?: string;
  returnDate?: string;
  airlineName?: string;
  bookingUrl?: string;
  provider?: string;
  dealScore?: number;
};

export async function POST(request: Request) {
  try {
    const { deal } = await request.json() as { deal?: DealPayload };
    if (!deal?.title || !deal.bookingUrl) {
      return NextResponse.json({ error: "Oferta nu conține suficiente informații." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Supabase nu este configurat." }, { status: 500 });

    const route = [deal.originCode, deal.destinationCode].filter(Boolean).join(" → ");
    const dates = [deal.departureDate, deal.returnDate].filter(Boolean).join(" – ");
    const price = typeof deal.price === "number" ? `${deal.price} ${deal.currency || "EUR"}` : "preț de verificat";
    const excerpt = `Ofertă de zbor detectată pentru ${route || "o rută relevantă"}, de la ${price}. ${dates ? `Perioadă: ${dates}. ` : ""}Tariful provine din cache-ul Travelpayouts și trebuie reconfirmat înainte de publicare.`;
    const hash = createHash("sha256").update(`travelpayouts:${deal.id || deal.title}:${deal.bookingUrl}`).digest("hex");

    const { data, error } = await supabase.from("tnc_news_items").upsert({
      source_id: null,
      source_url: deal.bookingUrl,
      canonical_url: deal.bookingUrl,
      source_title: deal.title,
      source_excerpt: excerpt,
      source_language: "ro",
      country_codes: [],
      category: "Promoții",
      status: "new",
      importance: (deal.dealScore || 0) >= 80 ? "important" : "medium",
      intelligence_score: Math.max(50, Math.min(100, deal.dealScore || 65)),
      discover_score: Math.max(50, Math.min(100, (deal.dealScore || 65) - 3)),
      factual_confidence: 65,
      content_hash: hash,
      source_published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "content_hash" }).select("id").single();

    if (error) throw error;

    await supabase.from("tnc_activity_logs").insert({
      event_type: "deal_sent_to_approval",
      entity_type: "news_item",
      entity_id: data?.id || null,
      message: `Oferta a fost trimisă în Approval Center: ${deal.title}`,
      metadata: { provider: deal.provider || "Travelpayouts", route, price },
    });

    return NextResponse.json({ ok: true, newsItemId: data?.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Oferta nu a putut fi trimisă în Approval Center." }, { status: 500 });
  }
}
