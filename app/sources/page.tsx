"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { TravelSource } from "@/lib/source-catalog";

type ScanResult = {
  sourceId: string;
  source: string;
  ok: boolean;
  status?: number;
  title?: string;
  error?: string;
  checkedAt: string;
};

export default function SourcesPage() {
  const [sources, setSources] = useState<TravelSource[]>([]);
  const [mode, setMode] = useState("demo");
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [filter, setFilter] = useState("toate");

  useEffect(() => {
    fetch("/api/sources")
      .then((response) => response.json())
      .then((payload) => {
        setSources(payload.sources ?? []);
        setMode(payload.mode ?? "demo");
      })
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(
    () => filter === "toate" ? sources : sources.filter((source) => source.kind === filter),
    [filter, sources],
  );

  async function runScan() {
    setScanning(true);
    try {
      const response = await fetch("/api/scan", { method: "POST" });
      const payload = await response.json();
      setResults(payload.results ?? []);
    } finally {
      setScanning(false);
    }
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span>TN</span><div><strong>Travel News Center</strong><small>AI NEWSROOM</small></div></div>
        <nav>
          <Link href="/">◫ Dashboard</Link>
          <a>✦ News Inbox</a>
          <a>⌁ Travel Radar</a>
          <a>✓ Approval Center</a>
          <Link href="/sources" className="active">◎ Source Monitor</Link>
          <a>↗ Published</a>
          <a>≡ Activity Log</a>
          <a>⚙ Settings</a>
        </nav>
        <div className="system"><i></i><div><strong>Source Engine activ</strong><small>Mod: {mode}</small></div></div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><p className="eyebrow">MILESTONE 1</p><h1>Source Monitor</h1><span>Surse oficiale verificate controlat, cu jurnal de răspuns și erori.</span></div>
          <button onClick={runScan} disabled={scanning}>{scanning ? "Se verifică sursele..." : "↻ Verifică acum"}</button>
        </header>

        <div className="notice"><strong>{mode === "live" ? "LIVE" : "DEMO"}</strong><span>{mode === "live" ? "Datele sunt citite din Supabase." : "Catalogul este încărcat local; rezultatele pot fi salvate după configurarea Supabase."}</span></div>

        <section className="stats">
          <article><small>Surse încărcate</small><strong>{sources.length}</strong><span>lot inițial oficial</span></article>
          <article><small>Active</small><strong>{sources.filter((source) => source.active).length}</strong><span>pregătite pentru scanare</span></article>
          <article><small>Verificate acum</small><strong>{results.length}</strong><span>{results.filter((result) => result.ok).length} răspunsuri valide</span></article>
          <article><small>Erori curente</small><strong>{results.filter((result) => !result.ok).length}</strong><span>necesită revizuire</span></article>
        </section>

        <section className="panel">
          <div className="panelTitle"><div><h2>Catalog surse</h2><p>Primele surse oficiale pentru autorități, companii aeriene, aeroporturi și turism.</p></div><div className="filters">{["toate", "authority", "airline", "airport", "tourism", "publication"].map((item) => <button key={item} className={filter === item ? "selected" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div></div>
          {loading ? <p>Se încarcă...</p> : <div className="sourceTable">
            {visible.map((source) => {
              const last = results.find((result) => result.sourceId === source.id);
              return <article className="sourceRow" key={source.id}>
                <div><strong>{source.name}</strong><small>{source.country} · {source.kind}</small></div>
                <span>{source.method.toUpperCase()}</span>
                <span>{source.frequencyMinutes} min</span>
                <span className={last ? (last.ok ? "sourceOk" : "sourceError") : "sourcePending"}>{last ? (last.ok ? `OK ${last.status ?? ""}` : "EROARE") : "NEVERIFICAT"}</span>
                <a href={source.url} target="_blank" rel="noreferrer">Sursa ↗</a>
              </article>;
            })}
          </div>}
        </section>

        {results.length > 0 && <section className="panel"><div className="panelTitle"><div><h2>Ultima scanare</h2><p>Rezultatele sunt obținute direct de endpoint-ul server-side.</p></div></div><div className="scanResults">{results.map((result) => <article key={result.sourceId}><strong>{result.source}</strong><span className={result.ok ? "sourceOk" : "sourceError"}>{result.ok ? `HTTP ${result.status}` : result.error}</span><small>{result.title || "Fără titlu detectat"}</small></article>)}</div></section>}
      </section>
    </main>
  );
}
