import type { SourceKind, TravelSource } from "@/lib/source-catalog";

export type SourcePriority = "high" | "medium" | "low";
export type SourceHealth = "healthy" | "slow" | "offline" | "unchecked";

const highAuthorityIds = new Set([
  "iata-news", "icao", "easa-news", "faa", "ec-mobility", "frontex", "uk-fco", "us-state-travel",
]);

export function sourcePriority(source: TravelSource): SourcePriority {
  if (highAuthorityIds.has(source.id)) return "high";
  if (source.kind === "authority" || source.kind === "airline") return "high";
  if (source.kind === "airport" || source.kind === "tourism") return "medium";
  return "low";
}

export function sourceLanguage(source: TravelSource): string {
  const country = source.country.toLowerCase();
  if (country.includes("românia")) return "ro";
  if (country.includes("franța")) return "fr";
  if (country.includes("germania")) return "de";
  if (country.includes("spania")) return "es";
  if (country.includes("italia")) return "it";
  if (country.includes("japonia")) return "ja/en";
  if (country.includes("china")) return "zh/en";
  return "en";
}

export function sourceRegion(source: TravelSource): string {
  const c = source.country.toLowerCase();
  if (["global", "europa", "uniunea europeană"].some((x) => c.includes(x))) return source.country;
  if (["japonia", "china", "singapore", "thailanda", "vietnam", "malaezia", "indonezia", "india", "coreea"].some((x) => c.includes(x))) return "Asia";
  if (["sua", "canada", "mexic"].some((x) => c.includes(x))) return "America de Nord";
  if (["brazilia", "argentina", "chile", "peru"].some((x) => c.includes(x))) return "America de Sud";
  if (["australia", "noua zeelandă"].some((x) => c.includes(x))) return "Oceania";
  if (["emiratele", "qatar", "arabia", "israel", "iordania"].some((x) => c.includes(x))) return "Orientul Mijlociu";
  return "Europa";
}

export function effectiveFrequency(source: TravelSource): number {
  const priority = sourcePriority(source);
  return priority === "high" ? Math.min(source.frequencyMinutes, 15) : priority === "medium" ? Math.min(source.frequencyMinutes, 60) : Math.max(source.frequencyMinutes, 180);
}

export function queueForSource(source: TravelSource): "high-15m" | "medium-60m" | "low-6h" {
  const priority = sourcePriority(source);
  return priority === "high" ? "high-15m" : priority === "medium" ? "medium-60m" : "low-6h";
}

export function trustScore(kind: SourceKind): number {
  if (kind === "authority") return 98;
  if (kind === "airline" || kind === "airport" || kind === "tourism") return 94;
  return 78;
}

export function healthFromResult(ok?: boolean, responseMs?: number): SourceHealth {
  if (ok === undefined) return "unchecked";
  if (!ok) return "offline";
  if ((responseMs ?? 0) > 2500) return "slow";
  return "healthy";
}
