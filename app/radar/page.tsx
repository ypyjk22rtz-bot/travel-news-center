"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Confirmation = {
  id: string;
  title: string;
  sourceName: string;
  sourceUrl: string;
  detectedAt: string;
};

type Signal = {
  id: string;
  source_title: string;
  generated_title: string | null;
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
  duplicate_assessment: string | null;
  duplicate_count: number;
  confidence: number;
  confirmations: Confirmation[];
};

type RadarStats = {
  total: number;
  rawItems: number;
  groupedDuplicates: number;
  highRomaniaImpact: number;
  critical: number;
  high: number;
  routes: number;
  visas: number;
  disruptions: number;
  promotions: number;
  safety: number;
};

const FILTERS = [
  ["toate", "Toate"],
  ["rute", "Rute noi"],
  ["vize", "Vize"],
  ["perturbari", "Perturbări"],
  ["taxe", "Taxe"],
  ["bagaje", "Bagaje"],
  ["promotii", "Promoții"],
  ["siguranta", "Siguranță"],
] as const;

function label(value: string) {
  return ({ rute: "Rute noi", vize: "Vize", perturbari: "Perturbări", taxe: "Taxe", bagaje: "Bagaje", promotii: "Promoții", siguranta: "Siguranță", general: "General" } as Record<string, string>)[value] || value;
}

function stars(score: number) {
  const count = Math.max(1, Math.min(5, Math.round(score / 20)));
  return "★".repeat(count) + "☆".repeat(5 - count);
}

