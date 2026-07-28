"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Confirmation = { id: string; title: string; sourceName: string; sourceUrl: string; detectedAt: string };
type ViralHeadline = { title: string; ctrScore: number };
type TrendingTopic = { rank: number; topic: string; mentions: number; heat: number };

type Signal = {
  id: string;
  source_title: string;
  generated_title: string | null;
  generated: boolean;
  viral_headlines: ViralHeadline[];
  estimated_ctr: number | null;
  trending_score: number | null;
  priority_label: string;
  source_excerpt: string | null;
  source_url: string;
  source_name: string;
  source_country: string;
  category: string;
  status: string;
  importance: string;
  intelligence_score: number;
  discover_score: number;
  detected_at: string;
  signal_type: string;
  urgency: "critical" | "high" | "medium" | "low";
  romania_impact: number;
  romania_reasons: string[];
  summary30s: string;
  summary2m: string;
  verdict: string | null;
  verdict_reason: string | null;
  auto_verdict: string;
  auto_verdict_reasons: string[];
  viral_score?: number;
  breaking_score?: number;
  ai_confidence?: number;
  composite_score: number;
  viralScore?: number;
  breakingScore?: number;
  aiConfidence?: number;
  duplicate_assessment: string | null;
  duplicate_count: number;
  confidence: number;
  confirmations: Confirmation[];
};

type RadarStats = {
  total: number; rawItems: number; groupedDuplicates: number; highRomaniaImpact: number;
  critical: number; high: number; routes: number; visas: number; disruptions: number; promotions: number; safety: number;
};

const FILTERS = [["toate", "Toate"], ["rute", "Rute noi"], ["vize", "Vize"], ["perturbari", "Perturbări"], ["taxe", "Taxe"], ["bagaje", "Bagaje"], ["promotii", "Promoții"], ["siguranta", "Siguranță"]] as const;

function label(value: string) {
  return ({ rute: "Rute noi", vize: "Vize", perturbari: "Perturbări", taxe: "Taxe", bagaje: "Bagaje", promotii: "Promoții", siguranta: "Siguranță", general: "General" } as Record<string, string>)[value] || value;
}

function stars(score: number) {
  const count = Math.max(1, Math.min(5, Math.round(score / 20)));
  return "★".repeat(count) + "☆".repeat(5 - count);
}

function scoreClass(score: number) {
  return score >= 85 ? "critical" : score >= 70 ? "high" : "medium";
}

function viral(item: Signal) { return Number(item.viral_score ?? item.viralScore ?? 0); }
function breaking(item: Signal) { return Number(item.breaking_score ?? item.breakingScore ?? 0); }
function aiConfidence(item: Signal) { return Number(item.ai_confidence ?? item.aiConfidence ?? item.confidence ?? 0); }

