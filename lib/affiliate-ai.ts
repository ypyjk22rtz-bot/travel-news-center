import type { EditorialPackage } from "@/lib/ai-writer";

type AffiliateOffer = {
  id: string;
  title: string;
  description: string;
  url: string;
  score: number;
};

function configuredUrl(name: string) {
  const value = process.env[name]?.trim();
  return value && /^https?:\/\//i.test(value) ? value : "";
}

function corpus(editorial: EditorialPackage) {
  return [
    editorial.seoTitle,
    editorial.metaDescription,
    editorial.excerpt,
    editorial.article.replace(/<[^>]+>/g, " "),
    ...(editorial.keywords || []),
    ...(editorial.tags || []),
  ].join(" ").toLowerCase();
}

function containsAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

export function selectAffiliateOffers(editorial: EditorialPackage): AffiliateOffer[] {
  const text = corpus(editorial);
  const offers: AffiliateOffer[] = [];

  const add = (offer: Omit<AffiliateOffer, "url"> & { env: string }) => {
    const url = configuredUrl(offer.env);
    if (!url) return;
    offers.push({ id: offer.id, title: offer.title, description: offer.description, score: offer.score, url });
  };

  const flightIntent = containsAny(text, ["zbor", "zboruri", "rută", "ruta", "aeroport", "companie aeriană", "bilet", "bilete", "flight", "airline"]);
  const hotelIntent = containsAny(text, ["hotel", "cazare", "destinație", "destinatie", "vacanță", "vacanta", "city break", "stațiune", "statiune"]);
  const esimIntent = containsAny(text, ["asia", "japonia", "china", "thailanda", "vietnam", "sua", "america", "roaming", "internet", "esim", "telefon"]);
  const insuranceIntent = containsAny(text, ["siguranță", "siguranta", "incident", "accident", "uragan", "cutremur", "vulcan", "avertizare", "medical", "asigurare"]);
  const transportIntent = containsAny(text, ["tren", "autobuz", "feribot", "transfer", "transport", "thailanda", "vietnam", "laos", "cambodgia", "asia de sud-est"]);
  const activityIntent = containsAny(text, ["atracție", "atractie", "muzeu", "tur", "excursie", "activități", "activitati", "ce să vizitezi", "ce sa vizitezi"]);
  const compensationIntent = containsAny(text, ["anulat", "anulare", "întârziere", "intarziere", "perturbare", "grevă", "greva", "compensație", "compensatie"]);

  if (flightIntent) add({ id: "flights", env: "AFFILIATE_FLIGHTS_URL", title: "Caută zboruri", description: "Compară tarifele disponibile în Portal Travelistul.", score: 100 });
  if (hotelIntent) add({ id: "hotels", env: "AFFILIATE_HOTELS_URL", title: "Găsește cazare", description: "Compară hoteluri și opțiuni de cazare pentru destinație.", score: 88 });
  if (esimIntent) add({ id: "esim", env: "AFFILIATE_ESIM_URL", title: "Internet în călătorie", description: "Verifică opțiunile eSIM înainte de plecare.", score: 82 });
  if (insuranceIntent) add({ id: "insurance", env: "AFFILIATE_INSURANCE_URL", title: "Asigurare de călătorie", description: "Compară protecția potrivită pentru călătoria ta.", score: 86 });
  if (transportIntent) add({ id: "transport", env: "AFFILIATE_TRANSPORT_URL", title: "Transport local", description: "Caută trenuri, autobuze, feriboturi și transferuri.", score: 80 });
  if (activityIntent) add({ id: "activities", env: "AFFILIATE_ACTIVITIES_URL", title: "Tururi și activități", description: "Descoperă experiențe și bilete pentru atracții.", score: 76 });
  if (compensationIntent) add({ id: "airhelp", env: "AFFILIATE_AIRHELP_URL", title: "Verifică despăgubirea", description: "Află dacă zborul întârziat sau anulat este eligibil pentru compensație.", score: 96 });

  return offers.sort((a, b) => b.score - a.score).slice(0, 3);
}

export function affiliateOffersHtml(editorial: EditorialPackage) {
  const offers = selectAffiliateOffers(editorial);
  if (!offers.length) return "";

  const cards = offers.map((offer) => `
    <div style="flex:1 1 210px;min-width:0;padding:16px;border:1px solid #dbeafe;border-radius:12px;background:#fff;">
      <strong style="display:block;margin-bottom:6px;font-size:17px;">${offer.title}</strong>
      <span style="display:block;margin-bottom:14px;color:#475569;line-height:1.5;">${offer.description}</span>
      <a href="${offer.url}" target="_blank" rel="nofollow sponsored noopener" style="display:inline-block;padding:10px 15px;border-radius:8px;background:#0b63ce;color:#fff;text-decoration:none;font-weight:700;">Vezi oferta</a>
    </div>`).join("");

  return `
<section style="margin:30px 0;padding:22px;border:1px solid #bfdbfe;border-radius:16px;background:#f8fbff;">
  <h2 style="margin:0 0 8px;font-size:24px;">Planifică această călătorie</h2>
  <p style="margin:0 0 18px;color:#475569;">Recomandări selectate automat în funcție de subiectul articolului.</p>
  <div style="display:flex;flex-wrap:wrap;gap:12px;">${cards}</div>
  <small style="display:block;margin-top:14px;color:#64748b;">Unele linkuri sunt afiliate. Travelistul poate primi un comision fără cost suplimentar pentru cititor.</small>
</section>`;
}
