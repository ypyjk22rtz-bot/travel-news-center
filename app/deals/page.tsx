"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { FlightDeal } from "@/lib/deal-engine";

const ROMANIA_ORIGINS = new Set(["BUH", "OTP", "BBU", "IAS", "CLJ", "TSR", "SBZ", "CRA", "BCM", "SCV"]);
const NEARBY_ORIGINS = new Set(["BUD", "VIE", "SOF"]);
const ASIA_DESTINATIONS = new Set(["BKK", "HKT", "SIN", "KUL", "HKG", "NRT", "HND", "KIX", "ICN", "PEK", "PKX", "PVG", "CAN", "SZX", "DPS", "SGN", "HAN", "DAD", "MNL", "CEB", "DEL", "BOM", "CMB"]);
const EUROPE_DESTINATIONS = new Set(["LON", "LGW", "LTN", "STN", "LHR", "FCO", "CIA", "MXP", "BGY", "VCE", "BCN", "MAD", "VLC", "PAR", "CDG", "ORY", "BVA", "BER", "MUC", "FRA", "VIE", "BUD", "PRG", "WAW", "KRK", "ATH", "SKG", "SOF", "IST", "SAW", "LIS", "OPO", "BRU", "CRL", "AMS", "CPH", "ARN", "OSL", "DUB"]);

function formatDate(value?: string) {
  if (!value) return "dată flexibilă";
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: "numeric" });
}

