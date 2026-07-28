"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { TravelSource } from "@/lib/source-catalog";
import { effectiveFrequency, healthFromResult, queueForSource, sourceLanguage, sourcePriority, sourceRegion, trustScore } from "@/lib/source-intelligence";

type ScanResult = {
  sourceId: string;
  source: string;
  ok: boolean;
  status?: number;
  title?: string;
  error?: string;
  checkedAt: string;
  responseMs?: number;
};

export default function SourcesPage() {
  const [sources, setSources] = useState<TravelSource[]>([]);
  const [mode, setMode] = useState("demo");
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [filter, setFilter] = useState("toate");
  const [queue, setQueue] = useState("toate");
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/sources")
      .then((response) => response.json())
      .then((payload) => {
        setSources(payload.sources ?? []);
        setMode(payload.mode ?? "demo");
      })
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => sources.filter((source) => {
    const kindMatches = filter === "toate" || source.kind === filter;
    const queueMatches = queue === "toate" || queueForSource(source) === queue;
    const text = `${source.name} ${source.country} ${source.kind}`.toLowerCase();
    return kindMatches && queueMatches && text.includes(query.toLowerCase());
  }), [filter, queue, query, sources]);

  const queueCounts = useMemo(() => ({
    high: sources.filter((source) => queueForSource(source) === "high-15m").length,
    medium: sources.filter((source) => queueForSource(source) === "medium-60m").length,
    low: sources.filter((source) => queueForSource(source) === "low-6h").length,
  }), [sources]);

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
          <Link href="/">◫ Dashboard</Link><a>✦ News Inbox</a><a>⌁ Travel Radar</a><a>✓ Approval Center</a>
          <Link href="/sources" className="active">◎ Source Monitor</Link><a>↗ Published</a><a>≡ Activity Log</a><a>⚙ Settings</a>
        </nav>
        <div className="system"><i></i><div><strong>Source Engine activ</strong><small>Mod: {mode}</small></div></div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><p className="eyebrow">MILESTONE 2</p><h1>Source Monitor Pro</h1><span>Priorități, cozi, stare tehnică și verificare controlată pentru sursele Travelistul.</span></div>
          <button onClick={runScan} disabled={scanning}>{scanning ? "Se verifică sursele..." : "↻ Verifică lotul următor"}</button>
        </header>

        <div className="notice"><strong>{mode === "live" ? "LIVE" : "DEMO"}</strong><span>Publicarea automată este dezactivată. Sursele sunt scanate în loturi, în funcție de prioritate.</span></div>

        <section className="stats">
          <article><small>Surse încărcate</small><strong>{sources.length}</strong><span>catalog activ</span></article>
          <article><small>High · 15 minute</small><strong>{queueCounts.high}</strong><span>autorități și companii aeriene</span></article>
          <article><small>Medium · 1 oră</small><strong>{queueCounts.medium}</strong><span>aeroporturi și turism</span></article>
          <article><small>Low · 6 ore</small><strong>{queueCounts.low}</strong><span>publicații și surse secundare</span></article>
        </section>

        <section className="panel">
          <div className="panelTitle"><div><h2>Catalog administrabil</h2><p>{visible.length} surse afișate din {sources.length}.</p></div></div>
          <div className="sourceControls">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Caută sursă, țară sau tip..." />
            <div className="filters">{["toate", "authority", "airline", "airport", "tourism", "publication"].map((item) => <button key={item} className={filter === item ? "selected" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div>
            <div className="filters">{["toate", "high-15m", "medium-60m", "low-6h"].map((item) => <button key={item} className={queue === item ? "selected" : ""} onClick={() => setQueue(item)}>{item}</button>)}</div>
          </div>

          {loading ? <p>Se încarcă...</p> : <div className="sourceTable">
            {visible.map((source) => {
              const last = results.find((result) => result.sourceId === source.id);
              const health = healthFromResult(last?.ok, last?.responseMs);
              return <article className="sourceRow sourceRowPro" key={source.id}>
                <div><strong>{source.name}</strong><small>{source.country} · {sourceRegion(source)} · {sourceLanguage(source)}</small></div>
                <span>{source.kind}</span>
                <span className={`priority priority-${sourcePriority(source)}`}>{sourcePriority(source).toUpperCase()}</span>
                <span>{queueForSource(source)}</span>
                <span>{effectiveFrequency(source)} min</span>
                <span>{trustScore(source.kind)}/100</span>
                <span className={health === "healthy" ? "sourceOk" : health === "slow" ? "sourceSlow" : health === "offline" ? "sourceError" : "sourcePending"}>{health.toUpperCase()}</span>
                <a href={source.url} target="_blank" rel="noreferrer">Sursa ↗</a>
              </article>;
            })}
          </div>}
        </section>

        {results.length > 0 && <section className="panel"><div className="panelTitle"><div><h2>Ultima scanare</h2><p>{results.filter((result) => result.ok).length} răspunsuri valide din {results.length} surse testate.</p></div></div><div className="scanResults">{results.map((result) => <article key={result.sourceId}><strong>{result.source}</strong><span className={result.ok ? "sourceOk" : "sourceError"}>{result.ok ? `HTTP ${result.status}` : result.error}</span><small>{result.title || "Fără titlu detectat"}</small></article>)}</div></section>}
      </section>
    </main>
  );
}
