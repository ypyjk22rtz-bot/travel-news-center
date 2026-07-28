export type RawNewsSignal = {
  id: string;
  title: string;
  summary: string;
  source: string;
  sourceKind: "authority" | "airline" | "airport" | "tourism" | "publication";
  country: string;
  url: string;
  publishedAt: string;
};

export type IntelligenceResult = RawNewsSignal & {
  category: string;
  urgency: "breaking" | "important" | "medium" | "low";
  romaniaImpact: number;
  discoverScore: number;
  trustScore: number;
  totalScore: number;
  duplicateKey: string;
  reasons: string[];
};

const categoryRules: Array<[string, string[]]> = [
  ["Vize", ["visa", "vize", "entry requirement", "immigration", "border"]],
  ["Rute noi", ["new route", "direct flight", "launches flights", "resumes flights"]],
  ["Taxe", ["tourist tax", "departure tax", "fee", "levy"]],
  ["Bagaje", ["baggage", "carry-on", "cabin bag", "luggage"]],
  ["Siguranță", ["warning", "security", "strike", "disruption", "cancelled"]],
  ["Promoții", ["sale", "promotion", "discount", "offer"]],
  ["Aeroporturi", ["terminal", "airport", "runway", "security screening"]],
  ["Destinații", ["tourism", "destination", "visitors", "travel campaign"]],
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(normalize(term)));
}

export function createDuplicateKey(title: string) {
  const stop = new Set(["the", "a", "an", "of", "to", "for", "and", "in", "on", "new", "with"]);
  return normalize(title)
    .split(" ")
    .filter((word) => word.length > 2 && !stop.has(word))
    .slice(0, 10)
    .sort()
    .join("-");
}

export function analyzeSignal(signal: RawNewsSignal): IntelligenceResult {
  const text = normalize(`${signal.title} ${signal.summary} ${signal.country}`);
  const category = categoryRules.find(([, terms]) => includesAny(text, terms))?.[0] ?? "Turism";
  const reasons: string[] = [];

  let romaniaImpact = 25;
  if (includesAny(text, ["romania", "bucharest", "cluj", "iasi", "timisoara", "romanian"])) {
    romaniaImpact += 55;
    reasons.push("Menționează direct România sau un aeroport românesc.");
  }
  if (includesAny(text, ["europe", "schengen", "eu citizens", "european travellers"])) {
    romaniaImpact += 20;
    reasons.push("Afectează călătorii europeni, inclusiv românii.");
  }
  if (["Vize", "Rute noi", "Bagaje", "Taxe", "Siguranță"].includes(category)) {
    romaniaImpact += 10;
    reasons.push(`Categoria ${category} are utilitate practică ridicată.`);
  }
  romaniaImpact = Math.min(100, romaniaImpact);

  let trustScore = signal.sourceKind === "authority" ? 98 : signal.sourceKind === "airline" || signal.sourceKind === "airport" ? 93 : signal.sourceKind === "tourism" ? 88 : 72;
  reasons.push(`Sursă de tip ${signal.sourceKind}, scor de încredere ${trustScore}/100.`);

  let discoverScore = 35;
  if (["Vize", "Rute noi", "Taxe", "Bagaje", "Siguranță"].includes(category)) discoverScore += 25;
  if (romaniaImpact >= 70) discoverScore += 25;
  if (includesAny(text, ["new", "first", "changes", "eliminates", "direct", "warning"])) discoverScore += 10;
  discoverScore = Math.min(100, discoverScore);

  const totalScore = Math.round(romaniaImpact * 0.45 + discoverScore * 0.35 + trustScore * 0.2);
  const urgency = totalScore >= 88 ? "breaking" : totalScore >= 74 ? "important" : totalScore >= 55 ? "medium" : "low";

  return {
    ...signal,
    category,
    urgency,
    romaniaImpact,
    discoverScore,
    trustScore,
    totalScore,
    duplicateKey: createDuplicateKey(signal.title),
    reasons,
  };
}

export function deduplicateSignals(items: IntelligenceResult[]) {
  const groups = new Map<string, IntelligenceResult[]>();
  for (const item of items) {
    const current = groups.get(item.duplicateKey) ?? [];
    current.push(item);
    groups.set(item.duplicateKey, current);
  }

  return Array.from(groups.values()).map((group) => ({
    primary: [...group].sort((a, b) => b.trustScore - a.trustScore || b.totalScore - a.totalScore)[0],
    duplicates: group.length - 1,
    sources: group.map((item) => item.source),
  }));
}
