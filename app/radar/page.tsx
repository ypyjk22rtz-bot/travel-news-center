"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Signal = {
  id: string;
  source_title: string;
  source_excerpt: string | null;
  source_url: string;
  category: string;
  status: string;
  importance: string;
  intelligence_score: number;
  discover_score: number;
  detected_at: string;
  signal_type: string;
  urgency: "critical" | "high" | "medium" | "low";
};

type RadarStats = {
  total: number;
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

export default function RadarPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [stats, setStats] = useState<RadarStats>({ total: 0, critical: 0, high: 0, routes: 0, visas: 0, disruptions: 0, promotions: 0, safety: 0 });
  const [filter, setFilter] = useState("toate");
  const [urgency, setUrgency] = useState("toate");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Signal | null>(null);
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
    const haystack = `${item.source_title} ${item.source_excerpt || ""} ${item.category}`.toLowerCase();
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
      <div className="system"><i></i><div><strong>Radar LIVE</strong><small>{stats.total} semnale active</small></div></div>
    </aside>

    <section className="content">
      <header className="topbar"><div><p className="eyebrow">LIVE TRAVEL INTELLIGENCE</p><h1>Travel Radar</h1><span>Semnale prioritizate automat din fluxul real de știri Travelistul.</span></div><button onClick={load} disabled={loading}>{loading ? "Se actualizează..." : "↻ Actualizează radarul"}</button></header>
      <div className="notice"><strong>LIVE</strong><span>Datele provin din Supabase. Niciun articol nu este publicat automat.</span></div>
      {message && <section className="panel"><p>{message}</p></section>}

      <section className="stats">
        <article><small>Semnale active</small><strong>{stats.total}</strong><span>toate categoriile</span></article>
        <article><small>Critice</small><strong>{stats.critical}</strong><span>necesită atenție imediată</span></article>
        <article><small>Prioritate mare</small><strong>{stats.high}</strong><span>potențial editorial ridicat</span></article>
        <article><small>Rute și perturbări</small><strong>{stats.routes + stats.disruptions}</strong><span>impact direct asupra călătorilor</span></article>
      </section>

      <section className="panel">
        <div className="panelTitle"><div><h2>Semnale detectate</h2><p>Filtrează, deschide și trimite în fluxul editorial.</p></div></div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Caută companie, țară, aeroport sau subiect..." style={{ width: "100%", marginBottom: 14 }} />
        <div className="filters" style={{ marginBottom: 10 }}>{FILTERS.map(([value, text]) => <button key={value} className={filter === value ? "selected" : ""} onClick={() => setFilter(value)}>{text}</button>)}</div>
        <div className="filters" style={{ marginBottom: 18 }}>{[["toate","Toate prioritățile"],["critical","Critic"],["high","High"],["medium","Medium"],["low","Low"]].map(([value,text]) => <button key={value} className={urgency === value ? "selected" : ""} onClick={() => setUrgency(value)}>{text}</button>)}</div>

        <div className="newsTable">
          {visible.map((item) => <article className="newsRow" key={item.id}>
            <div className={`score ${item.urgency === "critical" ? "critical" : item.urgency === "high" ? "high" : "medium"}`}><strong>{item.intelligence_score || 0}</strong><small>RADAR</small></div>
            <div className="newsMain"><div className="badges"><span>{label(item.signal_type)}</span><em>{item.urgency.toUpperCase()}</em><em>{item.status}</em></div><h3>{item.source_title}</h3><p>Discover {item.discover_score || 0}/100 · detectat {new Date(item.detected_at).toLocaleString("ro-RO")}</p></div>
            <span className="status">{item.category || "general"}</span>
            <button className="open" onClick={() => setSelected(item)}>Analizează</button>
          </article>)}
          {!loading && visible.length === 0 && <p>Nu există semnale pentru filtrele selectate.</p>}
        </div>
      </section>
    </section>

    {selected && <div className="modalBackdrop" onClick={() => busy ? undefined : setSelected(null)}><section className="modal" onClick={(event) => event.stopPropagation()}>
      <button className="close" onClick={() => busy ? undefined : setSelected(null)}>×</button>
      <p className="eyebrow">{label(selected.signal_type).toUpperCase()} · {selected.urgency.toUpperCase()}</p>
      <h2>{selected.source_title}</h2>
      <div className="modalMeta"><span>Intel {selected.intelligence_score || 0}/100</span><span>Discover {selected.discover_score || 0}/100</span><span>{selected.status}</span></div>
      <div className="sourceBox"><strong>Rezumatul sursei</strong><p>{selected.source_excerpt || "Nu există rezumat disponibil."}</p><a href={selected.source_url} target="_blank" rel="noreferrer">Deschide sursa oficială ↗</a></div>
      <div className="actions">
        <button onClick={() => setStatus(selected, "reviewing")} disabled={busy === selected.id}>{busy === selected.id ? "Se procesează..." : "Trimite la analiză"}</button>
        <button className="primary" onClick={() => setStatus(selected, "approved")} disabled={busy === selected.id}>{busy === selected.id ? "Se procesează..." : "Aprobă semnalul"}</button>
        <Link href="/approval">Deschide Approval Center ↗</Link>
        <button className="danger" onClick={() => setStatus(selected, "rejected")} disabled={busy === selected.id}>Respinge</button>
      </div>
    </section></div>}
  </main>;
}
