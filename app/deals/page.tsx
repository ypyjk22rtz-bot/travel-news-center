"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { FlightDeal } from "@/lib/deal-engine";

function formatDate(value?: string) {
  if (!value) return "dată flexibilă";
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: "numeric" });
}

export default function DealsPage() {
  const [deals, setDeals] = useState<FlightDeal[]>([]);
  const [mode, setMode] = useState("loading");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "romania" | "nearby" | "under100">("all");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/deals", { cache: "no-store" });
      const payload = await response.json();
      setDeals(payload.deals ?? []);
      setMode(payload.mode ?? (response.ok ? "live" : "error"));
      setError(payload.error ?? "");
    } catch (cause) {
      setMode("error");
      setError(cause instanceof Error ? cause.message : "Nu s-au putut încărca tarifele.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => deals.filter((deal) => {
    if (filter === "romania") return deal.relevanceRomania >= 90;
    if (filter === "nearby") return ["BUD", "VIE", "SOF"].includes(deal.originCode || "");
    if (filter === "under100") return Boolean(deal.price && deal.price <= 100);
    return true;
  }), [deals, filter]);

  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><span>TN</span><div><strong>Travel News Center</strong><small>AI NEWSROOM</small></div></div>
      <nav>
        <Link href="/">◫ Dashboard</Link>
        <Link href="/news">✦ News Inbox</Link>
        <Link href="/radar">⌁ Travel Radar</Link>
        <Link href="/approval">✓ Approval Center</Link>
        <Link href="/deals" className="active">€ Travel Deals</Link>
        <Link href="/sources">◎ Source Monitor</Link>
        <Link href="/published">↗ Published</Link>
        <Link href="/settings">⚙ Settings</Link>
      </nav>
      <div className="system"><i></i><div><strong>Travelpayouts</strong><small>Mod: {mode}</small></div></div>
    </aside>

    <section className="content">
      <header className="topbar"><div><p className="eyebrow">TRAVELPAYOUTS FLIGHT DATA</p><h1>Cele mai ieftine bilete</h1><span>Tarife recente din cache-ul Travelpayouts, selectate pentru România și aeroporturile apropiate.</span></div><button onClick={load} disabled={loading}>{loading ? "Se încarcă..." : "↻ Actualizează"}</button></header>
      <div className="notice"><strong>{mode === "live" ? "LIVE" : mode === "loading" ? "SE ÎNCARCĂ" : "NECONFIGURAT"}</strong><span>{mode === "live" ? "Prețurile sunt orientative și trebuie reconfirmate în pagina de căutare înainte de rezervare." : error || "Se conectează la Travelpayouts..."}</span></div>

      <section className="stats">
        <article><small>Oferte găsite</small><strong>{deals.length}</strong><span>Travelpayouts / Aviasales</span></article>
        <article><small>Plecări din România</small><strong>{deals.filter((deal) => deal.relevanceRomania >= 90).length}</strong><span>BUH, IAS, CLJ, TSR, SBZ, CRA, BCM, SCV</span></article>
        <article><small>Aeroporturi apropiate</small><strong>{deals.filter((deal) => ["BUD", "VIE", "SOF"].includes(deal.originCode || "")).length}</strong><span>Budapesta, Viena și Sofia</span></article>
        <article><small>Sub 100 EUR</small><strong>{deals.filter((deal) => Boolean(deal.price && deal.price <= 100)).length}</strong><span>tarife găsite recent</span></article>
      </section>

      <section className="panel">
        <div className="panelTitle"><div><h2>Oferte speciale și tarife ieftine</h2><p>Apasă „Verifică prețul” pentru a porni o căutare nouă cu Partner ID-ul Travelpayouts.</p></div><div className="filters">{[["all","Toate"],["romania","Din România"],["nearby","Aeroporturi apropiate"],["under100","Sub 100 EUR"]].map(([value,label]) => <button key={value} className={filter === value ? "selected" : ""} onClick={() => setFilter(value as typeof filter)}>{label}</button>)}</div></div>
        {mode !== "live" && !visible.length ? <div className="sourceBox"><strong>Conexiunea Travelpayouts nu este activă.</strong><p>{error || "Adaugă tokenul API și Partner ID-ul în Vercel, apoi pornește un redeploy."}</p></div> : null}
        <div className="newsTable">{visible.map((deal) => <article className="newsRow" key={deal.id}>
          <div className={`score ${deal.dealScore >= 80 ? "critical" : deal.dealScore >= 65 ? "high" : "medium"}`}><strong>{deal.dealScore}</strong><small>DEAL</small></div>
          <div className="newsMain"><div className="badges"><span>TARIF</span><em>România {deal.relevanceRomania}/100</em><em>{deal.originCode} → {deal.destinationCode}</em></div><h3>{deal.title}</h3><p>Plecare: {formatDate(deal.departureDate)}{deal.returnDate ? ` · Retur: ${formatDate(deal.returnDate)}` : " · Doar dus"} · preț găsit în cache</p></div>
          <span className="status">{deal.price} {deal.currency}</span>
          <a className="open" href={deal.bookingUrl} target="_blank" rel="nofollow sponsored noreferrer">Verifică prețul</a>
        </article>)}</div>
        {!loading && mode === "live" && visible.length === 0 ? <p>Nu există momentan oferte în filtrul selectat.</p> : null}
      </section>
    </section>
  </main>;
}
