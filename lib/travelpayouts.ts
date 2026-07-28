import type { FlightDeal } from "@/lib/deal-engine";

const BASE_URL = "https://api.travelpayouts.com";
const ORIGINS = ["BUH", "IAS", "CLJ", "TSR", "SBZ", "CRA", "BCM", "SCV", "BUD", "VIE", "SOF"];

export class TravelpayoutsError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
    this.name = "TravelpayoutsError";
  }
}

type LatestPrice = {
  show_to_affiliates?: boolean;
  trip_class?: number;
  origin: string;
  destination: string;
  depart_date?: string;
  return_date?: string;
  number_of_changes?: number;
  value: number;
  found_at?: string;
  actual?: boolean;
};

type LatestResponse = {
  success: boolean;
  data: LatestPrice[];
  error?: string | null;
};

function getToken() {
  const token = process.env.TRAVELPAYOUTS_API_TOKEN?.trim();
  if (!token) throw new TravelpayoutsError("TRAVELPAYOUTS_API_TOKEN nu este configurat în Vercel.", 503);
  return token;
}

function getMarker() {
  const marker = process.env.TRAVELPAYOUTS_MARKER?.trim();
  if (!marker) throw new TravelpayoutsError("TRAVELPAYOUTS_MARKER nu este configurat în Vercel.", 503);
  return marker;
}

function buildSearchUrl(item: LatestPrice) {
  const query = new URLSearchParams({
    origin_iata: item.origin,
    destination_iata: item.destination,
    adults: "1",
    children: "0",
    infants: "0",
    trip_class: "0",
    currency: "EUR",
    locale: "en_us",
    one_way: item.return_date ? "false" : "true",
    marker: `${getMarker()}.tnc_deals`,
  });
  if (item.depart_date) query.set("depart_date", item.depart_date);
  if (item.return_date) query.set("return_date", item.return_date);

  // Use the international results endpoint directly. The search subdomain may
  // redirect visitors to a regional .ru host based on cookies or geolocation.
  return `https://www.aviasales.com/searches/new?${query.toString()}`;
}

function relevance(origin: string) {
  if (["BUH", "IAS", "CLJ", "TSR", "SBZ", "CRA", "BCM", "SCV"].includes(origin)) return 100;
  if (["BUD", "VIE", "SOF"].includes(origin)) return 72;
  return 40;
}

function score(price: number, origin: string, transfers = 0) {
  let value = relevance(origin) * 0.45;
  value += price <= 60 ? 45 : price <= 100 ? 36 : price <= 160 ? 27 : price <= 250 ? 18 : price <= 450 ? 12 : 7;
  value -= Math.min(12, transfers * 6);
  return Math.max(0, Math.min(100, Math.round(value)));
}

async function fetchOrigin(origin: string): Promise<LatestPrice[]> {
  const url = new URL("/v2/prices/latest", BASE_URL);
  url.searchParams.set("currency", "eur");
  url.searchParams.set("origin", origin);
  url.searchParams.set("period_type", "year");
  url.searchParams.set("page", "1");
  url.searchParams.set("limit", "30");
  url.searchParams.set("show_to_affiliates", "true");
  url.searchParams.set("sorting", "price");
  url.searchParams.set("trip_class", "0");

  const response = await fetch(url, {
    headers: {
      "X-Access-Token": getToken(),
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
    },
    next: { revalidate: 1800 },
  });

  const payload = (await response.json().catch(() => null)) as LatestResponse | null;
  if (!response.ok || !payload?.success) {
    throw new TravelpayoutsError(payload?.error || `Travelpayouts HTTP ${response.status}`, response.status);
  }
  return Array.isArray(payload.data) ? payload.data : [];
}

export async function getTravelpayoutsDeals(): Promise<FlightDeal[]> {
  getMarker();
  const batches = await Promise.allSettled(ORIGINS.map(fetchOrigin));
  const prices = batches.flatMap((batch) => batch.status === "fulfilled" ? batch.value : []);

  if (!prices.length && batches.every((batch) => batch.status === "rejected")) {
    const first = batches.find((batch): batch is PromiseRejectedResult => batch.status === "rejected");
    throw first?.reason instanceof Error ? first.reason : new TravelpayoutsError("Travelpayouts nu a returnat tarife.", 502);
  }

  const seen = new Set<string>();
  return prices
    .filter((item) => item.actual !== false && item.origin && item.destination && Number.isFinite(Number(item.value)) && Number(item.value) > 0)
    .filter((item) => {
      const key = `${item.origin}-${item.destination}-${item.depart_date}-${item.return_date}-${item.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((item, index): FlightDeal => ({
      id: `tp-${item.origin}-${item.destination}-${item.depart_date || "any"}-${index}`,
      dealType: "fare",
      title: `${item.origin} → ${item.destination} de la ${Math.round(Number(item.value))} EUR`,
      originCode: item.origin,
      destinationCode: item.destination,
      price: Math.round(Number(item.value)),
      currency: "EUR",
      bookingUrl: buildSearchUrl(item),
      departureDate: item.depart_date,
      returnDate: item.return_date || undefined,
      provider: "Travelpayouts / Aviasales",
      verified: false,
      relevanceRomania: relevance(item.origin),
      dealScore: score(Number(item.value), item.origin, item.number_of_changes),
      status: "new",
    }))
    .sort((a, b) => b.dealScore - a.dealScore || (a.price || Infinity) - (b.price || Infinity))
    .slice(0, 150);
}

export function travelpayoutsConfigured() {
  return Boolean(process.env.TRAVELPAYOUTS_API_TOKEN?.trim() && process.env.TRAVELPAYOUTS_MARKER?.trim());
}
