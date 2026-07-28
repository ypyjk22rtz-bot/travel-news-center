import { createHash } from "crypto";

export type ParsedNewsItem = {
  title: string;
  url: string;
  excerpt: string;
  publishedAt: string | null;
  contentHash: string;
  category: string;
};

function decodeEntities(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function stripMarkup(value: string) {
  return decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, names: string[]) {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
    if (match?.[1]) return stripMarkup(match[1]);
  }
  return "";
}

function atomLink(block: string) {
  const alternate = block.match(/<link[^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["']/i);
  if (alternate?.[1]) return decodeEntities(alternate[1]);
  const any = block.match(/<link[^>]+href=["']([^"']+)["']/i);
  return any?.[1] ? decodeEntities(any[1]) : tag(block, ["link"]);
}

function absoluteUrl(value: string, baseUrl: string) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return "";
  }
}

export function discoverFeedUrl(html: string, pageUrl: string) {
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => match[0]);
  for (const link of links) {
    if (!/rel=["'][^"']*alternate/i.test(link)) continue;
    if (!/type=["']application\/(rss\+xml|atom\+xml)|type=["']text\/xml/i.test(link)) continue;
    const href = link.match(/href=["']([^"']+)["']/i)?.[1];
    if (href) return absoluteUrl(decodeEntities(href), pageUrl);
  }
  return null;
}

export function looksLikeFeed(body: string, contentType = "") {
  return /rss|atom|xml/i.test(contentType) || /<(rss|feed)\b/i.test(body.slice(0, 1200));
}

export function classifyNews(title: string, excerpt: string) {
  const text = `${title} ${excerpt}`.toLowerCase();
  if (/visa|viz[ăa]|entry requirement|passport|immigration|e-visa/.test(text)) return "vize";
  if (/tax|fee|charge|tariff|taxă/.test(text)) return "taxe";
  if (/route|flight|zbor|destination|launches|resumes|service/.test(text)) return "zboruri";
  if (/airport|terminal|runway|aeroport/.test(text)) return "aeroporturi";
  if (/airline|airways|carrier|companie aeriană/.test(text)) return "companii_aeriene";
  if (/deal|sale|discount|promo|offer/.test(text)) return "promotii";
  if (/warning|alert|strike|storm|security|closure/.test(text)) return "alerte";
  return "destinatii";
}

export function parseFeed(xml: string, feedUrl: string, limit = 12): ParsedNewsItem[] {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];
  const items: ParsedNewsItem[] = [];

  for (const block of blocks.slice(0, limit)) {
    const title = tag(block, ["title"]);
    const rawUrl = atomLink(block);
    const url = absoluteUrl(rawUrl, feedUrl);
    const excerpt = tag(block, ["description", "summary", "content:encoded", "content"]).slice(0, 1200);
    const rawDate = tag(block, ["pubDate", "published", "updated", "dc:date"]);
    const parsedDate = rawDate ? new Date(rawDate) : null;
    const publishedAt = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null;

    if (!title || !url) continue;
    const contentHash = createHash("sha256").update(`${url}|${title}`).digest("hex");
    items.push({ title, url, excerpt, publishedAt, contentHash, category: classifyNews(title, excerpt) });
  }

  return items;
}
