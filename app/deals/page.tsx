"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { FlightDeal } from "@/lib/deal-engine";

const ROMANIA_ORIGINS = new Set(["BUH", "OTP", "BBU", "IAS", "CLJ", "TSR", "SBZ", "CRA", "BCM", "SCV"]);
const ASIA_DESTINATIONS = new Set(["BKK", "HKT", "SIN", "KUL", "HKG", "NRT", "HND", "KIX", "ICN", "PEK", "PKX", "PVG", "CAN", "SZX", "DPS", "SGN", "HAN", "DAD", "MNL", "CEB", "DEL", "BOM", "CMB"]);
const EUROPE_DESTINATIONS = new Set(["LON", "LGW", "LTN", "STN", "LHR", "FCO", "CIA", "MXP", "BGY", "VCE", "BCN", "MAD", "VLC", "PAR", "CDG", "ORY", "BVA", "BER", "MUC", "FRA", "VIE", "BUD", "PRG", "WAW", "KRK", "ATH", "SKG", "SOF", "IST", "SAW", "LIS", "OPO", "BRU", "CRL", "AMS", "CPH", "ARN", "OSL", "DUB"]);

type DealsDiagnostics = {
  configured: boolean;
  connection: string;
  fetchedAt: string;
  originsChecked: number;
  dealsCount: number;
};

