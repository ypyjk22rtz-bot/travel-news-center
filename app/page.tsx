"use client";

import { useMemo, useState } from "react";

type NewsItem = {
  id: number;
  level: "Breaking" | "Important" | "Medium" | "Low";
  score: number;
  discover: number;
  category: string;
  source: string;
  title: string;
  time: string;
  status: string;
  country: string;
  impact: string;
};

const initialNews: NewsItem[] = [
  { id: 1, level: "Breaking", score: 96, discover: 94, category: "Vize", source: "Autoritate oficială", title: "O nouă regulă de intrare pentru călătorii europeni intră în vigoare", time: "Acum 18 min", status: "Nouă", country: "Asia", impact: "Afectează direct călătorii români" },
  { id: 2, level: "Important", score: 88, discover: 91, category: "Rute noi", source: "Companie aeriană", title: "Este anunțată o nouă rută directă între Europa și Asia", time: "Acum 31 min", status: "În analiză", country: "Europa / Asia", impact: "Potențial ridicat de trafic și căutări" },
  { id: 3, level: "Important", score: 82, discover: 77, category: "Aeroporturi", source: "Aeroport internațional", title: "Terminal nou și modificări importante pentru pasageri", time: "Acum 44 min", status: "Generată", country: "Europa", impact: "Schimbări operaționale pentru pasageri" },
  { id: 4, level: "Medium", score: 69, discover: 73, category: "Taxe", source: "Ministerul Turismului", title: "Taxa turistică va fi actualizată pentru vizitatorii străini", time: "Acum 1 h", status: "Nouă", country: "Europa", impact: "Crește costul total al vacanței" },
  { id: 5, level: "Medium", score: 61, discover: 66, category: "Bagaje", source: "Operator aerian", title: "Compania modifică dimensiunile acceptate pentru bagajul de cabină", time: "Acum 2 h", status: "Aprobată", country: "Global", impact: "Relevant pentru zborurile low-cost" },
];

const radar = [
  ["Rute noi", "12", "+4 față de ieri"],
  ["Schimbări de viză", "6", "2 urgente"],
  ["Taxe noi", "4", "3 destinații"],
  ["Greve & perturbări", "9", "1 critică"],
  ["Promoții", "18", "7 relevante"],
  ["Alerte de siguranță", "3", "verificare necesară"],
];

