"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type NewsItem = {
  id: string;
  source_id: string | null;
  source_url: string;
  source_title: string;
  source_excerpt: string | null;
  category: string;
  status: string;
  importance: string;
  intelligence_score: number;
  discover_score: number;
  factual_confidence: number;
  source_published_at: string | null;
  detected_at: string;
};

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("toate");
  const [query, setQuery] = useState("");

  async function loadNews() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/news", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "News Inbox nu a putut fi încărcat.");
      setItems(payload.items ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : "Eroare necunoscută."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadNews(); }, []);
  const categories = useMemo(() => ["toate", ...Array.from(new Set(items.map((item) => item.category)))], [items]);
  const visible = useMemo(() => items.filter((item) => {
    const categoryMatches = category === "toate" || item.category === category;
    const text = `${item.source_title} ${item.source_excerpt ?? ""} ${item.source_id ?? ""}`.toLowerCase();
    return categoryMatches && text.includes(query.toLowerCase());
  }), [items, category, query]);

  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><span>TN</span><div><strong>Travel News Center</strong><small>AI NEWSROOM</small></div></div>
      <nav>
        <Link href="/">◫ Dashboard</Link>
        <Link href="/news" className="active">✦ News Inbox</Link>
        <Link href="/radar">⌁ Travel Radar</Link>
        <Link href="/approval">✓ Approval Center</Link>
        <Link href="/sources">◎ Source Monitor</Link>
        <Link href="/published">↗ Published</Link>
        <Link href="/activity">≡ Activity Log</Link>
        <Link href="/settings">⚙ Settings</Link>
      </nav>
      <div className="system"><i></i><div><strong>RSS Engine activ</strong><small>{items.length} știri salvate</small></div></div>
    </aside>
    <section className="content">
      <header className="topbar"><div><p className="eyebrow">MILESTONE 3</p><h1>News Inbox</h1><span>Știri reale detectate din sursele oficiale și salvate automat în Supabase.</span></div><button onClick={loadNews} disabled={loading}>{loading ? "Se încarcă..." : "↻ Reîncarcă inboxul"}</button></header>
      <div className="notice"><strong>LIVE</strong><span>Articolele sunt doar colectate. Generarea AI și publicarea automată sunt încă dezactivate.</span></div>
      <section className="stats"><article><small>Știri salvate</small><strong>{items.length}</strong><span>în baza de date</span></article><article><small>Știri afișate</small><strong>{visible.length}</strong><span>după filtre</span></article><article><small>Categorii</small><strong>{Math.max(categories.length - 1, 0)}</strong><span>detectate automat</span></article><article><small>În așteptare</small><strong>{items.filter((item) => item.status === "new").length}</strong><span>pentru analiză AI</span></article></section>
      <section className="panel"><div className="panelTitle"><div><h2>Flux editorial</h2><p>Filtrează și deschide sursa oficială pentru verificare.</p></div></div><div className="sourceControls"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Caută în titlu sau rezumat..." /><div className="filters">{categories.map((item) => <button key={item} className={category === item ? "selected" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div></div>
      {error && <div className="notice"><strong>EROARE</strong><span>{error}</span></div>}
      {!loading && !error && visible.length === 0 && <p>Nu există încă știri. Mergi la Source Monitor și apasă „Verifică lotul următor”.</p>}
      <div className="scanResults">{visible.map((item) => <article key={item.id}><strong>{item.source_title}</strong><span className="sourceOk">{item.category} · {item.status}</span><small>{item.source_excerpt || "Fără rezumat disponibil."}</small><small>Detectată: {new Date(item.detected_at).toLocaleString("ro-RO")}</small><a href={item.source_url} target="_blank" rel="noreferrer">Deschide sursa oficială ↗</a></article>)}</div></section>
    </section>
  </main>;
}
