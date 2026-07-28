import { NextResponse } from "next/server";
import { getWordPressConfig, testWordPressConnection } from "@/lib/wordpress";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = getWordPressConfig();
    if (!config) return NextResponse.json({ ok: false, error: "Variabilele WordPress lipsesc din Vercel." }, { status: 500 });
    const user = await testWordPressConnection(config);
    return NextResponse.json({ ok: true, user, site: config.url, mode: config.allowLivePublishing ? "publish-enabled" : "draft-only" });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Eroare WordPress." }, { status: 500 });
  }
}
