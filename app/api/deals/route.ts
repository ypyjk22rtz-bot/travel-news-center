import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getTravelpayoutsDeals, travelpayoutsConfigured } from "@/lib/travelpayouts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  if (!travelpayoutsConfigured()) {
    return NextResponse.json({
      mode: "unconfigured",
      provider: "Travelpayouts",
      deals: [],
      error: "Adaugă în Vercel TRAVELPAYOUTS_API_TOKEN și TRAVELPAYOUTS_MARKER.",
    }, { status: 503 });
  }

  try {
    const deals = await getTravelpayoutsDeals();
    const supabase = getSupabaseAdmin();

    if (supabase && deals.length) {
      const rows = deals.map((deal) => ({
        external_id: deal.id,
        deal_type: deal.dealType,
        title: deal.title,
        origin: deal.originCode ?? null,
        destination: deal.destinationCode ?? null,
        airline_code: deal.airlineCode ?? null,
        airline_name: deal.airlineName ?? null,
        price: deal.price ?? null,
        previous_price: deal.originalPrice ?? null,
        currency: deal.currency ?? null,
        discount_percent: deal.discountPercent ?? null,
        travel_start: deal.departureDate ?? null,
        travel_end: deal.returnDate ?? null,
        booking_deadline: deal.validUntil ?? null,
        promo_code: deal.promoCode ?? null,
        booking_url: deal.bookingUrl,
        provider: deal.provider,
        verified: deal.verified,
        relevance_romania: deal.relevanceRomania,
        deal_score: deal.dealScore,
        status: deal.status,
        last_seen_at: new Date().toISOString(),
      }));

      await supabase.from("flight_deals").upsert(rows, { onConflict: "external_id" });
    }

    return NextResponse.json({
      mode: "live",
      provider: "Travelpayouts",
      cachedPrices: true,
      disclaimer: "Prețuri găsite recent în cache-ul Travelpayouts. Tariful final se reconfirmă în pagina de căutare.",
      fetchedAt: new Date().toISOString(),
      deals,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Eroare necunoscută Travelpayouts.";
    return NextResponse.json({ mode: "error", provider: "Travelpayouts", deals: [], error: message }, { status: 502 });
  }
}
