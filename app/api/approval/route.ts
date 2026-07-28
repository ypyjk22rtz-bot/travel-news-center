import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase nu este configurat." }, { status: 500 });

  const { data: items, error } = await supabase
    .from("tnc_news_items")
    .select("*")
    .neq("status", "rejected")
    .order("detected_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (items || []).map((item) => item.id);
  const [{ data: generated }, { data: social }, { data: jobs }] = await Promise.all([
    ids.length ? supabase.from("tnc_generated_content").select("*").in("news_item_id", ids) : Promise.resolve({ data: [] as any[] }),
    ids.length ? supabase.from("tnc_social_content").select("*").in("news_item_id", ids) : Promise.resolve({ data: [] as any[] }),
    ids.length ? supabase.from("tnc_publication_jobs").select("*").in("news_item_id", ids).order("created_at", { ascending: false }) : Promise.resolve({ data: [] as any[] }),
  ]);

  return NextResponse.json({
    items: (items || []).map((item) => ({
      ...item,
      generated: (generated || []).find((row) => row.news_item_id === item.id) || null,
      social: (social || []).find((row) => row.news_item_id === item.id) || null,
      publication: (jobs || []).find((row) => row.news_item_id === item.id) || null,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase nu este configurat." }, { status: 500 });
  const { newsItemId, status } = await request.json();
  const allowed = ["new", "reviewing", "generated", "approved", "rejected"];
  if (!newsItemId || !allowed.includes(status)) return NextResponse.json({ error: "Cerere invalidă." }, { status: 400 });

  const { error } = await supabase.from("tnc_news_items").update({ status, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", newsItemId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from("tnc_activity_logs").insert({ event_type: `status_${status}`, entity_type: "news_item", entity_id: newsItemId, message: `Status schimbat în ${status}.` });
  return NextResponse.json({ ok: true });
}
