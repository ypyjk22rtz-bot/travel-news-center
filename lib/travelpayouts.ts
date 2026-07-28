import type { FlightDeal } from "@/lib/deal-engine";

const BASE_URL = "https://api.travelpayouts.com";
const ORIGINS = ["BUH", "IAS", "CLJ", "TSR", "SBZ", "CRA", "BCM", "SCV", "BUD", "VIE", "SOF"];
const ASIA = new Set(["BKK", "HKT", "SIN", "KUL", "HKG", "NRT", "HND", "KIX", "ICN", "PEK", "PKX", "PVG", "CAN", "SZX", "DPS", "SGN", "HAN", "DAD", "MNL", "CEB", "DEL", "BOM", "CMB"]);

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

type LatestResponse = { success: boolean; data: LatestPrice[]; error?: string | null };

function clamp(value: number) { return Math.max(0, Math.min(100, Math.round(value))); }
function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

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
  const query = new URLSearchParams({ origin: item.origin, destination: item.destination, adults: "1", cabin: "economy", currency: "EUR", source: "travel-news-center", sub_id: "tnc_deals", marker: getMarker() });
  if (item.depart_date) query.set("depart_date", item.depart_date);
  if (item.return_date) query.set("return_date", item.return_date);
  return `https://portal.travelistul.com/?${query.toString()}`;
}

function relevance(origin: string) {
  if (["BUH", "IAS", "CLJ", "TSR", "SBZ", "CRA", "BCM", "SCV"].includes(origin)) return 100;
  if (["BUD", "VIE", "SOF"].includes(origin)) return 72;
  return 40;
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

  const response = await fetch(url, { headers: { "X-Access-Token": getToken(), Accept: "application/json", "Accept-Encoding": "gzip, deflate" }, next: { revalidate: 1800 } });
  const payload = (await response.json().catch(() => null)) as LatestResponse | null;
  if (!response.ok || !payload?.success) throw new TravelpayoutsError(payload?.error || `Travelpayouts HTTP ${response.status}`, response.status);
  return Array.isArray(payload.data) ? payload.data : [];
}

function intelligence(item: LatestPrice, benchmark: number) {
  const price = Number(item.value);
  const savingsPercent = benchmark > 0 ? Math.max(0, Math.round(((benchmark - price) / benchmark) * 100)) : 0;
  const romania = relevance(item.origin);
  const transfers = Number(item.number_of_changes || 0);
  const asiaBonus = ASIA.has(item.destination) ? 10 : 0;
  const priceScore = savingsPercent >= 40 ? 100 : savingsPercent >= 30 ? 92 : savingsPercent >= 20 ? 82 : savingsPercent >= 10 ? 68 : price <= 60 ? 72 : price <= 120 ? 62 : price <= 250 ? 52 : 42;
  const dealScore = clamp(priceScore * 0.5 + romania * 0.32 + asiaBonus - Math.min(12, transfers * 6));
  const discoverPotential = clamp(dealScore * 0.58 + romania * 0.22 + asiaBonus + (price <= 100 ? 10 : 0));
  const priceQuality: FlightDeal["priceQuality"] = savingsPercent >= 35 ? "exceptional" : savingsPercent >= 25 ? "very_good" : savingsPercent >= 15 ? "good" : savingsPercent >= 5 ? "normal" : "weak";
  const editorialVerdict: FlightDeal["editorialVerdict"] = dealScore >= 86 && savingsPercent >= 25 ? "PUBLICĂ ACUM" : dealScore >= 72 ? "PUBLICĂ" : dealScore >= 55 ? "MONITORIZEAZĂ" : "IGNORĂ";
  const reasons: string[] = [];
  if (savingsPercent >= 25) reasons.push(`Tariful este cu aproximativ ${savingsPercent}% sub benchmarkul ofertelor curente.`);
  if (romania === 100) reasons.push("Plecare directă din România.");
  else if (romania >= 70) reasons.push("Plecare dintr-un aeroport apropiat României.");
  if (ASIA.has(item.destination)) reasons.push("Destinație asiatică cu interes ridicat pentru Travelistul.");
  if (transfers === 0) reasons.push("Rută fără escală în datele furnizate.");
  if (!reasons.length) reasons.push("Preț orientativ; merită urmărit înainte de publicare.");
  return { benchmarkPrice: Math.round(benchmark || price), savingsPercent, priceQuality, editorialVerdict, editorialReasons: reasons.slice(0, 4), dealScore, discoverPotential };
}

export async function getTravelpayoutsDeals(): Promise<FlightDeal[]> {
  getMarker();
  const batches = await Promise.allSettled(ORIGINS.map(fetchOrigin));
  const prices = batches.flatMap((batch) => batch.status === "fulfilled" ? batch.value : []);
  if (!prices.length && batches.every((batch) => batch.status === "rejected")) {
    const first = batches.find((batch): batch is PromiseRejectedResult => batch.status === "rejected");
    throw first?.reason instanceof Error ? first.reason : new TravelpayoutsError("Travelpayouts nu a returnat tarife.", 502);
  }

  const clean = prices.filter((item) => item.actual !== false && item.origin && item.destination && Number.isFinite(Number(item.value)) && Number(item.value) > 0);
  const routeBenchmarks = new Map<string, number[]>();
  const destinationBenchmarks = new Map<string, number[]>();
  for (const item of clean) {
    const route = `${item.origin}-${item.destination}`;
    routeBenchmarks.set(route, [...(routeBenchmarks.get(route) || []), Number(item.value)]);
    destinationBenchmarks.set(item.destination, [...(destinationBenchmarks.get(item.destination) || []), Number(item.value)]);
  }

  const seen = new Set<string>();
  return clean.filter((item) => {
    const key = `${item.origin}-${item.destination}-${item.depart_date}-${item.return_date}-${item.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((item, index): FlightDeal => {
    const routeValues = routeBenchmarks.get(`${item.origin}-${item.destination}`) || [];
    const benchmark = routeValues.length >= 3 ? median(routeValues) : median(destinationBenchmarks.get(item.destination) || [Number(item.value)]);
    const intel = intelligence(item, benchmark);
    return {
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
      dealScore: intel.dealScore,
      status: "new",
      benchmarkPrice: intel.benchmarkPrice,
      savingsPercent: intel.savingsPercent,
      priceQuality: intel.priceQuality,
      editorialVerdict: intel.editorialVerdict,
      editorialReasons: intel.editorialReasons,
      discoverPotential: intel.discoverPotential,
    };
  }).sort((a, b) => b.dealScore - a.dealScore || (b.savingsPercent || 0) - (a.savingsPercent || 0) || (a.price || Infinity) - (b.price || Infinity)).slice(0, 150);
}

export function travelpayoutsConfigured() {
  return Boolean(process.env.TRAVELPAYOUTS_API_TOKEN?.trim() && process.env.TRAVELPAYOUTS_MARKER?.trim());
}