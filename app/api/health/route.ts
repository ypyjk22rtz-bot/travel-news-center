import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "travel-news-center",
    mode: process.env.OPENAI_API_KEY ? "configured" : "demo",
    wordpress: Boolean(process.env.WORDPRESS_APPLICATION_PASSWORD),
    livePublishingEnabled: process.env.ALLOW_LIVE_PUBLISHING === "true",
    checkedAt: new Date().toISOString(),
  });
}
