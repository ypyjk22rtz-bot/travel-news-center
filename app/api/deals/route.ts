import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getTravelpayoutsDeals, travelpayoutsConfigured } from "@/lib/travelpayouts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const configured = travelpayoutsConfigured();

  if (!configured) {
    return NextResponse.json({
      mode: "unconfigured",
      provider: "Travelpayouts",
      configured: false,
      deals: [],
      error: "Adaugă în Vercel TRAVELPAYOUTS_API_TOKEN și TRAVELPAYOUTS_MARKER, apoi pornește un redeploy.",
    }, { status: 503 });
  }

  try {
    const fetchedAt = new Date().toISOString();
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
        last_seen_at: fetchedAt,
      }));

      await supabase.from("flight_deals").upsert(rows, { onConflict: "external_id" });
    }

    const origins = Array.from(new Set(deals.map((deal) => deal.originCode).filter(Boolean)));

    return NextResponse.json({
      mode: "live",
      provider: "Travelpayouts",
      configured: true,
      connection: "active",
      cachedPrices: true,
      fetchedAt,
      originsChecked: origins.length,
      dealsCount: deals.length,
      disclaimer: "Prețuri găsite recent în cache-ul Travelpayouts. Tariful final se reconfirmă în pagina de căutare.",
      deals,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Eroare necunoscută Travelpayouts.";
    return NextResponse.json({
      mode: "error",
      provider: "Travelpayouts",
      configured: true,
      connection: "failed",
      deals: [],
      error: message,
    }, { status: 502 });
  }
}
