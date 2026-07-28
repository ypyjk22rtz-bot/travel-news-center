import { NextRequest, NextResponse } from "next/server";
import { buildFallbackPackage } from "@/lib/ai-writer";
import type { IntelligenceResult } from "@/lib/intelligence-engine";

export const dynamic = "force-dynamic";

function isIntelligenceResult(value: unknown): value is IntelligenceResult {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.title === "string" && typeof item.summary === "string" && typeof item.source === "string";
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const item = body?.item;

  if (!isIntelligenceResult(item)) {
    return NextResponse.json({ error: "Semnalul editorial este invalid." }, { status: 400 });
  }

  const fallback = buildFallbackPackage(item);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ mode: "template", editorial: fallback });
  }

  const prompt = `Scrie în limba română un pachet editorial factual pentru Travelistul.com. Nu inventa date, nu adăuga afirmații care nu apar în informațiile oferite și menționează clar că cititorul trebuie să verifice sursa oficială. Articolul trebuie să aibă 500-700 de cuvinte și structură HTML simplă cu h2 și p.

INFORMAȚII:
${JSON.stringify(item)}

Returnează exclusiv JSON valid cu cheile: seoTitle, slug, excerpt, metaDescription, article, keywords, tags, facebook, x, pushTitle, pushBody, sourceNote.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        temperature: 0.25,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Ești editor de știri de călătorie. Prioritizezi acuratețea, utilitatea și atribuirea sursei oficiale." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ mode: "template", warning: `OpenAI HTTP ${response.status}`, editorial: fallback });
    }

    const payload = await response.json();
    const raw = payload?.choices?.[0]?.message?.content;
    const generated = typeof raw === "string" ? JSON.parse(raw) : null;
    return NextResponse.json({ mode: "ai", editorial: { ...fallback, ...generated } });
  } catch (error) {
    return NextResponse.json({
      mode: "template",
      warning: error instanceof Error ? error.message : "Eroare necunoscută",
      editorial: fallback,
    });
  }
}
