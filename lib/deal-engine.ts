export type FlightDeal = {
  id: string;
  dealType: "fare" | "promotion";
  title: string;
  originCode?: string;
  originName?: string;
  destinationCode?: string;
  destinationName?: string;
  airlineName?: string;
  airlineCode?: string;
  price?: number;
  currency?: string;
  originalPrice?: number;
  discountPercent?: number;
  promoCode?: string;
  bookingUrl: string;
  sourceUrl?: string;
  departureDate?: string;
  returnDate?: string;
  validUntil?: string;
  provider: string;
  verified: boolean;
  relevanceRomania: number;
  dealScore: number;
  status: "new" | "review" | "approved" | "expired" | "rejected";
  benchmarkPrice?: number;
  savingsPercent?: number;
  priceQuality?: "exceptional" | "very_good" | "good" | "normal" | "weak";
  editorialVerdict?: "PUBLICĂ ACUM" | "PUBLICĂ" | "MONITORIZEAZĂ" | "IGNORĂ";
  editorialReasons?: string[];
  discoverPotential?: number;
};

const romanianOrigins = new Set(["OTP", "BBU", "BUH", "IAS", "CLJ", "TSR", "SBZ", "CRA", "BCM", "OMR", "SCV"]);

export function scoreDeal(input: Omit<FlightDeal, "relevanceRomania" | "dealScore" | "status">): FlightDeal {
  let relevanceRomania = 20;
  if (input.originCode && romanianOrigins.has(input.originCode)) relevanceRomania += 60;
  if (input.originCode && ["BUD", "SOF", "VIE", "WAW", "FCO", "MXP"].includes(input.originCode)) relevanceRomania += 25;
  if (input.dealType === "promotion") relevanceRomania += 5;
  relevanceRomania = Math.min(100, relevanceRomania);

  let valueScore = 35;
  if (input.discountPercent) valueScore += Math.min(35, input.discountPercent);
  if (input.originalPrice && input.price && input.originalPrice > input.price) {
    valueScore += Math.min(25, Math.round(((input.originalPrice - input.price) / input.originalPrice) * 100));
  }
  if (input.verified) valueScore += 10;
  const urgency = input.validUntil ? Math.max(0, 12 - Math.floor((new Date(input.validUntil).getTime() - Date.now()) / 86400000)) : 0;
  const dealScore = Math.min(100, Math.round(valueScore * 0.55 + relevanceRomania * 0.35 + urgency));

  return { ...input, relevanceRomania, dealScore, status: "new" };
}

export const demoDeals: FlightDeal[] = [
  scoreDeal({ id: "demo-1", dealType: "fare", title: "București – Roma, tarif promoțional dus-întors", originCode: "OTP", originName: "București", destinationCode: "FCO", destinationName: "Roma", airlineName: "Companie aeriană demo", price: 79, currency: "EUR", originalPrice: 139, discountPercent: 43, bookingUrl: "#", provider: "Demo provider", verified: false }),
  scoreDeal({ id: "demo-2", dealType: "promotion", title: "Reducere la zborurile spre Asia", airlineName: "Companie aeriană demo", discountPercent: 20, promoCode: "TRAVEL20", bookingUrl: "#", provider: "Demo airline newsroom", verified: false, validUntil: new Date(Date.now() + 5 * 86400000).toISOString() }),
  scoreDeal({ id: "demo-3", dealType: "fare", title: "Budapesta – Bangkok, tarif dus-întors", originCode: "BUD", originName: "Budapesta", destinationCode: "BKK", destinationName: "Bangkok", airlineName: "Companie aeriană demo", price: 449, currency: "EUR", originalPrice: 629, discountPercent: 29, bookingUrl: "#", provider: "Demo provider", verified: false }),
];