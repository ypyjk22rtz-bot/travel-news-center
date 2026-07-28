import type { IntelligenceResult } from "@/lib/intelligence-engine";

export type EditorialPackage = {
  seoTitle: string;
  slug: string;
  excerpt: string;
  metaDescription: string;
  article: string;
  keywords: string[];
  tags: string[];
  facebook: string;
  x: string;
  pushTitle: string;
  pushBody: string;
  sourceNote: string;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function trim(value: string, max: number) {
  return value.length <= max ? value : `${value.slice(0, max - 1).trim()}…`;
}

export function buildFallbackPackage(item: IntelligenceResult): EditorialPackage {
  const seoTitle = trim(`${item.title}: ce trebuie să știe călătorii români`, 68);
  const keywords = [item.category, item.country, "știri călătorii", "Travelistul", "călători români"];
  const sourceNote = `Sursa oficială consultată: ${item.source}. Informația trebuie verificată editorial înainte de publicare.`;
  const article = `
<p><strong>${item.title}</strong> este una dintre informațiile cu impact potențial ridicat detectate de Travel News Center. Anunțul provine de la ${item.source} și vizează ${item.country}.</p>

<h2>Ce s-a anunțat</h2>
<p>${item.summary}</p>

<h2>De ce este important pentru călătorii români</h2>
<p>Travel Intelligence Engine a acordat acestei informații un scor de ${item.totalScore}/100. Impactul estimat pentru publicul din România este ${item.romaniaImpact}/100, iar potențialul pentru Google Discover este ${item.discoverScore}/100.</p>
<p>${item.reasons.join(" ")}</p>

<h2>Ce trebuie verificat înainte de plecare</h2>
<p>Călătorii trebuie să consulte pagina oficială înainte de rezervare sau plecare. Regulile privind vizele, taxele, bagajele, orarele și condițiile de intrare se pot modifica rapid. Verificarea trebuie făcută direct la autoritatea, aeroportul sau compania implicată.</p>

<h2>Când intră în vigoare schimbarea</h2>
<p>Data exactă și eventualele perioade de tranziție trebuie confirmate în comunicatul oficial. Dacă informația afectează o rezervare existentă, pasagerii ar trebui să contacteze operatorul sau agenția prin care au cumpărat serviciul.</p>

<h2>Recomandarea Travelistul</h2>
<p>Nu lua o decizie exclusiv pe baza titlului. Citește sursa originală, verifică dacă regula se aplică cetățenilor români și păstrează o copie a condițiilor valabile la data călătoriei.</p>

<p><em>${sourceNote}</em></p>`.trim();

  return {
    seoTitle,
    slug: slugify(seoTitle),
    excerpt: trim(`${item.summary} Vezi ce impact poate avea pentru călătorii români și ce trebuie verificat înainte de plecare.`, 180),
    metaDescription: trim(`${item.title}. Află ce înseamnă schimbarea pentru călătorii români și ce trebuie verificat în sursa oficială.`, 155),
    article,
    keywords,
    tags: [item.category, item.country, item.urgency, "Travel News"],
    facebook: `${item.title}\n\n${item.summary}\n\nCe înseamnă pentru români și ce trebuie verificat înainte de plecare — în analiza Travelistul.`,
    x: trim(`${item.title} — impact România ${item.romaniaImpact}/100. Verifică sursa oficială înainte de călătorie. #TravelNews #Travelistul`, 280),
    pushTitle: trim(item.title, 55),
    pushBody: trim(`Schimbare importantă pentru călători. Impact România: ${item.romaniaImpact}/100.`, 115),
    sourceNote,
  };
}
