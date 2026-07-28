import { NextResponse } from "next/server";
import { getWordPressConfig, testWordPressConnection } from "@/lib/wordpress";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getWordPressConfig();
  if (!config) {
    return NextResponse.json({
      configured: false,
      connected: false,
      livePublishing: false,
      message: "Lipsesc credentialele WordPress din Vercel Environment Variables.",
    });
  }

  try {
    const user = await testWordPressConnection(config);
    return NextResponse.json({
      configured: true,
      connected: true,
      livePublishing: config.allowLivePublishing,
      defaultStatus: config.defaultStatus,
      user,
    });
  } catch (error) {
    return NextResponse.json({
      configured: true,
      connected: false,
      livePublishing: config.allowLivePublishing,
      message: error instanceof Error ? error.message : "Unknown WordPress error",
    }, { status: 502 });
  }
}