function uniqueDeals(items: FlightDeal[], limit = 8) {
  const seen = new Set<string>();
  return items.filter((deal) => {
    const key = `${deal.originCode}-${deal.destinationCode}-${deal.price}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

export default function DealsPage() {
  const [deals, setDeals] = useState<FlightDeal[]>([]);
  const [mode, setMode] = useState("loading");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

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

  const sections = useMemo(() => {
    const byPrice = [...deals].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    const romania = uniqueDeals(byPrice.filter((deal) => ROMANIA_ORIGINS.has(deal.originCode || "")), 10);
    const asia = uniqueDeals(byPrice.filter((deal) => ASIA_DESTINATIONS.has(deal.destinationCode || "")), 10);
    const europeUnder50 = uniqueDeals(byPrice.filter((deal) => EUROPE_DESTINATIONS.has(deal.destinationCode || "") && Boolean(deal.price && deal.price <= 50)), 10);
    const aiBest = uniqueDeals([...deals].sort((a, b) => b.dealScore - a.dealScore || (a.price ?? Infinity) - (b.price ?? Infinity)), 10);
    return { romania, asia, europeUnder50, aiBest };
  }, [deals]);

  async function sendToApproval(deal: FlightDeal) {
    setBusy(deal.id);
    setMessage("Oferta este trimisă în Approval Center...");
    try {
      const response = await fetch("/api/deals/article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deal }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Oferta nu a putut fi trimisă.");
      setMessage("Oferta a fost adăugată în Approval Center. Poți genera articolul cu AI.");
    } catch (cause) {
      setMessage(`Eroare: ${cause instanceof Error ? cause.message : "Operațiunea a eșuat."}`);
    } finally {
      setBusy("");
    }
  }

  function DealRows({ items }: { items: FlightDeal[] }) {
    if (!loading && mode === "live" && items.length === 0) return <p>Nu există momentan oferte care îndeplinesc aceste condiții.</p>;
    return <div className="newsTable">{items.map((deal) => <article className="newsRow" key={deal.id}>
      <div className={`score ${deal.dealScore >= 80 ? "critical" : deal.dealScore >= 65 ? "high" : "medium"}`}><strong>{deal.dealScore}</strong><small>DEAL</small></div>
      <div className="newsMain"><div className="badges"><span>{deal.originCode} → {deal.destinationCode}</span><em>România {deal.relevanceRomania}/100</em>{deal.airlineName && <em>{deal.airlineName}</em>}</div><h3>{deal.title}</h3><p>Plecare: {formatDate(deal.departureDate)}{deal.returnDate ? ` · Retur: ${formatDate(deal.returnDate)}` : " · Doar dus"} · tarif din cache</p></div>
      <span className="status">{deal.price} {deal.currency}</span>
      <div className="actions"><a className="open" href={deal.bookingUrl} target="_blank" rel="nofollow sponsored noreferrer">Verifică prețul</a><button onClick={() => sendToApproval(deal)} disabled={busy === deal.id}>{busy === deal.id ? "Se trimite..." : "Transformă în articol"}</button></div>
    </article>)}</div>;
  }

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
        <Link href="/activity">≡ Activity Log</Link>
        <Link href="/settings">⚙ Settings</Link>
      </nav>
      <div className="system"><i></i><div><strong>Travelpayouts</strong><small>Mod: {mode}</small></div></div>
    </aside>

    <section className="content">
      <header className="topbar"><div><p className="eyebrow">TRAVELPAYOUTS FLIGHT DATA</p><h1>Travel Deals AI</h1><span>Oferte reale din cache, clasificate pentru publicul Travelistul și pregătite pentru transformare editorială.</span></div><button onClick={load} disabled={loading}>{loading ? "Se încarcă..." : "↻ Actualizează"}</button></header>
      <div className="notice"><strong>{mode === "live" ? "LIVE" : mode === "loading" ? "SE ÎNCARCĂ" : "NECONFIGURAT"}</strong><span>{mode === "live" ? "Tarifele sunt orientative. Prețul final trebuie reconfirmat înainte de publicare sau rezervare." : error || "Se conectează la Travelpayouts..."}</span></div>
      {message && <div className="notice"><strong>{message.startsWith("Eroare") ? "EROARE" : "REZULTAT"}</strong><span>{message} {!message.startsWith("Eroare") && <Link href="/approval">Deschide Approval Center →</Link>}</span></div>}

      <section className="stats">
        <article><small>Oferte găsite</small><strong>{deals.length}</strong><span>Travelpayouts / Aviasales</span></article>
        <article><small>Din România</small><strong>{sections.romania.length}</strong><span>cele mai mici tarife</span></article>
        <article><small>Spre Asia</small><strong>{sections.asia.length}</strong><span>destinații prioritare</span></article>
        <article><small>Europa sub 50 EUR</small><strong>{sections.europeUnder50.length}</strong><span>când sunt disponibile</span></article>
      </section>

      {mode !== "live" && !deals.length ? <section className="panel"><div className="sourceBox"><strong>Conexiunea Travelpayouts nu este activă.</strong><p>{error || "Adaugă tokenul API și Partner ID-ul în Vercel, apoi pornește un redeploy."}</p></div></section> : null}

      <section className="panel"><div className="panelTitle"><div><h2>🔥 Cele mai ieftine zboruri din România</h2><p>Plecări din aeroporturile românești, ordonate după preț.</p></div></div><DealRows items={sections.romania} /></section>
      <section className="panel"><div className="panelTitle"><div><h2>🌍 Cele mai bune oferte spre Asia</h2><p>Bangkok, Tokyo, Singapore, China, Vietnam, Bali și alte destinații asiatice.</p></div></div><DealRows items={sections.asia} /></section>
      <section className="panel"><div className="panelTitle"><div><h2>✈️ Europa sub 50 EUR</h2><p>Tarife foarte mici găsite recent pentru destinații europene.</p></div></div><DealRows items={sections.europeUnder50} /></section>
      <section className="panel"><div className="panelTitle"><div><h2>⭐ Ofertele AI</h2><p>Cele mai bune combinații între preț, relevanță pentru România și calitatea rutei.</p></div></div><DealRows items={sections.aiBest} /></section>
      <section className="panel"><div className="panelTitle"><div><h2>🔔 Transformă oferta într-un articol Travelistul</h2><p>Butonul „Transformă în articol” trimite oferta în Approval Center. De acolo generezi articolul cu AI, îl verifici și îl trimiți ca draft în WordPress.</p></div></div></section>
    </section>
  </main>;
}
