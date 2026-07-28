import { NextRequest, NextResponse } from "next/server";
import type { EditorialPackage } from "@/lib/ai-writer";
import { createWordPressPost, getWordPressConfig } from "@/lib/wordpress";

export async function POST(request: NextRequest) {
  const config = getWordPressConfig();
  if (!config) {
    return NextResponse.json({ error: "WordPress nu este configurat." }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as { editorial?: EditorialPackage; status?: "draft" | "pending" | "publish" } | null;
  if (!body?.editorial?.seoTitle || !body.editorial.article) {
    return NextResponse.json({ error: "Pachet editorial invalid." }, { status: 400 });
  }

  try {
    const result = await createWordPressPost(config, body.editorial, body.status);
    return NextResponse.json({ ok: true, post: result });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Eroare necunoscută la WordPress.",
    }, { status: 502 });
  }
}
