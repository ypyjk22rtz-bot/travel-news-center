"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { TravelSource } from "@/lib/source-catalog";
import { effectiveFrequency, healthFromResult, queueForSource, sourceLanguage, sourcePriority, sourceRegion, trustScore } from "@/lib/source-intelligence";

type ScanResult = { sourceId: string; source: string; ok: boolean; status?: number; title?: string; error?: string; checkedAt: string; responseMs?: number; };
type ScanSummary = { checked: number; successful: number; failed: number; completedAt?: string; message?: string; };
type Diagnostic = { hasUrl?: boolean; hasServiceKey?: boolean; message?: string; };

export default function SourcesPage() {
  const [sources, setSources] = useState<TravelSource[]>([]);
  const [mode, setMode] = useState("demo");
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [scanError, setScanError] = useState("");
  const [filter, setFilter] = useState("toate");
  const [queue, setQueue] = useState("toate");
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/sources", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => { setSources(payload.sources ?? []); setMode(payload.mode ?? "demo"); setDiagnostic(payload.diagnostic ?? null); })
      .catch((error) => setDiagnostic({ message: error instanceof Error ? error.message : "Nu s-a putut încărca Source Monitor." }))
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
    setScanning(true); setScanError(""); setSummary(null);
    try {
      const response = await fetch("/api/scan", { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Scanarea a eșuat cu HTTP ${response.status}`);
      const nextResults = payload.results ?? [];
      setResults(nextResults);
      setSummary({ checked: payload.checked ?? nextResults.length, successful: payload.successful ?? nextResults.filter((item: ScanResult) => item.ok).length, failed: payload.failed ?? nextResults.filter((item: ScanResult) => !item.ok).length, completedAt: payload.completedAt, message: nextResults.length === 0 ? "Scanarea s-a încheiat, dar API-ul nu a returnat rezultate." : undefined });
    } catch (error) { setResults([]); setScanError(error instanceof Error ? error.message : "Eroare necunoscută la scanare."); }
    finally { setScanning(false); }
  }

  const modeLabel = mode === "live" ? "LIVE" : mode === "degraded" ? "DEGRADAT" : "DEMO";

  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><span>TN</span><div><strong>Travel News Center</strong><small>AI NEWSROOM</small></div></div>
      <nav>
        <Link href="/">◫ Dashboard</Link>
        <Link href="/news">✦ News Inbox</Link>
        <Link href="/radar">⌁ Travel Radar</Link>
        <Link href="/approval">✓ Approval Center</Link>
        <Link href="/sources" className="active">◎ Source Monitor</Link>
        <Link href="/published">↗ Published</Link>
        <Link href="/activity">≡ Activity Log</Link>
        <Link href="/settings">⚙ Settings</Link>
      </nav>
      <div className="system"><i></i><div><strong>Source Engine activ</strong><small>Mod: {mode}</small></div></div>
    </aside>

    <section className="content">
      <header className="topbar"><div><p className="eyebrow">MILESTONE 2</p><h1>Source Monitor Pro</h1><span>Priorități, cozi, stare tehnică și verificare controlată pentru sursele Travelistul.</span></div><button onClick={runScan} disabled={scanning}>{scanning ? "Se verifică sursele..." : "↻ Verifică lotul următor"}</button></header>
      <div className="notice"><strong>{modeLabel}</strong><span>{mode === "live" ? "Supabase este conectat. Publicarea automată rămâne dezactivată." : "Catalogul de rezervă este activ până la remedierea conexiunii Supabase."}</span></div>
      {diagnostic?.message && <section className="panel"><div className="panelTitle"><div><h2>Diagnostic Supabase</h2><p>{diagnostic.message}</p><p>URL configurat: {diagnostic.hasUrl ? "DA" : "NU"} · Cheie server-side configurată: {diagnostic.hasServiceKey ? "DA" : "NU"}</p></div></div></section>}
      {summary && <section className="panel"><div className="panelTitle"><div><h2>Rezultatul ultimei scanări</h2><p>{summary.message || `Verificate: ${summary.checked} · Reușite: ${summary.successful} · Erori: ${summary.failed}`}</p></div></div></section>}
      {scanError && <section className="panel"><div className="panelTitle"><div><h2>Eroare la scanare</h2><p>{scanError}</p></div></div></section>}
      <section className="stats"><article><small>Surse încărcate</small><strong>{sources.length}</strong><span>catalog activ</span></article><article><small>High · 15 minute</small><strong>{queueCounts.high}</strong><span>autorități și companii aeriene</span></article><article><small>Medium · 1 oră</small><strong>{queueCounts.medium}</strong><span>aeroporturi și turism</span></article><article><small>Low · 6 ore</small><strong>{queueCounts.low}</strong><span>publicații și surse secundare</span></article></section>
      <section className="panel"><div className="panelTitle"><div><h2>Catalog administrabil</h2><p>{visible.length} surse afișate din {sources.length}.</p></div></div><div className="sourceControls"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Caută sursă, țară sau tip..." /><div className="filters">{["toate", "authority", "airline", "airport", "tourism", "publication"].map((item) => <button key={item} className={filter === item ? "selected" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div><div className="filters">{["toate", "high-15m", "medium-60m", "low-6h"].map((item) => <button key={item} className={queue === item ? "selected" : ""} onClick={() => setQueue(item)}>{item}</button>)}</div></div>
      {loading ? <p>Se încarcă...</p> : <div className="sourceTable">{visible.map((source) => { const last = results.find((result) => result.sourceId === source.id); const health = healthFromResult(last?.ok, last?.responseMs); return <article className="sourceRow sourceRowPro" key={source.id}><div><strong>{source.name}</strong><small>{source.country} · {sourceRegion(source)} · {sourceLanguage(source)}</small></div><span>{source.kind}</span><span className={`priority priority-${sourcePriority(source)}`}>{sourcePriority(source).toUpperCase()}</span><span>{queueForSource(source)}</span><span>{effectiveFrequency(source)} min</span><span>{trustScore(source.kind)}/100</span><span className={health === "healthy" ? "sourceOk" : health === "slow" ? "sourceSlow" : health === "offline" ? "sourceError" : "sourcePending"}>{health.toUpperCase()}</span><a href={source.url} target="_blank" rel="noreferrer">Sursa ↗</a></article>; })}</div>}</section>
      {results.length > 0 && <section className="panel"><div className="panelTitle"><div><h2>Detalii scanare</h2><p>{results.filter((result) => result.ok).length} răspunsuri valide din {results.length} surse testate.</p></div></div><div className="scanResults">{results.map((result) => <article key={result.sourceId}><strong>{result.source}</strong><span className={result.ok ? "sourceOk" : "sourceError"}>{result.ok ? `HTTP ${result.status}` : result.error}</span><small>{result.title || "Fără titlu detectat"}</small></article>)}</div></section>}
    </section>
  </main>;
}
