import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getTravelpayoutsDeals, travelpayoutsConfigured } from "@/lib/travelpayouts";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!travelpayoutsConfigured()) {
    return NextResponse.json({
      mode: "unconfigured",
      provider: "Travelpayouts",
      deals: [],
      error: "TRAVELPAYOUTS_API_TOKEN nu este configurat în Vercel.",
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
        origin: deal.origin,
        destination: deal.destination,
        airline_code: deal.airlineCode,
        airline_name: deal.airlineName,
        price: deal.price,
        previous_price: deal.previousPrice,
        currency: deal.currency,
        discount_percent: deal.discountPercent,
        travel_start: deal.travelStart,
        travel_end: deal.travelEnd,
        booking_deadline: deal.bookingDeadline,
        promo_code: deal.promoCode,
        booking_url: deal.bookingUrl,
        provider: deal.provider,
        verified: false,
        relevance_romania: deal.relevanceRomania,
        deal_score: deal.dealScore,
        status: "new",
        last_seen_at: new Date().toISOString(),
      }));

      await supabase.from("flight_deals").upsert(rows, { onConflict: "external_id" });
    }

    return NextResponse.json({
      mode: "live",
      provider: "Travelpayouts",
      cachedPrices: true,
      fetchedAt: new Date().toISOString(),
      deals,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Eroare necunoscută Travelpayouts.";
    return NextResponse.json({ mode: "error", provider: "Travelpayouts", deals: [], error: message }, { status: 502 });
  }
}
