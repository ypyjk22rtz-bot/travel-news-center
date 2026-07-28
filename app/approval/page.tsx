"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type IntelligencePackage = {
  viralHeadlines?: Array<{ title: string; ctrScore: number }>;
  verdict?: string;
  verdictReason?: string;
  impactScore?: number;
  impactReasons?: string[];
  discoverScore?: number;
  estimatedCtr?: number;
  trendingScore?: number;
  summary30s?: string;
  summary2m?: string;
  duplicateAssessment?: string;
  duplicateCandidates?: Array<{ id: string; source_title: string; source_url: string; similarity: number }>;
  socialExtended?: { instagram?: string; threads?: string; linkedin?: string; youtubeCommunity?: string };
};

type ApprovalItem = {
  id: string;
  source_title: string;
  source_excerpt: string | null;
  source_url: string;
  category: string;
  status: string;
  importance: string;
  intelligence_score: number;
  discover_score: number;
  detected_at: string;
  generated: null | {
    seo_title: string;
    subtitle: string;
    article_html: string;
    meta_description: string;
    keywords: string[];
    tags: string[];
    excerpt: string;
    cta_html?: string;
  };
  social: null | { facebook: string; x_text: string; push_notification: string };
  publication: null | { status: string; wordpress_url: string | null; wordpress_post_id: number | null };
};

