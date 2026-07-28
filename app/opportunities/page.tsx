"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Monetization = { name: string; score: number; reason: string };
type Opportunity = {
  id: string;
  source_title: string;
  generated_title: string | null;
  source_excerpt: string | null;
  source_url: string;
  source_name: string;
  status: string;
  signal_type: string;
  priority_label: string;
  opportunity_score: number;
  opportunity_bucket: string;
  opportunity_reasons: string[];
  monetization: Monetization[];
  intelligence_score: number;
  discover_score: number;
  romania_impact: number;
  viral_score: number;
  breaking_score: number;
  ai_confidence: number;
  duplicate_count: number;
  generated: boolean;
};

type Stats = { total: number; publicaAcum: number; romania: number; flightDeals: number; discover: number; monetizare: number; monitorizeaza: number };

const FILTERS = [
  ["toate", "Toate"],
  ["publica_acum", "🔥 Publică acum"],
  ["romania", "🇷🇴 România"],
  ["flight_deals", "✈ Flight Deals"],
  ["discover", "🌍 Discover"],
  ["monetizare", "💰 Monetizare"],
  ["monitorizeaza", "👀 Monitorizează"],
] as const;

function stars(score: number) {
  const count = Math.max(1, Math.min(5, Math.round(score / 20)));
  return "★".repeat(count) + "☆".repeat(5 - count);
}

export default function OpportunityRadarPage() {
  const [items, setItems] = useState<Opportunity[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, publicaAcum: 0, romania: 0, flightDeals: 0, discover: 0, monetizare: 0, monitorizeaza: 0 });
  const [filter, setFilter] = useState("toate");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/opportunities", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Opportunity Radar nu a putut fi încărcat.");
      setItems(payload.opportunities || []);
      setStats(payload.stats || {});
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Opportunity Radar nu a putut fi încărcat.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => items.filter((item) => {
    if (filter !== "toate" && item.opportunity_bucket !== filter) return false;
    const text = `${item.source_title} ${item.generated_title || ""} ${item.source_excerpt || ""} ${item.source_name}`.toLowerCase();
    return !query.trim() || text.includes(query.trim().toLowerCase());
  }), [items, filter, query]);

  async function generate(item: Opportunity) {
    setBusy(item.id);
    setMessage("Se generează pachetul editorial complet...");
    try {
      const response = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newsItemId: item.id }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Generarea a eșuat.");
      setMessage("Pachetul editorial a fost generat și este disponibil în Approval Center.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Generarea a eșuat.");
    } finally {
      setBusy("");
    }
  }

  async function sendToApproval(item: Opportunity) {
    setBusy(item.id);
    setMessage("Se trimite în Approval Center...");
    try {
      const response = await fetch("/api/approval", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newsItemId: item.id, status: "reviewing" }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Trimiterea a eșuat.");
      setMessage("Oportunitatea a fost trimisă în Approval Center.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Trimiterea a eșuat.");
    } finally {
      setBusy("");
    }
  }

  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><span>TN</span><div><strong>Travel News Center</strong><small>AI NEWSROOM</small></div></div>
      <nav>
        <Link href="/">◫ Dashboard</Link><Link href="/news">✦ News Inbox</Link><Link href="/radar">⌁ Travel Radar</Link><Link href="/opportunities" className="active">🏆 Opportunity Radar</Link><Link href="/approval">✓ Approval Center</Link><Link href="/deals">€ Travel Deals</Link><Link href="/sources">◎ Source Monitor</Link><Link href="/published">↗ Published</Link><Link href="/activity">≡ Activity Log</Link><Link href="/settings">⚙ Settings</Link>
      </nav>
      <div className="system"><i></i><div><strong>Opportunities LIVE</strong><small>{stats.total} oportunități</small></div></div>
    </aside>

    <section className="content">
      <header className="topbar"><div><p className="eyebrow">TRAFFIC & REVENUE INTELLIGENCE</p><h1>Opportunity Radar</h1><span>AI identifică subiectele care pot aduce trafic, Discover și venit afiliat.</span></div><button onClick={load} disabled={loading}>{loading ? "Se actualizează..." : "↻ Actualizează"}</button></header>
      <div className="notice"><strong>CONTROL UMAN</strong><span>Scorurile sunt recomandări editoriale. Nicio oportunitate nu este publicată automat.</span></div>
      {message && <section className="panel"><p>{message}</p></section>}

      <section className="stats">
        <article><small>Total oportunități</small><strong>{stats.total}</strong><span>din semnalele active</span></article>
        <article><small>Publică acum</small><strong>{stats.publicaAcum}</strong><span>fereastră editorială scurtă</span></article>
        <article><small>România</small><strong>{stats.romania}</strong><span>impact direct pentru public</span></article>
        <article><small>Monetizare</small><strong>{stats.monetizare + stats.flightDeals}</strong><span>CTA afiliat recomandat</span></article>
      </section>

      <section className="panel">
        <div className="panelTitle"><div><h2>Oportunități prioritizate</h2><p>Ordinate după trafic, Discover, România, viralitate, încredere și monetizare.</p></div></div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Caută destinație, companie, aeroport sau subiect..." style={{ width: "100%", marginBottom: 14 }} />
        <div className="filters" style={{ marginBottom: 18 }}>{FILTERS.map(([value, text]) => <button key={value} className={filter === value ? "selected" : ""} onClick={() => setFilter(value)}>{text}</button>)}</div>

        <div className="newsTable">
          {visible.map((item) => <article className="newsRow" key={item.id}>
            <div className={`score ${item.opportunity_score >= 85 ? "critical" : item.opportunity_score >= 70 ? "high" : "medium"}`}><strong>{item.opportunity_score}</strong><small>OPP</small></div>
            <div className="newsMain">
              <div className="badges"><span>{stars(item.opportunity_score)}</span><em>{item.priority_label}</em><em>RO {item.romania_impact}</em><em>DISC {item.discover_score}</em>{item.duplicate_count > 1 && <em>{item.duplicate_count} SURSE</em>}</div>
              <h3>{item.generated_title || item.source_title}</h3>
              <p>{item.opportunity_reasons.join(" · ")}</p>
              <p><b>Monetizare:</b> {item.monetization.map((channel) => `${channel.name} ${channel.score}/100`).join(" · ")}</p>
            </div>
            <span className="status">{item.opportunity_score >= 82 ? "PUBLICĂ ACUM" : item.opportunity_score >= 65 ? "MERITĂ" : "URMĂREȘTE"}</span>
            <div className="actions" style={{ minWidth: 180 }}>
              <button className="primary" onClick={() => generate(item)} disabled={busy === item.id}>{busy === item.id ? "Se procesează..." : item.generated ? "Regenerează articol" : "Generează articol"}</button>
              <button onClick={() => sendToApproval(item)} disabled={busy === item.id}>Trimite la Approval</button>
              <a href={item.source_url} target="_blank" rel="noreferrer">Sursa ↗</a>
            </div>
          </article>)}
          {!loading && visible.length === 0 && <p>Nu există oportunități pentru filtrul selectat.</p>}
        </div>
      </section>
    </section>
  </main>;
}
