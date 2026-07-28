"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Source = {
  id: string;
  kind: string;
  active: boolean;
};

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

type ScanSummary = {
  checked: number;
  successful: number;
  failed: number;
  newItems?: number;
};

const radarLabels: Array<[string, string[]]> = [
  ["Rute noi", ["zboruri"]],
  ["Schimbări de viză", ["vize"]],
  ["Taxe noi", ["taxe"]],
  ["Greve & perturbări", ["alerte"]],
  ["Promoții", ["promotii"]],
  ["Aeroporturi", ["aeroporturi"]],
];

export default function Dashboard() {
  const [sources, setSources] = useState<Source[]>([]);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<ScanSummary | null>(null);

  async function loadDashboard() {
    setLoading(true);
    setError("");
    try {
      const [sourcesResponse, newsResponse] = await Promise.all([
        fetch("/api/sources", { cache: "no-store" }),
        fetch("/api/news", { cache: "no-store" }),
      ]);

      const sourcesPayload = await sourcesResponse.json();
      const newsPayload = await newsResponse.json();

      if (!sourcesResponse.ok) throw new Error(sourcesPayload.error || "Sursele nu au putut fi încărcate.");
      if (!newsResponse.ok) throw new Error(newsPayload.error || "News Inbox nu a putut fi încărcat.");

      setSources(sourcesPayload.sources ?? []);
      setItems(newsPayload.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare necunoscută la încărcarea dashboardului.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function runScan() {
    setScanning(true);
    setError("");
    try {
      const response = await fetch("/api/scan", { method: "POST", cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Scanarea a eșuat cu HTTP ${response.status}`);

      setSummary({
        checked: payload.checked ?? 0,
        successful: payload.successful ?? 0,
        failed: payload.failed ?? 0,
        newItems: payload.newItems ?? payload.inserted ?? 0,
      });
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare necunoscută la scanare.");
    } finally {
      setScanning(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const detectedToday = useMemo(() => items.filter((item) => item.detected_at?.slice(0, 10) === today), [items, today]);
  const pending = useMemo(() => items.filter((item) => ["new", "pending", "analysis"].includes(item.status)), [items]);
  const published = useMemo(() => items.filter((item) => item.status === "published"), [items]);
  const recent = items.slice(0, 8);

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span>TN</span><div><strong>Travel News Center</strong><small>AI NEWSROOM</small></div></div>
        <nav>
          <Link href="/" className="active">◫ Dashboard</Link>
          <Link href="/news">✦ News Inbox <b>{pending.length}</b></Link>
          <Link href="/radar">⌁ Travel Radar</Link>
          <Link href="/approval">✓ Approval Center</Link>
          <Link href="/sources">◎ Source Monitor</Link>
          <Link href="/published">↗ Published</Link>
          <Link href="/activity">≡ Activity Log</Link>
          <Link href="/settings">⚙ Settings</Link>
        </nav>
        <div className="system"><i></i><div><strong>Sistem LIVE</strong><small>{sources.length} surse conectate</small></div></div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><p className="eyebrow">OFFICIAL TRAVEL INTELLIGENCE</p><h1>Travel News Center AI</h1><span>Date reale din Supabase și sursele oficiale monitorizate.</span></div>
          <button onClick={runScan} disabled={scanning}>{scanning ? "Se scanează sursele..." : "↻ Rulează scanarea reală"}</button>
        </header>

        <div className="notice"><strong>LIVE</strong><span>Supabase și Source Monitor sunt conectate. Publicarea automată rămâne dezactivată până la configurarea WordPress.</span></div>
        {error && <div className="notice"><strong>EROARE</strong><span>{error}</span></div>}
        {summary && <div className="notice"><strong>SCANARE</strong><span>Verificate: {summary.checked} · Reușite: {summary.successful} · Erori: {summary.failed} · Știri noi: {summary.newItems ?? 0}</span></div>}

        <section className="stats">
          <article><small>Surse active</small><strong>{loading ? "…" : sources.filter((source) => source.active !== false).length}</strong><span>catalog live</span></article>
          <article><small>Detectate azi</small><strong>{loading ? "…" : detectedToday.length}</strong><span>știri reale</span></article>
          <article><small>De analizat</small><strong>{loading ? "…" : pending.length}</strong><span>control uman obligatoriu</span></article>
          <article><small>Publicate</small><strong>{loading ? "…" : published.length}</strong><span>în baza de date</span></article>
        </section>

        <section className="radarPanel">
          <div className="panelTitle"><div><h2>Travel Radar</h2><p>Semnale calculate din știrile reale salvate.</p></div><span className="live"><i></i> LIVE</span></div>
          <div className="radarGrid">
            {radarLabels.map(([label, categories]) => {
              const count = items.filter((item) => categories.includes(item.category)).length;
              return <article key={label}><small>{label}</small><strong>{count}</strong><span>{count === 1 ? "știre detectată" : "știri detectate"}</span></article>;
            })}
          </div>
        </section>

        <section className="panel">
          <div className="panelTitle"><div><h2>Ultimele știri detectate</h2><p>Conținut real din News Inbox.</p></div><Link href="/news">Vezi tot inboxul →</Link></div>
          {loading ? <p>Se încarcă datele live...</p> : recent.length === 0 ? <p>Nu există încă știri. Apasă „Rulează scanarea reală”.</p> : <div className="newsTable">
            {recent.map((item) => (
              <article className="newsRow" key={item.id}>
                <div className={`score ${item.intelligence_score >= 90 ? "critical" : item.intelligence_score >= 80 ? "high" : "medium"}`}><strong>{item.intelligence_score ?? 0}</strong><small>INTEL</small></div>
                <div className="newsMain"><div className="badges"><span>{item.importance || "new"}</span><em>{item.category}</em></div><h3>{item.source_title}</h3><p>{item.source_id || "Sursă oficială"} · Discover {item.discover_score ?? 0}/100</p></div>
                <span className="status">{item.status}</span>
                <a className="open" href={item.source_url} target="_blank" rel="noreferrer">Sursa</a>
              </article>
            ))}
          </div>}
        </section>

        <section className="lowerGrid">
          <article className="panel compact"><div className="panelTitle"><div><h2>Starea monitorizării</h2><p>Date reale din catalog</p></div></div><div className="progress"><span><b style={{width: sources.length ? "100%" : "0%"}}></b></span><div><strong>{sources.length}</strong> surse încărcate</div></div><div className="mini"><span>Companii aeriene <b>{sources.filter((source) => source.kind === "airline").length}</b></span><span>Aeroporturi <b>{sources.filter((source) => source.kind === "airport").length}</b></span><span>Publicații <b>{sources.filter((source) => source.kind === "publication").length}</b></span></div></article>
          <article className="panel compact"><div className="panelTitle"><div><h2>Flux editorial</h2><p>Publicarea automată este dezactivată</p></div></div><div className="pipeline"><span>{items.length}<small>Detectate</small></span><i>→</i><span>{pending.length}<small>De analizat</small></span><i>→</i><span>{items.filter((item) => item.status === "approved").length}<small>Aprobate</small></span><i>→</i><span>{published.length}<small>Publicate</small></span></div></article>
        </section>
      </section>
    </main>
  );
}
