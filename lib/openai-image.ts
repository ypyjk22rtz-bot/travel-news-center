export type GeneratedImage = {
  bytes: Buffer;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
  model: string;
};

export async function generateFeaturedImage(prompt: string): Promise<GeneratedImage> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY nu este configurată în Vercel.");

  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1-mini";
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: `${prompt}\n\nCreate a professional editorial travel-news featured image. Wide landscape composition, photorealistic, clean, credible newsroom style, suitable for Google Discover and WordPress. No text, no logos, no watermarks, no fake signage.`,
      size: "1536x1024",
      quality: "medium",
      output_format: "jpeg",
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `OpenAI Images HTTP ${response.status}`);
  }

  const b64 = payload?.data?.[0]?.b64_json;
  if (!b64 || typeof b64 !== "string") {
    throw new Error("OpenAI nu a returnat imaginea generată.");
  }

  return {
    bytes: Buffer.from(b64, "base64"),
    mimeType: "image/jpeg",
    extension: "jpg",
    model,
  };
}