export default function RadarPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [stats, setStats] = useState<RadarStats>({ total: 0, rawItems: 0, groupedDuplicates: 0, highRomaniaImpact: 0, critical: 0, high: 0, routes: 0, visas: 0, disruptions: 0, promotions: 0, safety: 0 });
  const [filter, setFilter] = useState("toate");
  const [urgency, setUrgency] = useState("toate");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Signal | null>(null);
  const [summaryMode, setSummaryMode] = useState<"30s" | "2m">("30s");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/radar", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Travel Radar nu a putut fi încărcat.");
      setSignals(payload.signals || []);
      setStats(payload.stats || {});
      if (selected) setSelected((payload.signals || []).find((item: Signal) => item.id === selected.id) || null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Travel Radar nu a putut fi încărcat.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => signals.filter((item) => {
    if (filter !== "toate" && item.signal_type !== filter) return false;
    if (urgency !== "toate" && item.urgency !== urgency) return false;
    const haystack = `${item.source_title} ${item.source_excerpt || ""} ${item.category} ${item.source_name}`.toLowerCase();
    if (query.trim() && !haystack.includes(query.trim().toLowerCase())) return false;
    return true;
  }), [signals, filter, urgency, query]);

  async function setStatus(item: Signal, status: "reviewing" | "approved" | "rejected") {
    setBusy(item.id);
    setMessage("");
    try {
      const response = await fetch("/api/approval", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newsItemId: item.id, status }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Statusul nu a putut fi modificat.");
      setMessage(status === "reviewing" ? "Semnalul a fost trimis în analiza editorială." : status === "approved" ? "Semnalul a fost aprobat." : "Semnalul a fost respins.");
      setSelected(null);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Acțiunea a eșuat.");
    } finally {
      setBusy("");
    }
  }

  function openSignal(item: Signal) {
    setSummaryMode("30s");
    setSelected(item);
  }

  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><span>TN</span><div><strong>Travel News Center</strong><small>AI NEWSROOM</small></div></div>
      <nav>
        <Link href="/">◫ Dashboard</Link>
        <Link href="/news">✦ News Inbox</Link>
        <Link href="/radar" className="active">⌁ Travel Radar</Link>
        <Link href="/approval">✓ Approval Center</Link>
        <Link href="/deals">€ Travel Deals</Link>
        <Link href="/sources">◎ Source Monitor</Link>
        <Link href="/published">↗ Published</Link>
        <Link href="/activity">≡ Activity Log</Link>
        <Link href="/settings">⚙ Settings</Link>
      </nav>
      <div className="system"><i></i><div><strong>Radar LIVE</strong><small>{stats.total} semnale unice</small></div></div>
    </aside>

    <section className="content">
      <header className="topbar"><div><p className="eyebrow">TRAVEL INTELLIGENCE ENGINE</p><h1>Travel Radar 2.0</h1><span>Semnale grupate, impact pentru România și rezumate AI.</span></div><button onClick={load} disabled={loading}>{loading ? "Se actualizează..." : "↻ Actualizează radarul"}</button></header>
      <div className="notice"><strong>CONTROL UMAN</strong><span>Duplicatele sunt grupate automat. Niciun articol nu este publicat fără aprobarea ta.</span></div>
      {message && <section className="panel"><p>{message}</p></section>}

      <section className="stats">
        <article><small>Semnale unice</small><strong>{stats.total}</strong><span>din {stats.rawItems || stats.total} știri detectate</span></article>
        <article><small>Duplicate grupate</small><strong>{stats.groupedDuplicates || 0}</strong><span>știri eliminate din aglomerație</span></article>
        <article><small>Impact mare România</small><strong>{stats.highRomaniaImpact || 0}</strong><span>scor de minimum 70/100</span></article>
        <article><small>Critice și High</small><strong>{(stats.critical || 0) + (stats.high || 0)}</strong><span>necesită atenție editorială</span></article>
      </section>

      <section className="panel">
        <div className="panelTitle"><div><h2>Semnale detectate</h2><p>Mai multe surse despre același subiect sunt reunite într-un singur semnal.</p></div></div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Caută companie, țară, aeroport, sursă sau subiect..." style={{ width: "100%", marginBottom: 14 }} />
        <div className="filters" style={{ marginBottom: 10 }}>{FILTERS.map(([value, text]) => <button key={value} className={filter === value ? "selected" : ""} onClick={() => setFilter(value)}>{text}</button>)}</div>
        <div className="filters" style={{ marginBottom: 18 }}>{[["toate","Toate prioritățile"],["critical","Critic"],["high","High"],["medium","Medium"],["low","Low"]].map(([value,text]) => <button key={value} className={urgency === value ? "selected" : ""} onClick={() => setUrgency(value)}>{text}</button>)}</div>

        <div className="newsTable">
          {visible.map((item) => <article className="newsRow" key={item.id}>
            <div className={`score ${item.urgency === "critical" ? "critical" : item.urgency === "high" ? "high" : "medium"}`}><strong>{item.intelligence_score || 0}</strong><small>TRAVEL</small></div>
            <div className="newsMain">
              <div className="badges"><span>{label(item.signal_type)}</span><em>{item.urgency.toUpperCase()}</em><em>RO {item.romania_impact}/100</em>{item.duplicate_count > 1 && <em>{item.duplicate_count} SURSE</em>}</div>
              <h3>{item.generated_title || item.source_title}</h3>
              <p>{stars(item.romania_impact)} · Încredere {item.confidence}/100 · Discover {item.discover_score || 0}/100</p>
            </div>
            <span className="status">{item.verdict || item.status}</span>
            <button className="open" onClick={() => openSignal(item)}>Analizează</button>
          </article>)}
          {!loading && visible.length === 0 && <p>Nu există semnale pentru filtrele selectate.</p>}
        </div>
      </section>
    </section>

    {selected && <div className="modalBackdrop" onClick={() => busy ? undefined : setSelected(null)}><section className="modal" onClick={(event) => event.stopPropagation()}>
      <button className="close" onClick={() => busy ? undefined : setSelected(null)}>×</button>
      <p className="eyebrow">{label(selected.signal_type).toUpperCase()} · {selected.urgency.toUpperCase()}</p>
      <h2>{selected.generated_title || selected.source_title}</h2>
      <div className="modalMeta"><span>Travel {selected.intelligence_score || 0}/100</span><span>România {selected.romania_impact}/100</span><span>Discover {selected.discover_score || 0}/100</span><span>Încredere {selected.confidence}/100</span></div>

      {selected.verdict && <div className="notice"><strong>{selected.verdict}</strong><span>{selected.verdict_reason || "Verdict generat de AI Intelligence."}</span></div>}

      <div className="sourceBox">
        <strong>Impact pentru România · {stars(selected.romania_impact)}</strong>
        {selected.romania_reasons.map((reason) => <p key={reason}>✓ {reason}</p>)}
      </div>

      <div className="sourceBox">
        <strong>Explică-mi rapid</strong>
        <div className="filters" style={{ marginTop: 12, marginBottom: 12 }}>
          <button className={summaryMode === "30s" ? "selected" : ""} onClick={() => setSummaryMode("30s")}>30 secunde</button>
          <button className={summaryMode === "2m" ? "selected" : ""} onClick={() => setSummaryMode("2m")}>2 minute</button>
        </div>
        <p>{summaryMode === "30s" ? selected.summary30s : selected.summary2m}</p>
      </div>

      <div className="sourceBox"><strong>Sursa principală</strong><p>{selected.source_excerpt || "Nu există rezumat disponibil."}</p><a href={selected.source_url} target="_blank" rel="noreferrer">Deschide {selected.source_name} ↗</a></div>

      <div className="sourceBox">
        <strong>{selected.duplicate_count > 1 ? `${selected.duplicate_count} surse au raportat acest subiect` : "Confirmarea surselor"}</strong>
        <p>{selected.duplicate_assessment || (selected.duplicate_count > 1 ? "Sursele similare au fost grupate automat. Verifică diferențele înainte de publicare." : "Momentan a fost identificată o singură sursă distinctă.")}</p>
        {selected.confirmations.map((confirmation) => <p key={confirmation.id}><a href={confirmation.sourceUrl} target="_blank" rel="noreferrer">{confirmation.sourceName}: {confirmation.title} ↗</a></p>)}
      </div>

      <div className="actions">
        <button onClick={() => setStatus(selected, "reviewing")} disabled={busy === selected.id}>{busy === selected.id ? "Se procesează..." : "Trimite la analiză"}</button>
        <button className="primary" onClick={() => setStatus(selected, "approved")} disabled={busy === selected.id}>{busy === selected.id ? "Se procesează..." : "Aprobă semnalul"}</button>
        <Link href="/approval">Deschide Approval Center ↗</Link>
        <button className="danger" onClick={() => setStatus(selected, "rejected")} disabled={busy === selected.id}>Respinge</button>
      </div>
    </section></div>}
  </main>;
}
