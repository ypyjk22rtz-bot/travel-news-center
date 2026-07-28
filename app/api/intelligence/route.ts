import { NextResponse } from "next/server";
import { analyzeSignal, deduplicateSignals } from "@/lib/intelligence-engine";
import { demoSignals } from "@/lib/news-demo";

export const dynamic = "force-dynamic";

export async function GET() {
  const analyzed = demoSignals.map(analyzeSignal).sort((a, b) => b.totalScore - a.totalScore);
  const groups = deduplicateSignals(analyzed);

  return NextResponse.json({
    mode: "demo",
    generatedAt: new Date().toISOString(),
    detected: analyzed.length,
    unique: groups.length,
    duplicatesRemoved: analyzed.length - groups.length,
    items: groups.map((group) => ({
      ...group.primary,
      duplicateCount: group.duplicates,
      sourceGroup: group.sources,
    })),
  });
}
