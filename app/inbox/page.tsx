"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type InboxItem = {
  id: string;
  title: string;
  source: string;
  country: string;
  category: string;
  urgency: string;
  romaniaImpact: number;
  discoverScore: number;
  trustScore: number;
  totalScore: number;
  duplicateCount: number;
  sourceGroup: string[];
  reasons: string[];
};

export default function InboxPage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<InboxItem | null>(null);
  const [filter, setFilter] = useState("toate");

  useEffect(() => {
    fetch("/api/intelligence")
      .then((response) => response.json())
      .then((payload) => setItems(payload.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => ["toate", ...Array.from(new Set(items.map((item) => item.category)))], [items]);
  const visible = filter === "toate" ? items : items.filter((item) => item.category === filter);

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span>TN</span><div><strong>Travel News Center</strong><small>AI NEWSROOM</small></div></div>
        <nav>
          <Link href="/">◫ Dashboard</Link>
          <Link href="/inbox" className="active">✦ News Inbox <b>{items.length}</b></Link>
          <a>⌁ Travel Radar</a>
          <a>✓ Approval Center</a>
          <Link href="/sources">◎ Source Monitor</Link>
          <a>↗ Published</a>
          <a>≡ Activity Log</a>
          <a>⚙ Settings</a>
        </nav>
        <div className="system"><i></i><div><strong>Intelligence Engine</strong><small>Scoring și deduplicare active</small></div></div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><p className="eyebrow">MILESTONE 3</p><h1>News Inbox</h1><span>Știrile sunt ordonate după relevanța pentru români și potențialul editorial.</span></div>
        </header>

        <section className="stats">
          <article><small>Semnale unice</small><strong>{items.length}</strong><span>după eliminarea duplicatelor</span></article>
          <article><small>Impact România ridicat</small><strong>{items.filter((item) => item.romaniaImpact >= 70).length}</strong><span>scor peste 70</span></article>
          <article><small>Discover ridicat</small><strong>{items.filter((item) => item.discoverScore >= 75).length}</strong><span>potențial editorial bun</span></article>
          <article><small>Breaking/Important</small><strong>{items.filter((item) => ["breaking", "important"].includes(item.urgency)).length}</strong><span>necesită verificare rapidă</span></article>
        </section>

        <section className="panel">
          <div className="panelTitle"><div><h2>Semnale prioritizate</h2><p>Scorul total combină impactul pentru România, Discover și încrederea sursei.</p></div><div className="filters">{categories.map((item) => <button key={item} className={filter === item ? "selected" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div></div>
          {loading ? <p>Se calculează scorurile...</p> : <div className="newsTable">{visible.map((item) => <article className="newsRow" key={item.id}>
            <div className={`score ${item.totalScore >= 88 ? "critical" : item.totalScore >= 74 ? "high" : "medium"}`}><strong>{item.totalScore}</strong><small>INTEL</small></div>
            <div className="newsMain"><div className="badges"><span>{item.urgency}</span><em>{item.category}</em><em>{item.country}</em>{item.duplicateCount > 0 && <em>+{item.duplicateCount} duplicate</em>}</div><h3>{item.title}</h3><p>{item.source} · România {item.romaniaImpact}/100 · Discover {item.discoverScore}/100 · Trust {item.trustScore}/100</p></div>
            <span className="status">De analizat</span>
            <button className="open" onClick={() => setSelected(item)}>Analizează</button>
          </article>)}</div>}
        </section>
      </section>

      {selected && <div className="modalBackdrop" onClick={() => setSelected(null)}><section className="modal" onClick={(event) => event.stopPropagation()}>
        <button className="close" onClick={() => setSelected(null)}>×</button>
        <p className="eyebrow">TRAVEL INTELLIGENCE REPORT</p><h2>{selected.title}</h2>
        <div className="scoreCards"><article><small>Scor total</small><strong>{selected.totalScore}/100</strong></article><article><small>Impact România</small><strong>{selected.romaniaImpact}/100</strong></article><article><small>Discover</small><strong>{selected.discoverScore}/100</strong></article></div>
        <div className="sourceBox"><strong>De ce a primit acest scor</strong>{selected.reasons.map((reason) => <p key={reason}>• {reason}</p>)}</div>
        {selected.sourceGroup.length > 1 && <div className="sourceBox"><strong>Surse grupate</strong><p>{selected.sourceGroup.join(" · ")}</p></div>}
        <div className="actions"><button>Verifică sursa</button><button>Generează articol</button><button className="primary">Trimite în Approval Center</button><button className="danger">Respinge</button></div>
      </section></div>}
    </main>
  );
}
