"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { FlightDeal } from "@/lib/deal-engine";

export default function DealsPage() {
  const [deals, setDeals] = useState<FlightDeal[]>([]);
  const [mode, setMode] = useState("loading");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "fare" | "promotion">("all");

  useEffect(() => {
    fetch("/api/deals", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        setDeals(payload.deals ?? []);
        setMode(payload.mode ?? (response.ok ? "live" : "error"));
        setError(payload.error ?? "");
      })
      .catch((cause) => {
        setMode("error");
        setError(cause instanceof Error ? cause.message : "Nu s-au putut încărca tarifele.");
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
      <div className="system"><i></i><div><strong>Travelpayouts</strong><small>Mod: {mode}</small></div></div>
    </aside>

    <section className="content">
      <header className="topbar"><div><p className="eyebrow">TRAVELPAYOUTS FLIGHT DATA</p><h1>Cele mai ieftine zboruri</h1><span>Tarife recente din cache-ul Travelpayouts, ordonate după relevanța pentru România.</span></div></header>
      <div className="notice"><strong>{mode === "live" ? "LIVE" : mode === "loading" ? "SE ÎNCARCĂ" : "NECONFIGURAT"}</strong><span>{mode === "live" ? "Tarife reale primite de la Travelpayouts. Prețul trebuie reconfirmat înainte de publicare." : error || "Se conectează la Travelpayouts..."}</span></div>

      <section className="stats">
        <article><small>Oferte primite</small><strong>{deals.length}</strong><span>Travelpayouts / Aviasales</span></article>
        <article><small>Din România</small><strong>{deals.filter((d) => d.relevanceRomania >= 90 || (d as any).relevance_romania >= 90).length}</strong><span>BUH, IAS, CLJ, TSR, SBZ, CRA</span></article>
        <article><small>Aeroporturi apropiate</small><strong>{deals.filter((d: any) => ["BUD", "VIE", "SOF"].includes(d.origin)).length}</strong><span>Budapesta, Viena, Sofia</span></article>
        <article><small>Necesită reconfirmare</small><strong>{deals.filter((d) => !d.verified).length}</strong><span>prețuri provenite din cache</span></article>
      </section>

      <section className="panel">
        <div className="panelTitle"><div><h2>Radar tarife</h2><p>Nu publicăm automat. Fiecare tarif se verifică în pagina de rezervare.</p></div><div className="filters">{[["all","Toate"],["fare","Zboruri ieftine"],["promotion","Promoții"]].map(([v,l]) => <button key={v} className={filter === v ? "selected" : ""} onClick={() => setFilter(v as any)}>{l}</button>)}</div></div>
        {mode !== "live" && !visible.length ? <div className="sourceBox"><strong>Conexiunea Travelpayouts nu este activă încă.</strong><p>{error || "Adaugă tokenul API în Vercel. După redeploy, ofertele reale vor apărea automat aici."}</p></div> : null}
        <div className="newsTable">{visible.map((deal: any) => {
          const price = deal.price;
          const currency = deal.currency || "EUR";
          const score = deal.dealScore ?? deal.deal_score ?? 0;
          const relevance = deal.relevanceRomania ?? deal.relevance_romania ?? 0;
          const type = deal.dealType ?? deal.deal_type;
          return <article className="newsRow" key={deal.id}>
            <div className={`score ${score >= 80 ? "critical" : score >= 65 ? "high" : "medium"}`}><strong>{score}</strong><small>DEAL</small></div>
            <div className="newsMain"><div className="badges"><span>{type === "promotion" ? "PROMOȚIE" : "TARIF"}</span><em>România {relevance}/100</em>{deal.airlineName && <em>{deal.airlineName}</em>}</div><h3>{deal.title}</h3><p>{price ? `${price} ${currency}` : `${deal.discountPercent ?? deal.discount_percent ?? ""}% reducere`} · {deal.provider}</p></div>
            <span className="status">CACHE API</span>
            <a className="open" href={deal.bookingUrl ?? deal.booking_url} target="_blank" rel="noreferrer">Reconfirmă</a>
          </article>;
        })}</div>
      </section>
    </section>
  </main>;
}
