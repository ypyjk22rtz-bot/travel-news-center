import { NextRequest, NextResponse } from "next/server";
import { initialSources } from "@/lib/source-catalog";
import { queueForSource } from "@/lib/source-intelligence";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestedQueue = request.nextUrl.searchParams.get("queue") ?? "high-15m";
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 25), 50);
  const sources = initialSources
    .filter((source) => source.active && queueForSource(source) === requestedQueue)
    .slice(0, limit);

  return NextResponse.json({
    queue: requestedQueue,
    totalInQueue: initialSources.filter((source) => source.active && queueForSource(source) === requestedQueue).length,
    selected: sources.length,
    sources,
    note: "Endpoint de planificare. Scanarea efectivă este executată de /api/scan în loturi controlate.",
  });
}
