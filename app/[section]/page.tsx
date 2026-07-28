import Link from "next/link";

const sections: Record<string, { title: string; description: string; milestone: string }> = {
  radar: { title: "Travel Radar", description: "Semnale, rute noi, schimbări de viză, taxe, greve și alerte detectate automat.", milestone: "MILESTONE 4" },
  approval: { title: "Approval Center", description: "Aici vei verifica, aproba, edita sau respinge articolele generate de AI.", milestone: "MILESTONE 5" },
  published: { title: "Published", description: "Arhiva articolelor aprobate și publicate pe Travelistul.com.", milestone: "MILESTONE 6" },
  activity: { title: "Activity Log", description: "Istoricul scanărilor, erorilor, aprobărilor și publicărilor.", milestone: "SYSTEM LOG" },
  settings: { title: "Settings", description: "Configurarea surselor, OpenAI, WordPress, Travelpayouts și automatizărilor.", milestone: "CONFIGURATION" },
};

export default function SectionPage({ params }: { params: { section: string } }) {
  const section = sections[params.section] ?? { title: "Secțiune", description: "Această secțiune este în curs de configurare.", milestone: "TRAVEL NEWS CENTER" };

  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><span>TN</span><div><strong>Travel News Center</strong><small>AI NEWSROOM</small></div></div>
      <nav>
        <Link href="/">◫ Dashboard</Link>
        <Link href="/news">✦ News Inbox</Link>
        <Link href="/radar" className={params.section === "radar" ? "active" : ""}>⌁ Travel Radar</Link>
        <Link href="/approval" className={params.section === "approval" ? "active" : ""}>✓ Approval Center</Link>
        <Link href="/sources">◎ Source Monitor</Link>
        <Link href="/published" className={params.section === "published" ? "active" : ""}>↗ Published</Link>
        <Link href="/activity" className={params.section === "activity" ? "active" : ""}>≡ Activity Log</Link>
        <Link href="/settings" className={params.section === "settings" ? "active" : ""}>⚙ Settings</Link>
      </nav>
      <div className="system"><i></i><div><strong>Sistem activ</strong><small>Secțiune pregătită</small></div></div>
    </aside>
    <section className="content">
      <header className="topbar"><div><p className="eyebrow">{section.milestone}</p><h1>{section.title}</h1><span>{section.description}</span></div></header>
      <div className="notice"><strong>ACTIV</strong><span>Linkul funcționează. Funcțiile complete ale acestei secțiuni vor fi construite în etapa următoare.</span></div>
      <section className="panel"><div className="panelTitle"><div><h2>{section.title}</h2><p>{section.description}</p></div></div><p>Pagina este conectată la meniul principal și pregătită pentru dezvoltare.</p></section>
    </section>
  </main>;
}