export default function RadarPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [trending, setTrending] = useState<TrendingTopic[]>([]);
  const [stats, setStats] = useState<RadarStats>({ total: 0, rawItems: 0, groupedDuplicates: 0, highRomaniaImpact: 0, critical: 0, high: 0, routes: 0, visas: 0, disruptions: 0, promotions: 0, safety: 0 });
  const [filter, setFilter] = useState("toate");
  const [urgency, setUrgency] = useState("toate");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Signal | null>(null);
  const [summaryMode, setSummaryMode] = useState<"30s" | "2m">("30s");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [modalMessage, setModalMessage] = useState("");

  async function load(selectedId?: string, keepMessage = false) {
    setLoading(true);
    if (!keepMessage) setMessage("");
    try {
      const response = await fetch("/api/radar", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Travel Radar nu a putut fi încărcat.");
      const nextSignals: Signal[] = payload.signals || [];
      setSignals(nextSignals);
      setTrending(payload.trending || []);
      setStats(payload.stats || {});
      const id = selectedId || selected?.id;
      if (id) setSelected(nextSignals.find((item) => item.id === id) || null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Travel Radar nu a putut fi încărcat.");
    } finally { setLoading(false); }
  }

  async function scanAndLoad() {
    setLoading(true);
    setMessage("Se verifică următorul lot de surse. Poate dura până la un minut...");
    try {
      const scanResponse = await fetch("/api/scan", { method: "POST", cache: "no-store" });
      const scan = await scanResponse.json().catch(() => ({}));
      if (!scanResponse.ok) throw new Error(scan.error || "Scanarea surselor a eșuat.");
      setMessage(`Scanare terminată: ${Number(scan.checked || 0)} surse verificate, ${Number(scan.successful || 0)} reușite, ${Number(scan.newsFound || 0)} articole găsite, ${Number(scan.newsInserted || 0)} știri noi salvate.`);
      await load(undefined, true);
    } catch (error) {
      setMessage(`Eroare la scanare: ${error instanceof Error ? error.message : "Scanarea a eșuat."}`);
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => signals.filter((item) => {
    if (filter !== "toate" && item.signal_type !== filter) return false;
    if (urgency !== "toate" && item.urgency !== urgency) return false;
    const haystack = `${item.source_title} ${item.generated_title || ""} ${item.source_excerpt || ""} ${item.category} ${item.source_name}`.toLowerCase();
    return !query.trim() || haystack.includes(query.trim().toLowerCase());
  }), [signals, filter, urgency, query]);

  function showTrending(topic: string) {
    setQuery(topic); setFilter("toate"); setUrgency("toate");
    window.setTimeout(() => document.getElementById("priority-queue")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  async function generate(item: Signal) {
    setBusy(item.id);
    setModalMessage("Se generează articolul, SEO, titlurile, social media și prompturile pentru imagini...");
    try {
      const response = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newsItemId: item.id }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Pachetul editorial nu a putut fi generat.");
      setModalMessage("Pachetul editorial complet a fost generat.");
      await load(item.id);
    } catch (error) { setModalMessage(`Eroare: ${error instanceof Error ? error.message : "Generarea a eșuat."}`); }
    finally { setBusy(""); }
  }

  async function setStatus(item: Signal, status: "reviewing" | "approved" | "rejected") {
    setBusy(item.id); setModalMessage("Se actualizează statusul...");
    try {
      const response = await fetch("/api/approval", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newsItemId: item.id, status }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Statusul nu a putut fi modificat.");
      setModalMessage(status === "reviewing" ? "Semnalul a fost trimis în analiza editorială." : status === "approved" ? "Semnalul a fost aprobat." : "Semnalul a fost respins.");
      await load(item.id);
    } catch (error) { setModalMessage(`Eroare: ${error instanceof Error ? error.message : "Acțiunea a eșuat."}`); }
    finally { setBusy(""); }
  }

  function openSignal(item: Signal) { setSummaryMode("30s"); setModalMessage(""); setSelected(item); }

  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><span>TN</span><div><strong>Travel News Center</strong><small>AI NEWSROOM</small></div></div>
      <nav><Link href="/">◫ Dashboard</Link><Link href="/news">✦ News Inbox</Link><Link href="/radar" className="active">⌁ Travel Radar</Link><Link href="/approval">✓ Approval Center</Link><Link href="/deals">€ Travel Deals</Link><Link href="/sources">◎ Source Monitor</Link><Link href="/published">↗ Published</Link><Link href="/activity">≡ Activity Log</Link><Link href="/settings">⚙ Settings</Link></nav>
      <div className="system"><i></i><div><strong>Radar LIVE</strong><small>{stats.total} semnale unice</small></div></div>
    </aside>

    <section className="content">
      <header className="topbar"><div><p className="eyebrow">AI INTELLIGENCE ENGINE 4.0</p><h1>Travel Radar 4.0</h1><span>Scoruri editoriale, verdict automat, trenduri și generare AI.</span></div><button onClick={scanAndLoad} disabled={loading}>{loading ? "Se scanează sursele..." : "↻ Scanează și actualizează"}</button></header>
      <div className="notice"><strong>CONTROL UMAN</strong><span>AI calculează și recomandă. Nicio știre nu este publicată automat.</span></div>
      {message && <section className="panel"><p>{message}</p></section>}

      <section className="stats">
        <article><small>Semnale unice</small><strong>{stats.total}</strong><span>din {stats.rawItems || stats.total} știri detectate</span></article>
        <article><small>Duplicate grupate</small><strong>{stats.groupedDuplicates || 0}</strong><span>știri reunite automat</span></article>
        <article><small>Impact mare România</small><strong>{stats.highRomaniaImpact || 0}</strong><span>minimum 70/100</span></article>
        <article><small>Critice și High</small><strong>{(stats.critical || 0) + (stats.high || 0)}</strong><span>prioritate editorială</span></article>
      </section>

      {trending.length > 0 && <section className="panel">
        <div className="panelTitle"><div><h2>🔥 Top Trending</h2><p>Cele mai repetate și puternice subiecte din semnalele curente.</p></div></div>
        <div className="newsTable">{trending.map((topic) => <article className="newsRow" key={`${topic.topic}-${topic.rank}`}>
          <div className="score medium"><strong>{topic.rank}</strong><small>TOP</small></div>
          <div className="newsMain"><h3>{topic.topic}</h3><p>{topic.mentions} mențiuni · Heat Score {topic.heat}/100</p></div>
          <button className="open" onClick={() => showTrending(topic.topic)}>Vezi semnalele</button>
        </article>)}</div>
      </section>}

      <section className="panel" id="priority-queue">
        <div className="panelTitle"><div><h2>Priority Queue</h2><p>Ordonare după scorul editorial compozit, urgență și impact.</p></div></div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Caută companie, țară, aeroport, sursă sau subiect..." style={{ width: "100%", marginBottom: 14 }} />
        <div className="filters" style={{ marginBottom: 10 }}>{FILTERS.map(([value, text]) => <button key={value} className={filter === value ? "selected" : ""} onClick={() => setFilter(value)}>{text}</button>)}</div>
        <div className="filters" style={{ marginBottom: 18 }}>{[["toate","Toate prioritățile"],["critical","Critic"],["high","High"],["medium","Medium"],["low","Low"]].map(([value,text]) => <button key={value} className={urgency === value ? "selected" : ""} onClick={() => setUrgency(value)}>{text}</button>)}</div>
        <div className="newsTable">
          {visible.map((item) => <article className="newsRow" key={item.id}>
            <div className={`score ${scoreClass(item.composite_score)}`}><strong>{item.composite_score || 0}</strong><small>AI SCORE</small></div>
            <div className="newsMain"><div className="badges"><span>{item.priority_label}</span><em>{label(item.signal_type)}</em><em>RO {item.romania_impact}</em><em>VIRAL {viral(item)}</em><em>BREAK {breaking(item)}</em>{item.duplicate_count > 1 && <em>{item.duplicate_count} SURSE</em>}</div><h3>{item.generated_title || item.source_title}</h3><p>{stars(item.composite_score)} · Discover {item.discover_score}/100 · AI Confidence {aiConfidence(item)}/100</p></div>
            <span className="status">{item.verdict || item.auto_verdict}</span><button className="open" onClick={() => openSignal(item)}>Analizează</button>
          </article>)}
          {!loading && visible.length === 0 && <p>Nu există semnale pentru filtrele selectate. Rulează o scanare sau resetează filtrele.</p>}
        </div>
      </section>
    </section>

    {selected && <div className="modalBackdrop" onClick={() => busy ? undefined : setSelected(null)}><section className="modal" onClick={(event) => event.stopPropagation()}>
      <button className="close" onClick={() => busy ? undefined : setSelected(null)}>×</button>
      <p className="eyebrow">{selected.priority_label} · {selected.urgency.toUpperCase()}</p><h2>{selected.generated_title || selected.source_title}</h2>
      <div className="modalMeta"><span>AI Score {selected.composite_score}/100</span><span>Travel {selected.intelligence_score}/100</span><span>România {selected.romania_impact}/100</span><span>Discover {selected.discover_score}/100</span><span>Viral {viral(selected)}/100</span><span>Breaking {breaking(selected)}/100</span><span>Confidence {aiConfidence(selected)}/100</span>{selected.estimated_ctr && <span>CTR {selected.estimated_ctr}%</span>}</div>
      {modalMessage && <div className="notice"><strong>{modalMessage.startsWith("Eroare") ? "EROARE" : busy ? "ÎN LUCRU" : "REZULTAT"}</strong><span>{modalMessage}</span></div>}
      <div className="notice"><strong>{selected.verdict || selected.auto_verdict}</strong><span>{selected.verdict_reason || selected.auto_verdict_reasons?.join(" ") || "Verdict calculat automat."}</span></div>
      <div className="sourceBox"><strong>De ce recomandă AI această decizie?</strong>{(selected.auto_verdict_reasons || []).map((reason) => <p key={reason}>✓ {reason}</p>)}</div>
      <div className="sourceBox"><strong>Impact pentru România · {stars(selected.romania_impact)}</strong>{selected.romania_reasons.map((reason) => <p key={reason}>✓ {reason}</p>)}</div>
      <div className="sourceBox"><strong>Explică-mi rapid</strong><div className="filters" style={{ marginTop: 12, marginBottom: 12 }}><button className={summaryMode === "30s" ? "selected" : ""} onClick={() => setSummaryMode("30s")}>30 secunde</button><button className={summaryMode === "2m" ? "selected" : ""} onClick={() => setSummaryMode("2m")}>2 minute</button></div><p>{summaryMode === "30s" ? selected.summary30s : selected.summary2m}</p></div>
      {selected.viral_headlines.length > 0 && <div className="sourceBox"><strong>Titluri AI recomandate</strong>{selected.viral_headlines.slice(0, 10).map((headline, index) => <p key={`${headline.title}-${index}`}><b>{index + 1}. {headline.title}</b> · CTR Score {headline.ctrScore}/100</p>)}</div>}
      <div className="sourceBox"><strong>Sursa principală</strong><p>{selected.source_excerpt || "Nu există rezumat disponibil."}</p><a href={selected.source_url} target="_blank" rel="noreferrer">Deschide {selected.source_name} ↗</a></div>
      <div className="sourceBox"><strong>{selected.duplicate_count > 1 ? `${selected.duplicate_count} surse au raportat acest subiect` : "Confirmarea surselor"}</strong><p>{selected.duplicate_assessment || (selected.duplicate_count > 1 ? "Sursele similare au fost grupate automat. Verifică diferențele înainte de publicare." : "Momentan a fost identificată o singură sursă distinctă.")}</p>{selected.confirmations.map((confirmation) => <p key={confirmation.id}><a href={confirmation.sourceUrl} target="_blank" rel="noreferrer">{confirmation.sourceName}: {confirmation.title} ↗</a></p>)}</div>
      <div className="actions">
        <button className="primary" onClick={() => generate(selected)} disabled={busy === selected.id}>{busy === selected.id ? "Se generează..." : selected.generated ? "Regenerează pachetul editorial" : "Generează pachet editorial"}</button>
        <button onClick={() => setStatus(selected, "reviewing")} disabled={busy === selected.id}>Trimite la analiză</button>
        <button onClick={() => setStatus(selected, "approved")} disabled={busy === selected.id}>Aprobă semnalul</button>
        <Link href="/approval">Deschide Approval Center ↗</Link>
        <button className="danger" onClick={() => setStatus(selected, "rejected")} disabled={busy === selected.id}>Respinge</button>
      </div>
    </section></div>}
  </main>;
}
