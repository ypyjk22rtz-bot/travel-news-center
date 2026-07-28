import type { EditorialPackage } from "@/lib/ai-writer";
import { affiliateOffersHtml } from "@/lib/affiliate-ai";

export type WordPressConfig = {
  url: string;
  username: string;
  applicationPassword: string;
  defaultStatus: "draft" | "pending";
  allowLivePublishing: boolean;
};

export function getWordPressConfig(): WordPressConfig | null {
  const url = process.env.WORDPRESS_URL?.replace(/\/$/, "");
  const username = process.env.WORDPRESS_USERNAME;
  const applicationPassword = process.env.WORDPRESS_APPLICATION_PASSWORD;

  if (!url || !username || !applicationPassword) return null;

  return {
    url,
    username,
    applicationPassword,
    defaultStatus: process.env.WORDPRESS_DEFAULT_STATUS === "pending" ? "pending" : "draft",
    allowLivePublishing: process.env.ALLOW_LIVE_PUBLISHING === "true",
  };
}

function authHeader(config: WordPressConfig) {
  return `Basic ${Buffer.from(`${config.username}:${config.applicationPassword}`).toString("base64")}`;
}

function termSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function findOrCreateWordPressTerm(
  config: WordPressConfig,
  taxonomy: "categories" | "tags",
  name: string,
) {
  const cleanName = name.trim().slice(0, 100);
  if (!cleanName) return null;

  const search = await fetch(
    `${config.url}/wp-json/wp/v2/${taxonomy}?search=${encodeURIComponent(cleanName)}&per_page=100&context=edit`,
    {
      headers: { Authorization: authHeader(config) },
      cache: "no-store",
    },
  );

  if (!search.ok) {
    const body = await search.text();
    throw new Error(`WordPress ${taxonomy} search failed (${search.status}): ${body.slice(0, 180)}`);
  }

  const existing = await search.json().catch(() => []);
  const slug = termSlug(cleanName);
  const match = Array.isArray(existing)
    ? existing.find((term) =>
        String(term?.name || "").toLowerCase() === cleanName.toLowerCase()
        || String(term?.slug || "") === slug,
      )
    : null;

  if (match?.id) return Number(match.id);

  const created = await fetch(`${config.url}/wp-json/wp/v2/${taxonomy}`, {
    method: "POST",
    headers: {
      Authorization: authHeader(config),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: cleanName, slug }),
  });

  const payload = await created.json().catch(() => ({}));
  if (!created.ok) {
    if (payload?.code === "term_exists" && payload?.data?.term_id) {
      return Number(payload.data.term_id);
    }
    throw new Error(payload?.message || `WordPress ${taxonomy} creation failed (${created.status})`);
  }

  return payload?.id ? Number(payload.id) : null;
}

export async function testWordPressConnection(config: WordPressConfig) {
  const response = await fetch(`${config.url}/wp-json/wp/v2/users/me?context=edit`, {
    headers: { Authorization: authHeader(config) },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`WordPress connection failed (${response.status}): ${body.slice(0, 220)}`);
  }

  const user = await response.json();
  return { id: user.id, name: user.name, slug: user.slug };
}

export async function uploadWordPressMedia(
  config: WordPressConfig,
  bytes: Buffer,
  filename: string,
  mimeType: string,
  altText: string,
) {
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

  const response = await fetch(`${config.url}/wp-json/wp/v2/media`, {
    method: "POST",
    headers: {
      Authorization: authHeader(config),
      "Content-Type": mimeType,
      "Content-Disposition": `attachment; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, "-")}"`,
    },
    body,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || `WordPress media upload failed (${response.status})`);
  }

  if (payload?.id) {
    await fetch(`${config.url}/wp-json/wp/v2/media/${payload.id}`, {
      method: "POST",
      headers: {
        Authorization: authHeader(config),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ alt_text: altText, caption: "", description: "" }),
    });
  }

  return {
    id: payload.id as number,
    sourceUrl: payload.source_url as string,
  };
}

export async function createWordPressPost(
  config: WordPressConfig,
  editorial: EditorialPackage,
  requestedStatus?: "draft" | "pending" | "publish",
  featuredMediaId?: number,
) {
  const safeStatus = requestedStatus === "publish" && config.allowLivePublishing
    ? "publish"
    : requestedStatus === "pending"
      ? "pending"
      : config.defaultStatus;

  const categoryName = process.env.WORDPRESS_DEFAULT_CATEGORY?.trim() || "Diverse";
  const categoryId = await findOrCreateWordPressTerm(config, "categories", categoryName);

  const uniqueTagNames = Array.from(new Set(
    (editorial.tags || [])
      .map((tag) => String(tag).trim())
      .filter(Boolean),
  )).slice(0, 12);

  const tagIds = (
    await Promise.all(uniqueTagNames.map((tag) => findOrCreateWordPressTerm(config, "tags", tag)))
  ).filter((id): id is number => typeof id === "number" && Number.isFinite(id));

  const affiliateBlock = affiliateOffersHtml(editorial);
  const content = `${editorial.article}${affiliateBlock}\n<hr />\n<p><strong>Sursa oficială:</strong> <a href="${editorial.sourceUrl}" target="_blank" rel="noopener noreferrer">${editorial.sourceName}</a></p>`;

  const response = await fetch(`${config.url}/wp-json/wp/v2/posts`, {
    method: "POST",
    headers: {
      Authorization: authHeader(config),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: editorial.seoTitle,
      slug: editorial.slug,
      content,
      excerpt: editorial.excerpt,
      status: safeStatus,
      featured_media: featuredMediaId || undefined,
      categories: categoryId ? [categoryId] : [],
      tags: tagIds,
      meta: {
        _yoast_wpseo_metadesc: editorial.metaDescription,
        _yoast_wpseo_focuskw: editorial.keywords[0] ?? "",
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || `WordPress publish failed (${response.status})`);
  }

  return {
    id: payload.id,
    status: payload.status,
    link: payload.link,
    editLink: `${config.url}/wp-admin/post.php?post=${payload.id}&action=edit`,
    featuredMediaId: featuredMediaId || null,
    categoryId,
    tagIds,
  };
}