function formatDate(value?: string) {
  if (!value) return "dată flexibilă";
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ro-RO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
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

function qualityLabel(value?: FlightDeal["priceQuality"]) {
  return ({ exceptional: "EXCEPȚIONAL", very_good: "FOARTE BUN", good: "BUN", normal: "NORMAL", weak: "SLAB" } as Record<string, string>)[value || ""] || "NEEVALUAT";
}

export default function DealsPage() {
  const [deals, setDeals] = useState<FlightDeal[]>([]);
  const [mode, setMode] = useState("loading");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [diagnostics, setDiagnostics] = useState<DealsDiagnostics>({ configured: false, connection: "pending", fetchedAt: "", originsChecked: 0, dealsCount: 0 });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/deals", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      setDeals(payload.deals ?? []);
      setMode(payload.mode ?? (response.ok ? "live" : "error"));
      setError(payload.error ?? "");
      setDiagnostics({
        configured: Boolean(payload.configured),
        connection: String(payload.connection ?? (response.ok ? "active" : "failed")),
        fetchedAt: String(payload.fetchedAt ?? ""),
        originsChecked: Number(payload.originsChecked ?? 0),
        dealsCount: Number(payload.dealsCount ?? payload.deals?.length ?? 0),
      });
    } catch (cause) {
      setMode("error");
      setError(cause instanceof Error ? cause.message : "Nu s-au putut încărca tarifele.");
      setDiagnostics((current) => ({ ...current, connection: "failed" }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const sections = useMemo(() => {
    const byPrice = [...deals].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    const romania = uniqueDeals(byPrice.filter((deal) => ROMANIA_ORIGINS.has(deal.originCode || "")), 10);
    const asia = uniqueDeals([...deals].filter((deal) => ASIA_DESTINATIONS.has(deal.destinationCode || "")).sort((a, b) => b.dealScore - a.dealScore), 10);
    const europeUnder50 = uniqueDeals(byPrice.filter((deal) => EUROPE_DESTINATIONS.has(deal.destinationCode || "") && Boolean(deal.price && deal.price <= 50)), 10);
    const aiBest = uniqueDeals([...deals].sort((a, b) => b.dealScore - a.dealScore || (b.savingsPercent || 0) - (a.savingsPercent || 0)), 10);
    const publishNow = deals.filter((deal) => deal.editorialVerdict === "PUBLICĂ ACUM").length;
    return { romania, asia, europeUnder50, aiBest, publishNow };
  }, [deals]);

  async function sendToApproval(deal: FlightDeal) {
    setBusy(deal.id);
    setMessage("Oferta este trimisă în Approval Center...");
    try {
      const response = await fetch("/api/deals/article", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deal }) });
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
      <div className={`score ${deal.dealScore >= 85 ? "critical" : deal.dealScore >= 70 ? "high" : "medium"}`}><strong>{deal.dealScore}</strong><small>DEAL</small></div>
      <div className="newsMain">
        <div className="badges"><span>{deal.originCode} → {deal.destinationCode}</span><em>{qualityLabel(deal.priceQuality)}</em><em>RO {deal.relevanceRomania}/100</em>{deal.discoverPotential !== undefined && <em>DISC {deal.discoverPotential}</em>}</div>
        <h3>{deal.title}</h3>
        <p>Plecare: {formatDate(deal.departureDate)}{deal.returnDate ? ` · Retur: ${formatDate(deal.returnDate)}` : " · Doar dus"} · tarif din cache</p>
        <p><b>Benchmark curent:</b> {deal.benchmarkPrice ?? deal.price} {deal.currency}{deal.savingsPercent ? ` · aproximativ ${deal.savingsPercent}% mai jos` : " · fără diferență relevantă"}</p>
        {deal.editorialReasons?.length ? <p>{deal.editorialReasons.join(" · ")}</p> : null}
      </div>
      <span className="status">{deal.editorialVerdict || `${deal.price} ${deal.currency}`}</span>
      <div className="actions"><a className="open" href={deal.bookingUrl} target="_blank" rel="nofollow sponsored noreferrer">Verifică prețul</a><button onClick={() => sendToApproval(deal)} disabled={busy === deal.id}>{busy === deal.id ? "Se trimite..." : "Transformă în articol"}</button></div>
    </article>)}</div>;
  }

  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><span>TN</span><div><strong>Travel News Center</strong><small>AI NEWSROOM</small></div></div>
      <nav><Link href="/">◫ Dashboard</Link><Link href="/news">✦ News Inbox</Link><Link href="/radar">⌁ Travel Radar</Link><Link href="/opportunities">🏆 Opportunity Radar</Link><Link href="/approval">✓ Approval Center</Link><Link href="/deals" className="active">€ Travel Deals</Link><Link href="/sources">◎ Source Monitor</Link><Link href="/published">↗ Published</Link><Link href="/activity">≡ Activity Log</Link><Link href="/settings">⚙ Settings</Link></nav>
      <div className="system"><i></i><div><strong>Flight Intelligence</strong><small>Mod: {mode}</small></div></div>
    </aside>

    <section className="content">
      <header className="topbar"><div><p className="eyebrow">FLIGHT INTELLIGENCE ENGINE</p><h1>Travel Deals AI 2.0</h1><span>Tarife Travelpayouts evaluate după benchmark, economisire estimată, România și potențial editorial.</span></div><button onClick={load} disabled={loading}>{loading ? "Se încarcă..." : "↻ Actualizează"}</button></header>
      <div className="notice"><strong>{mode === "live" ? "LIVE" : mode === "loading" ? "SE ÎNCARCĂ" : "EROARE"}</strong><span>{mode === "live" ? "Travelpayouts este conectat. Prețurile sunt din cache și trebuie reconfirmate înainte de publicare." : error || "Se conectează la Travelpayouts..."}</span></div>
      {message && <div className="notice"><strong>{message.startsWith("Eroare") ? "EROARE" : "REZULTAT"}</strong><span>{message} {!message.startsWith("Eroare") && <Link href="/approval">Deschide Approval Center →</Link>}</span></div>}

      <section className="stats">
        <article><small>Conexiune API</small><strong>{diagnostics.connection === "active" ? "ACTIVĂ" : diagnostics.connection === "pending" ? "…" : "EROARE"}</strong><span>{diagnostics.configured ? "token și marker detectate" : "configurare incompletă"}</span></article>
        <article><small>Aeroporturi cu rezultate</small><strong>{diagnostics.originsChecked}</strong><span>în răspunsul curent</span></article>
        <article><small>Oferte primite</small><strong>{diagnostics.dealsCount}</strong><span>Travelpayouts / Aviasales</span></article>
        <article><small>Ultima actualizare</small><strong>{diagnostics.fetchedAt ? formatDateTime(diagnostics.fetchedAt) : "—"}</strong><span>ora serverului</span></article>
      </section>

      <section className="stats">
        <article><small>Publică acum</small><strong>{sections.publishNow}</strong><span>scor și economie ridicate</span></article>
        <article><small>Din România</small><strong>{sections.romania.length}</strong><span>plecări prioritare</span></article>
        <article><small>Spre Asia</small><strong>{sections.asia.length}</strong><span>ordonate după Deal Score</span></article>
        <article><small>Total analizate</small><strong>{deals.length}</strong><span>după deduplicare</span></article>
      </section>

      {mode !== "live" && !deals.length ? <section className="panel"><div className="sourceBox"><strong>Conexiunea Travelpayouts nu este activă.</strong><p>{error || "Verifică tokenul și markerul din Vercel, apoi pornește un redeploy."}</p></div></section> : null}

      <section className="panel"><div className="panelTitle"><div><h2>🔥 Cele mai ieftine zboruri din România</h2><p>Plecări din aeroporturile românești, evaluate și după benchmarkul curent.</p></div></div><DealRows items={sections.romania} /></section>
      <section className="panel"><div className="panelTitle"><div><h2>🌍 Cele mai bune oferte spre Asia</h2><p>Oferte spre Asia ordonate după valoare editorială, nu doar după preț.</p></div></div><DealRows items={sections.asia} /></section>
      <section className="panel"><div className="panelTitle"><div><h2>✈️ Europa sub 50 EUR</h2><p>Tarife foarte mici găsite recent pentru destinații europene.</p></div></div><DealRows items={sections.europeUnder50} /></section>
      <section className="panel"><div className="panelTitle"><div><h2>⭐ Flight Intelligence Picks</h2><p>Cele mai bune combinații între preț, benchmark, România, Discover și calitatea rutei.</p></div></div><DealRows items={sections.aiBest} /></section>
    </section>
  </main>;
}
