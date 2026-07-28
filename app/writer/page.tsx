"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { EditorialPackage } from "@/lib/ai-writer";
import type { IntelligenceResult } from "@/lib/intelligence-engine";

const sample: IntelligenceResult = {
  id: "writer-demo",
  title: "O nouă regulă de intrare pentru călătorii europeni intră în vigoare",
  summary: "Autoritatea a publicat o actualizare privind condițiile de intrare, documentele necesare și data aplicării noilor cerințe.",
  source: "Autoritate oficială",
  sourceKind: "authority",
  country: "Asia",
  url: "https://example.com/official-source",
  publishedAt: new Date().toISOString(),
  category: "Vize",
  urgency: "breaking",
  romaniaImpact: 90,
  discoverScore: 94,
  trustScore: 98,
  totalScore: 94,
  duplicateKey: "regula-intrare-calatori-europeni",
  reasons: ["Afectează călătorii europeni, inclusiv românii.", "Categoria Vize are utilitate practică ridicată.", "Sursa este oficială."],
};

type WordPressState = {
  configured: boolean;
  connected: boolean;
  livePublishing: boolean;
  defaultStatus?: string;
  message?: string;
  user?: { name: string };
};

export default function WriterPage() {
  const [editorial, setEditorial] = useState<EditorialPackage | null>(null);
  const [mode, setMode] = useState("");
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [activeTab, setActiveTab] = useState<"article" | "seo" | "social">("article");
  const [wordpress, setWordpress] = useState<WordPressState | null>(null);
  const [notice, setNotice] = useState("");
  const [draftLink, setDraftLink] = useState("");

  useEffect(() => {
    fetch("/api/wordpress/status")
      .then(async (response) => ({ ok: response.ok, data: await response.json() }))
      .then(({ data }) => setWordpress(data))
      .catch(() => setWordpress({ configured: false, connected: false, livePublishing: false, message: "Status indisponibil." }));
  }, []);

  async function generate() {
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch("/api/writer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: sample }),
      });
      const payload = await response.json();
      setEditorial(payload.editorial ?? null);
      setMode(payload.mode ?? "template");
    } finally {
      setLoading(false);
    }
  }

  async function sendDraft() {
    if (!editorial) return;
    setPublishing(true);
    setNotice("");
    setDraftLink("");
    try {
      const response = await fetch("/api/wordpress/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editorial, status: "draft" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Draftul nu a putut fi creat.");
      setNotice(`Draft creat în Travelistul.com, ID ${payload.post.id}.`);
      setDraftLink(payload.post.editLink || payload.post.link || "");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Eroare la trimiterea draftului.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span>TN</span><div><strong>Travel News Center</strong><small>AI NEWSROOM</small></div></div>
        <nav>
          <Link href="/">◫ Dashboard</Link>
          <Link href="/inbox">✦ News Inbox</Link>
          <a>⌁ Travel Radar</a>
          <a>✓ Approval Center</a>
          <Link href="/sources">◎ Source Monitor</Link>
          <Link href="/writer" className="active">✎ AI Writer</Link>
          <a>↗ Published</a>
          <a>⚙ Settings</a>
        </nav>
        <div className="system"><i></i><div><strong>Writer pregătit</strong><small>Publicare live blocată</small></div></div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><p className="eyebrow">MILESTONE 5</p><h1>AI Writer & WordPress</h1><span>Generează, verifică și trimite articolul ca draft pe Travelistul.com.</span></div>
          <button onClick={generate} disabled={loading}>{loading ? "Se generează..." : "✦ Generează pachetul"}</button>
        </header>

        <div className="notice"><strong>{mode === "ai" ? "OPENAI" : "SAFE MODE"}</strong><span>{mode === "ai" ? "Conținut generat prin modelul AI configurat." : "Fără cheie OpenAI, aplicația folosește un șablon factual și editabil."}</span></div>

        <section className="panel">
          <div className="panelTitle"><div><h2>Conexiune WordPress</h2><p>Credentialele sunt păstrate numai în Vercel Environment Variables.</p></div><span className={wordpress?.connected ? "sourceOk" : "sourceError"}>{wordpress?.connected ? "CONECTAT" : "NECONFIGURAT"}</span></div>
          <div className="sourceBox">
            <strong>{wordpress?.connected ? `Travelistul.com · ${wordpress.user?.name ?? "utilizator autorizat"}` : "Travelistul.com nu este încă autorizat"}</strong>
            <p>{wordpress?.connected ? `Status implicit: ${wordpress.defaultStatus ?? "draft"}. Publicarea live: ${wordpress.livePublishing ? "activată" : "blocată"}.` : wordpress?.message ?? "Se verifică legătura cu WordPress..."}</p>
          </div>
        </section>

        <section className="panel">
          <div className="panelTitle"><div><h2>Semnal selectat</h2><p>Sursa trebuie verificată înainte de generare și publicare.</p></div><span className="status">INTEL {sample.totalScore}/100</span></div>
          <div className="sourceBox"><strong>{sample.title}</strong><p>{sample.summary}</p><p>{sample.source} · {sample.country} · Impact România {sample.romaniaImpact}/100 · Discover {sample.discoverScore}/100</p></div>
        </section>

        {!editorial ? <section className="panel emptyWriter"><strong>Pachetul editorial nu a fost generat încă.</strong><span>Apasă „Generează pachetul” pentru articol, SEO, Facebook, X și push notification.</span></section> : <>
          <section className="writerTabs">
            <button className={activeTab === "article" ? "selected" : ""} onClick={() => setActiveTab("article")}>Articol</button>
            <button className={activeTab === "seo" ? "selected" : ""} onClick={() => setActiveTab("seo")}>SEO</button>
            <button className={activeTab === "social" ? "selected" : ""} onClick={() => setActiveTab("social")}>Social & Push</button>
          </section>

          {activeTab === "article" && <section className="panel writerWorkspace">
            <label>Titlu SEO<input value={editorial.seoTitle} onChange={(event) => setEditorial({ ...editorial, seoTitle: event.target.value })} /></label>
            <label>Excerpt<textarea value={editorial.excerpt} onChange={(event) => setEditorial({ ...editorial, excerpt: event.target.value })} /></label>
            <label>Articol HTML<textarea className="articleEditor" value={editorial.article} onChange={(event) => setEditorial({ ...editorial, article: event.target.value })} /></label>
            <div className="actions"><button>Salvează pentru verificare</button><button className="primary">Aprobă conținutul</button></div>
          </section>}

          {activeTab === "seo" && <section className="panel writerWorkspace">
            <label>Slug<input value={editorial.slug} onChange={(event) => setEditorial({ ...editorial, slug: event.target.value })} /></label>
            <label>Meta description<textarea value={editorial.metaDescription} onChange={(event) => setEditorial({ ...editorial, metaDescription: event.target.value })} /></label>
            <label>Cuvinte-cheie<input value={editorial.keywords.join(", ")} onChange={(event) => setEditorial({ ...editorial, keywords: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
            <label>Etichete WordPress<input value={editorial.tags.join(", ")} onChange={(event) => setEditorial({ ...editorial, tags: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
            <div className="scoreCards"><article><small>Titlu</small><strong>{editorial.seoTitle.length}/68</strong></article><article><small>Meta</small><strong>{editorial.metaDescription.length}/155</strong></article><article><small>Discover</small><strong>{sample.discoverScore}/100</strong></article></div>
          </section>}

          {activeTab === "social" && <section className="panel writerWorkspace">
            <label>Facebook<textarea value={editorial.facebook} onChange={(event) => setEditorial({ ...editorial, facebook: event.target.value })} /></label>
            <label>X<textarea value={editorial.x} onChange={(event) => setEditorial({ ...editorial, x: event.target.value })} /></label>
            <label>Push title<input value={editorial.pushTitle} onChange={(event) => setEditorial({ ...editorial, pushTitle: event.target.value })} /></label>
            <label>Push body<textarea value={editorial.pushBody} onChange={(event) => setEditorial({ ...editorial, pushBody: event.target.value })} /></label>
          </section>}

          <section className="panel publishPanel">
            <div className="panelTitle"><div><h2>Trimitere controlată</h2><p>Butonul creează numai un draft. Nu publică articolul live.</p></div></div>
            <div className="actions"><button className="primary" onClick={sendDraft} disabled={publishing || !wordpress?.connected}>{publishing ? "Se trimite..." : "Trimite draft pe Travelistul.com"}</button></div>
            {notice && <div className="publishMessage"><strong>{notice}</strong>{draftLink && <a href={draftLink} target="_blank" rel="noreferrer">Deschide draftul în WordPress ↗</a>}</div>}
          </section>
        </>}
      </section>
    </main>
  );
}
