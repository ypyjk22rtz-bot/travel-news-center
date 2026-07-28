import type { FlightDeal } from "@/lib/deal-engine";

const BASE_URL = "https://api.travelpayouts.com";
const ORIGINS = ["BUH", "IAS", "CLJ", "TSR", "SBZ", "CRA", "BUD", "VIE", "SOF"];

export class TravelpayoutsError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
    this.name = "TravelpayoutsError";
  }
}

type LatestPrice = {
  origin: string;
  destination: string;
  price: number;
  airline?: string;
  flight_number?: string | number;
  departure_at?: string;
  return_at?: string;
  transfers?: number;
  expires_at?: string;
  link?: string;
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

function bookingUrl(link?: string) {
  if (!link) return "https://www.aviasales.com/";
  if (/^https?:\/\//i.test(link)) return link;
  return `https://www.aviasales.com${link.startsWith("/") ? "" : "/"}${link}`;
}

function relevance(origin: string) {
  if (["BUH", "IAS", "CLJ", "TSR", "SBZ", "CRA"].includes(origin)) return 100;
  if (["BUD", "VIE", "SOF"].includes(origin)) return 72;
  return 40;
}

function score(price: number, origin: string, transfers = 0) {
  let value = relevance(origin) * 0.45;
  value += price <= 60 ? 45 : price <= 100 ? 36 : price <= 160 ? 27 : price <= 250 ? 18 : 10;
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
  const batches = await Promise.allSettled(ORIGINS.map(fetchOrigin));
  const prices = batches.flatMap((batch) => batch.status === "fulfilled" ? batch.value : []);

  if (!prices.length && batches.every((batch) => batch.status === "rejected")) {
    const first = batches.find((batch): batch is PromiseRejectedResult => batch.status === "rejected");
    throw first?.reason instanceof Error ? first.reason : new TravelpayoutsError("Travelpayouts nu a returnat tarife.", 502);
  }

  const seen = new Set<string>();
  return prices
    .filter((item) => item.origin && item.destination && Number.isFinite(item.price))
    .filter((item) => {
      const key = `${item.origin}-${item.destination}-${item.departure_at}-${item.price}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((item, index): FlightDeal => ({
      id: `tp-${item.origin}-${item.destination}-${index}`,
      dealType: "fare",
      title: `${item.origin} → ${item.destination} de la ${Math.round(item.price)} EUR`,
      originCode: item.origin,
      destinationCode: item.destination,
      airlineCode: item.airline,
      airlineName: item.airline,
      price: Math.round(item.price),
      currency: "EUR",
      bookingUrl: bookingUrl(item.link),
      departureDate: item.departure_at,
      returnDate: item.return_at,
      validUntil: item.expires_at,
      provider: "Travelpayouts / Aviasales",
      verified: false,
      relevanceRomania: relevance(item.origin),
      dealScore: score(item.price, item.origin, item.transfers),
      status: "new",
    }))
    .sort((a, b) => b.dealScore - a.dealScore || (a.price || Infinity) - (b.price || Infinity))
    .slice(0, 150);
}

export function travelpayoutsConfigured() {
  return Boolean(process.env.TRAVELPAYOUTS_API_TOKEN?.trim());
}
