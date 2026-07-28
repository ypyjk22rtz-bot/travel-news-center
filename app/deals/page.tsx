"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { FlightDeal } from "@/lib/deal-engine";

export default function DealsPage() {
  const [deals, setDeals] = useState<FlightDeal[]>([]);
  const [mode, setMode] = useState("demo");
  const [filter, setFilter] = useState<"all" | "fare" | "promotion">("all");

  useEffect(() => {
    fetch("/api/deals").then((r) => r.json()).then((p) => {
      setDeals(p.deals ?? []);
      setMode(p.mode ?? "demo");
    });
  }, []);

  const visible = useMemo(() => filter === "all" ? deals : deals.filter((d) => d.dealType === filter || (d as any).deal_type === filter), [deals, filter]);

  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><span>TN</span><div><strong>Travel News Center</strong><small>AI NEWSROOM</small></div></div>
      <nav>
        <Link href="/">◫ Dashboard</Link>
        <Link href="/inbox">✦ News Inbox</Link>
        <Link href="/deals" className="active">€ Flight Deals</Link>
        <Link href="/sources">◎ Source Monitor</Link>
        <Link href="/writer">✎ AI Writer</Link>
      </nav>
      <div className="system"><i></i><div><strong>Deals Engine</strong><small>Mod: {mode}</small></div></div>
    </aside>

    <section className="content">
      <header className="topbar"><div><p className="eyebrow">FLIGHT DEALS & PROMOTIONS</p><h1>Cele mai ieftine zboruri</h1><span>Tarife și promoții verificate, ordonate după relevanța pentru România.</span></div></header>
      <div className="notice"><strong>{mode === "live" ? "LIVE" : "DEMO"}</strong><span>{mode === "live" ? "Date reale din baza de date." : "Tarife demonstrative. Conectarea la un furnizor real este obligatorie înainte de publicare."}</span></div>

      <section className="stats">
        <article><small>Oferte active</small><strong>{deals.length}</strong><span>tarife și promoții</span></article>
        <article><small>Din România</small><strong>{deals.filter((d) => d.relevanceRomania >= 70 || (d as any).relevance_romania >= 70).length}</strong><span>relevanță ridicată</span></article>
        <article><small>Promoții companii</small><strong>{deals.filter((d) => d.dealType === "promotion" || (d as any).deal_type === "promotion").length}</strong><span>coduri și campanii</span></article>
        <article><small>Necesită verificare</small><strong>{deals.filter((d) => !d.verified).length}</strong><span>control uman obligatoriu</span></article>
      </section>

      <section className="panel">
        <div className="panelTitle"><div><h2>Radar tarife</h2><p>Prețurile nu sunt publicate automat până nu sunt reconfirmate la furnizor.</p></div><div className="filters">{[["all","Toate"],["fare","Zboruri ieftine"],["promotion","Promoții"]].map(([v,l]) => <button key={v} className={filter === v ? "selected" : ""} onClick={() => setFilter(v as any)}>{l}</button>)}</div></div>
        <div className="newsTable">{visible.map((deal: any) => {
          const price = deal.price;
          const currency = deal.currency || "EUR";
          const score = deal.dealScore ?? deal.deal_score ?? 0;
          const relevance = deal.relevanceRomania ?? deal.relevance_romania ?? 0;
          const type = deal.dealType ?? deal.deal_type;
          return <article className="newsRow" key={deal.id}>
            <div className={`score ${score >= 80 ? "critical" : score >= 65 ? "high" : "medium"}`}><strong>{score}</strong><small>DEAL</small></div>
            <div className="newsMain"><div className="badges"><span>{type === "promotion" ? "PROMOȚIE" : "TARIF"}</span><em>România {relevance}/100</em>{deal.airlineName && <em>{deal.airlineName}</em>}</div><h3>{deal.title}</h3><p>{price ? `${price} ${currency}` : `${deal.discountPercent ?? deal.discount_percent ?? ""}% reducere`} · {deal.provider}</p></div>
            <span className="status">{deal.verified ? "VERIFICAT" : "NEVERIFICAT"}</span>
            <a className="open" href={deal.bookingUrl ?? deal.booking_url} target="_blank" rel="noreferrer">Verifică</a>
          </article>;
        })}</div>
      </section>
    </section>
  </main>;
}