function parseIntelligence(value?: string): IntelligencePackage | null {
  if (!value) return null;
  const match = value.match(/<!--\s*tnc-intelligence:([A-Za-z0-9+/=]+)\s*-->/);
  if (!match) return null;
  try {
    const binary = window.atob(match[1]);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

function stars(value?: number) {
  const score = Math.max(1, Math.min(5, Math.round(value || 1)));
  return "★".repeat(score) + "☆".repeat(5 - score);
}

export default function ApprovalPage() {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [selected, setSelected] = useState<ApprovalItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [filter, setFilter] = useState("toate");

  async function load(selectedId?: string) {
    setLoading(true);
    try {
      const response = await fetch("/api/approval", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error || "Nu s-a putut încărca Approval Center.");
        return;
      }
      const nextItems: ApprovalItem[] = payload.items || [];
      setItems(nextItems);
      const idToRefresh = selectedId || selected?.id;
      if (idToRefresh) setSelected(nextItems.find((item) => item.id === idToRefresh) || null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nu s-a putut încărca Approval Center.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => items.filter((item) => filter === "toate" || item.status === filter), [items, filter]);
  const intelligence = selected?.generated ? parseIntelligence(selected.generated.cta_html) : null;

  async function generate(item: ApprovalItem) {
    setBusy(item.id);
    setModalMessage("Se generează analiza Intelligence, articolul, titlurile și pachetul social. Poate dura aproximativ un minut...");
    setMessage("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 120000);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newsItemId: item.id }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setModalMessage(`Eroare: ${payload.error || `Generarea a eșuat cu HTTP ${response.status}.`}`);
        return;
      }
      setModalMessage("Pachetul AI Travel Intelligence a fost generat cu succes.");
      await load(item.id);
    } catch (error) {
      const text = error instanceof DOMException && error.name === "AbortError"
        ? "Generarea a durat prea mult. Apasă din nou după câteva secunde."
        : error instanceof Error ? error.message : "Generarea a eșuat.";
      setModalMessage(`Eroare: ${text}`);
    } finally {
      window.clearTimeout(timeout);
      setBusy("");
    }
  }

  async function changeStatus(item: ApprovalItem, status: string) {
    setBusy(item.id);
    setModalMessage("Se actualizează statusul...");
    try {
      const response = await fetch("/api/approval", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newsItemId: item.id, status }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return setModalMessage(`Eroare: ${payload.error || "Statusul nu a putut fi schimbat."}`);
      setModalMessage(status === "approved" ? "Articol aprobat." : "Știre respinsă.");
      await load(item.id);
    } finally {
      setBusy("");
    }
  }

  async function sendDraft(item: ApprovalItem) {
    setBusy(item.id);
    setModalMessage("Se generează featured image și se creează draftul în WordPress...");
    try {
      const response = await fetch("/api/wordpress/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newsItemId: item.id }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return setModalMessage(`Eroare: ${payload.error || "Draftul WordPress nu a putut fi creat."}`);
      setModalMessage("Draft WordPress creat cu succes.");
      await load(item.id);
      if (payload.post?.editLink) window.open(payload.post.editLink, "_blank", "noopener,noreferrer");
    } finally {
      setBusy("");
    }
  }

  function openItem(item: ApprovalItem) {
    setModalMessage("");
    setSelected(item);
  }

  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><span>TN</span><div><strong>Travel News Center</strong><small>AI NEWSROOM</small></div></div>
      <nav>
        <Link href="/">◫ Dashboard</Link><Link href="/news">✦ News Inbox</Link><Link href="/radar">⌁ Travel Radar</Link>
        <Link href="/approval" className="active">✓ Approval Center</Link><Link href="/deals">€ Travel Deals</Link><Link href="/sources">◎ Source Monitor</Link>
        <Link href="/published">↗ Published</Link><Link href="/activity">≡ Activity Log</Link><Link href="/settings">⚙ Settings</Link>
      </nav>
      <div className="system"><i></i><div><strong>Control uman activ</strong><small>Publicarea live este oprită</small></div></div>
    </aside>

    <section className="content">
      <header className="topbar"><div><p className="eyebrow">MILESTONE 6</p><h1>AI Travel Intelligence</h1><span>Verdict, impact, Discover, titluri virale, duplicate și pachet editorial complet.</span></div><button onClick={() => load()} disabled={loading}>{loading ? "Se încarcă..." : "↻ Reîncarcă"}</button></header>
      <div className="notice"><strong>DRAFT ONLY</strong><span>Nicio știre nu este publicată automat. Decizia finală rămâne la tine.</span></div>
      {message && <section className="panel"><p>{message}</p></section>}

      <section className="stats">
        <article><small>Total</small><strong>{items.length}</strong><span>știri editoriale</span></article>
        <article><small>Negenerate</small><strong>{items.filter((i) => !i.generated).length}</strong><span>așteaptă AI</span></article>
        <article><small>Generate</small><strong>{items.filter((i) => i.generated).length}</strong><span>pachete Intelligence</span></article>
        <article><small>Draft WordPress</small><strong>{items.filter((i) => i.status === "wordpress_draft").length}</strong><span>trimise pe site</span></article>
      </section>

      <section className="panel">
        <div className="panelTitle"><div><h2>Coada editorială</h2><p>Deschide o știre pentru verdict și acțiuni.</p></div><div className="filters">{["toate", "new", "generated", "approved", "wordpress_draft"].map((value) => <button key={value} className={filter === value ? "selected" : ""} onClick={() => setFilter(value)}>{value}</button>)}</div></div>
        <div className="newsTable">
          {visible.map((item) => <article className="newsRow" key={item.id}>
            <div className={`score ${item.intelligence_score >= 80 ? "high" : "medium"}`}><strong>{item.intelligence_score}</strong><small>IMPACT</small></div>
            <div className="newsMain"><div className="badges"><span>{item.importance}</span><em>{item.category}</em><em>{item.status}</em></div><h3>{item.generated?.seo_title || item.source_title}</h3><p>Discover {item.discover_score}/100 · detectată {new Date(item.detected_at).toLocaleString("ro-RO")}</p></div>
            <button className="open" onClick={() => openItem(item)}>Deschide</button>
          </article>)}
          {!loading && visible.length === 0 && <p>Nu există articole în această categorie.</p>}
        </div>
      </section>
    </section>

    {selected && <div className="modalBackdrop" onClick={() => busy ? undefined : setSelected(null)}><section className="modal" onClick={(event) => event.stopPropagation()}>
      <button className="close" onClick={() => busy ? undefined : setSelected(null)}>×</button>
      <p className="eyebrow">{selected.status.toUpperCase()}</p><h2>{selected.generated?.seo_title || selected.source_title}</h2>
      <div className="modalMeta"><span>{selected.category}</span><span>Impact {intelligence?.impactScore ?? selected.intelligence_score}/100</span><span>Discover {intelligence?.discoverScore ?? selected.discover_score}/100</span></div>

      {intelligence?.verdict && <div className="notice"><strong>{intelligence.verdict}</strong><span>{intelligence.verdictReason}</span></div>}
      <div className="sourceBox"><strong>Sursa oficială</strong><p>{selected.source_excerpt || "Fără rezumat disponibil."}</p><a href={selected.source_url} target="_blank" rel="noreferrer">Deschide sursa oficială ↗</a></div>
      {modalMessage && <div className="notice"><strong>{modalMessage.startsWith("Eroare") ? "EROARE" : busy ? "ÎN LUCRU" : "REZULTAT"}</strong><span>{modalMessage}</span></div>}

      {selected.generated ? <>
        {intelligence && <>
          <div className="stats">
            <article><small>Impact AI</small><strong>{intelligence.impactScore ?? selected.intelligence_score}</strong><span>din 100</span></article>
            <article><small>Discover</small><strong>{intelligence.discoverScore ?? selected.discover_score}</strong><span>din 100</span></article>
            <article><small>CTR estimat</small><strong>{intelligence.estimatedCtr ?? "—"}%</strong><span>estimare editorială</span></article>
            <article><small>Trending</small><strong>{stars(intelligence.trendingScore)}</strong><span>potențial social</span></article>
          </div>
          <div className="sourceBox"><strong>De ce contează</strong><p>{(intelligence.impactReasons || []).join(" • ") || "Fără motive suplimentare."}</p></div>
          <div className="sourceBox"><strong>Rezumat în 30 de secunde</strong><p>{intelligence.summary30s || "—"}</p><strong>Rezumat în 2 minute</strong><p>{intelligence.summary2m || "—"}</p></div>
          <div className="sourceBox"><strong>Detectare duplicate</strong><p>{intelligence.duplicateAssessment || "Nu există evaluare."}</p>{(intelligence.duplicateCandidates || []).map((candidate) => <p key={candidate.id}><a href={candidate.source_url} target="_blank" rel="noreferrer">{candidate.source_title}</a> — {Math.round(candidate.similarity * 100)}% similar</p>)}</div>
          <div className="sourceBox"><strong>10 titluri virale ordonate după CTR</strong>{(intelligence.viralHeadlines || []).map((headline, index) => <p key={`${headline.title}-${index}`}><b>{index + 1}. [{headline.ctrScore}/100]</b> {headline.title}</p>)}</div>
        </>}
        <label>Titlu SEO<input value={selected.generated.seo_title || ""} readOnly /></label>
        <label>Meta description<textarea value={selected.generated.meta_description || ""} readOnly /></label>
        <label>Articol generat<textarea value={(selected.generated.article_html || "").replace(/<[^>]+>/g, " ")} readOnly style={{ minHeight: 240 }} /></label>
        <div className="sourceBox"><strong>Facebook</strong><p>{selected.social?.facebook || "—"}</p><strong>Instagram</strong><p>{intelligence?.socialExtended?.instagram || "—"}</p><strong>Threads</strong><p>{intelligence?.socialExtended?.threads || "—"}</p><strong>X</strong><p>{selected.social?.x_text || "—"}</p><strong>LinkedIn</strong><p>{intelligence?.socialExtended?.linkedin || "—"}</p><strong>YouTube Community</strong><p>{intelligence?.socialExtended?.youtubeCommunity || "—"}</p><strong>Push</strong><p>{selected.social?.push_notification || "—"}</p></div>
      </> : <div className="sourceBox"><strong>Conținut negenerat</strong><p>Apasă „Generează AI Intelligence” pentru analiza completă.</p></div>}

      <div className="actions">
        {!selected.generated && <button onClick={() => generate(selected)} disabled={busy === selected.id}>{busy === selected.id ? "Se generează..." : "Generează AI Intelligence"}</button>}
        {selected.generated && <button onClick={() => generate(selected)} disabled={busy === selected.id}>{busy === selected.id ? "Se regenerează..." : "Regenerează analiza"}</button>}
        {selected.generated && selected.status !== "approved" && <button onClick={() => changeStatus(selected, "approved")} disabled={busy === selected.id}>{busy === selected.id ? "Se procesează..." : "Aprobă"}</button>}
        {selected.generated && <button className="primary" onClick={() => sendDraft(selected)} disabled={busy === selected.id}>{busy === selected.id ? "Se trimite..." : "Trimite draft în WordPress"}</button>}
        {selected.publication?.wordpress_url && <a href={selected.publication.wordpress_url} target="_blank" rel="noreferrer">Deschide draftul ↗</a>}
        <button className="danger" onClick={() => changeStatus(selected, "rejected")} disabled={busy === selected.id}>{busy === selected.id ? "Așteaptă..." : "Respinge"}</button>
      </div>
    </section></div>}
  </main>;
}
