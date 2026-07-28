const news = [
  { level: "Breaking", score: 5, category: "Vize", source: "Autoritate oficială", title: "O nouă regulă de intrare pentru călătorii europeni intră în vigoare", time: "Acum 18 min", status: "Nouă" },
  { level: "Important", score: 4, category: "Companii aeriene", source: "Companie aeriană", title: "Este anunțată o nouă rută directă între Europa și Asia", time: "Acum 31 min", status: "În analiză" },
  { level: "Important", score: 4, category: "Aeroporturi", source: "Aeroport internațional", title: "Terminal nou și modificări importante pentru pasageri", time: "Acum 44 min", status: "Generată" },
  { level: "Medium", score: 3, category: "Taxe", source: "Ministerul Turismului", title: "Taxa turistică va fi actualizată pentru vizitatorii străini", time: "Acum 1 h", status: "Nouă" },
  { level: "Medium", score: 3, category: "Bagaje", source: "Operator aerian", title: "Compania modifică dimensiunile acceptate pentru bagajul de cabină", time: "Acum 2 h", status: "Aprobată" },
];

const stats = [
  ["Surse active", "1.155", "+12 luna aceasta"],
  ["Detectate azi", "47", "9 importante"],
  ["De aprobat", "14", "3 breaking"],
  ["Publicate", "8", "astăzi"],
];

export default function Dashboard() {
  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span>TN</span><div><strong>Travel News Center</strong><small>AI NEWSROOM</small></div></div>
        <nav>
          <a className="active">◫ Dashboard</a>
          <a>✦ News Inbox <b>14</b></a>
          <a>✓ Approval Center</a>
          <a>◎ Source Monitor</a>
          <a>↗ Published</a>
          <a>≡ Activity Log</a>
          <a>⚙ Settings</a>
        </nav>
        <div className="system"><i></i><div><strong>Sistem activ</strong><small>Următoarea scanare: 11:00</small></div></div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><p className="eyebrow">OFFICIAL TRAVEL INTELLIGENCE</p><h1>Travel News Center AI</h1><span>Detectează, verifică, generează și publică mai repede.</span></div>
          <button>↻ Rulează scanarea</button>
        </header>

        <div className="notice"><strong>MOD DEMO</strong><span>Conectarea surselor reale, OpenAI și WordPress va fi activată din Settings.</span></div>

        <section className="stats">
          {stats.map(([label, value, note]) => <article key={label}><small>{label}</small><strong>{value}</strong><span>{note}</span></article>)}
        </section>

        <section className="panel">
          <div className="panelTitle"><div><h2>Știri care necesită atenție</h2><p>Sortate automat după importanță și relevanță pentru călătorii români.</p></div><a>Vezi toate →</a></div>
          <div className="newsTable">
            {news.map((item) => (
              <article className="newsRow" key={item.title}>
                <div className={`score s${item.score}`}>{item.score}</div>
                <div className="newsMain"><div className="badges"><span>{item.level}</span><em>{item.category}</em></div><h3>{item.title}</h3><p>{item.source} · {item.time}</p></div>
                <span className="status">{item.status}</span>
                <button className="open">Deschide</button>
              </article>
            ))}
          </div>
        </section>

        <section className="lowerGrid">
          <article className="panel compact"><div className="panelTitle"><div><h2>Starea monitorizării</h2><p>Ultima verificare: acum 6 minute</p></div></div><div className="progress"><span><b style={{width:"96%"}}></b></span><div><strong>1.109</strong> surse verificate fără erori</div></div><div className="mini"><span>RSS/API <b>728</b></span><span>Web monitor <b>381</b></span><span>Cu erori <b>46</b></span></div></article>
          <article className="panel compact"><div className="panelTitle"><div><h2>Flux editorial</h2><p>Activitate în ultimele 24 de ore</p></div></div><div className="pipeline"><span>47<small>Detectate</small></span><i>→</i><span>22<small>Generate</small></span><i>→</i><span>11<small>Aprobate</small></span><i>→</i><span>8<small>Publicate</small></span></div></article>
        </section>
      </section>
    </main>
  );
}
