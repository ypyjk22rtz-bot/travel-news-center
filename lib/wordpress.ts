import type { EditorialPackage } from "@/lib/ai-writer";

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

  const content = `${editorial.article}\n<hr />\n<p><strong>Sursa oficială:</strong> <a href="${editorial.sourceUrl}" target="_blank" rel="noopener noreferrer">${editorial.sourceName}</a></p>`;

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
  };
}