export default function Dashboard() {
  const [items, setItems] = useState(initialNews);
  const [selected, setSelected] = useState<NewsItem | null>(null);
  const [scanning, setScanning] = useState(false);
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState("Toate");

  const visible = useMemo(() => filter === "Toate" ? items : items.filter((item) => item.category === filter), [filter, items]);
  const categories = ["Toate", ...Array.from(new Set(items.map((item) => item.category)))];

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  function runScan() {
    setScanning(true);
    window.setTimeout(() => {
      setItems((current) => [{ id: Date.now(), level: "Important", score: 84, discover: 86, category: "Promoții", source: "Sursă oficială demo", title: "Ofertă nouă detectată automat de Travel Radar", time: "Acum", status: "Nouă", country: "Global", impact: "Necesită verificarea sursei oficiale" }, ...current]);
      setScanning(false);
      notify("Scanarea demo s-a încheiat: 1 știre nouă detectată.");
    }, 1200);
  }

  function changeStatus(id: number, status: string) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, status } : item));
    setSelected((current) => current?.id === id ? { ...current, status } : current);
    notify(status === "Draft WordPress" ? "Articol trimis ca draft demo către Travelistul.com." : `Status schimbat în „${status}”.`);
  }

  return (
    <main className="shell">
      {toast && <div className="toast">{toast}</div>}
      <aside className="sidebar">
        <div className="brand"><span>TN</span><div><strong>Travel News Center</strong><small>AI NEWSROOM</small></div></div>
        <nav>
          <a className="active">◫ Dashboard</a>
          <a>✦ News Inbox <b>{items.filter((item) => item.status === "Nouă").length}</b></a>
          <a>⌁ Travel Radar</a>
          <a>✓ Approval Center</a>
          <a>◎ Source Monitor</a>
          <a>↗ Published</a>
          <a>≡ Activity Log</a>
          <a>⚙ Settings</a>
        </nav>
        <div className="system"><i></i><div><strong>Sistem activ</strong><small>Scanare automată: la fiecare oră</small></div></div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><p className="eyebrow">OFFICIAL TRAVEL INTELLIGENCE</p><h1>Travel News Center AI</h1><span>Detectează, evaluează și pregătește știrile pentru Travelistul.com.</span></div>
          <button onClick={runScan} disabled={scanning}>{scanning ? "Se scanează..." : "↻ Rulează scanarea demo"}</button>
        </header>

        <div className="notice"><strong>MOD MVP</strong><span>Datele sunt demonstrative. Publicarea reală va fi activată numai după configurarea OpenAI, Supabase și WordPress.</span></div>

        <section className="stats">
          <article><small>Surse planificate</small><strong>1.155</strong><span>500 companii · 505 aeroporturi</span></article>
          <article><small>Detectate azi</small><strong>{items.length + 42}</strong><span>{items.filter((item) => item.score >= 80).length} cu impact ridicat</span></article>
          <article><small>De aprobat</small><strong>{items.filter((item) => !["Publicată", "Respinsă"].includes(item.status)).length}</strong><span>control uman obligatoriu</span></article>
          <article><small>Publicate</small><strong>8</strong><span>astăzi pe Travelistul.com</span></article>
        </section>

        <section className="radarPanel">
          <div className="panelTitle"><div><h2>Travel Radar</h2><p>Semnale importante detectate în industria călătoriilor.</p></div><span className="live"><i></i> LIVE</span></div>
          <div className="radarGrid">{radar.map(([label, value, note]) => <article key={label}><small>{label}</small><strong>{value}</strong><span>{note}</span></article>)}</div>
        </section>

        <section className="panel">
          <div className="panelTitle"><div><h2>Știri care necesită atenție</h2><p>Sortate după Travel Intelligence Score și potențial Google Discover.</p></div><div className="filters">{categories.map((category) => <button key={category} className={filter === category ? "selected" : ""} onClick={() => setFilter(category)}>{category}</button>)}</div></div>
          <div className="newsTable">
            {visible.map((item) => (
              <article className="newsRow" key={item.id}>
                <div className={`score ${item.score >= 90 ? "critical" : item.score >= 80 ? "high" : "medium"}`}><strong>{item.score}</strong><small>INTEL</small></div>
                <div className="newsMain"><div className="badges"><span>{item.level}</span><em>{item.category}</em><em>{item.country}</em></div><h3>{item.title}</h3><p>{item.source} · {item.time} · Discover {item.discover}/100</p></div>
                <span className="status">{item.status}</span>
                <button className="open" onClick={() => setSelected(item)}>Deschide</button>
              </article>
            ))}
          </div>
        </section>

        <section className="lowerGrid">
          <article className="panel compact"><div className="panelTitle"><div><h2>Starea monitorizării</h2><p>Arhitectura pregătită pentru verificare orară</p></div></div><div className="progress"><span><b style={{width:"96%"}}></b></span><div><strong>1.109</strong> surse fără erori</div></div><div className="mini"><span>RSS/API <b>728</b></span><span>Web monitor <b>381</b></span><span>Cu erori <b>46</b></span></div></article>
          <article className="panel compact"><div className="panelTitle"><div><h2>Flux editorial</h2><p>Publicarea automată rămâne dezactivată</p></div></div><div className="pipeline"><span>47<small>Detectate</small></span><i>→</i><span>22<small>Generate</small></span><i>→</i><span>11<small>Aprobate</small></span><i>→</i><span>8<small>Publicate</small></span></div></article>
        </section>
      </section>

      {selected && <div className="modalBackdrop" onClick={() => setSelected(null)}><section className="modal" onClick={(event) => event.stopPropagation()}>
        <button className="close" onClick={() => setSelected(null)}>×</button>
        <p className="eyebrow">APPROVAL CENTER</p><h2>{selected.title}</h2>
        <div className="modalMeta"><span>{selected.source}</span><span>{selected.category}</span><span>{selected.country}</span></div>
        <div className="scoreCards"><article><small>Travel Intelligence</small><strong>{selected.score}/100</strong></article><article><small>Discover Score</small><strong>{selected.discover}/100</strong></article><article><small>Status</small><strong>{selected.status}</strong></article></div>
        <div className="sourceBox"><strong>Evaluare AI</strong><p>{selected.impact}. Verifică sursa oficială înainte de aprobare. Sistemul nu va publica automat.</p></div>
        <label>Titlu SEO<input defaultValue={selected.title} /></label>
        <label>Rezumat editorial<textarea defaultValue={`Această știre a fost detectată și clasificată automat. Următorul pas este verificarea informației în sursa oficială, apoi generarea articolului complet de 500–700 de cuvinte.`} /></label>
        <div className="actions"><button onClick={() => changeStatus(selected.id, "Generată")}>Generează articol demo</button><button onClick={() => changeStatus(selected.id, "Aprobată")}>Aprobă</button><button className="primary" onClick={() => changeStatus(selected.id, "Draft WordPress")}>Trimite draft pe Travelistul.com</button><button className="danger" onClick={() => changeStatus(selected.id, "Respinsă")}>Respinge</button></div>
      </section></div>}
    </main>
  );
}
