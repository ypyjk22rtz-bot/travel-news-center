# Travel News Center AI

Aplicație editorială independentă pentru monitorizarea surselor oficiale de călătorie și pregătirea articolelor destinate site-ului WordPress **Travelistul.com**.

## Principii

- proiect complet separat de `travelistul-ai` și de `portal.travelistul.com`;
- sursele oficiale au prioritate;
- publicarea automată este dezactivată implicit;
- fiecare articol necesită verificare și aprobare umană;
- destinația editorială este exclusiv `Travelistul.com`.

## MVP disponibil

- dashboard newsroom responsive;
- Travel Radar;
- Travel Intelligence Score 0–100;
- Discover Score 0–100;
- filtrare pe categorii;
- simulare scanare surse;
- Approval Center interactiv;
- generare, aprobare, respingere și trimitere WordPress în mod demo;
- schema PostgreSQL/Supabase;
- endpoint `/api/health`;
- șablon `.env.example`.

## Pornire locală

```bash
npm install
cp .env.example .env.local
npm run dev
```

Aplicația va fi disponibilă la `http://localhost:3000`.

## Configurare viitoare

1. Creează un proiect Supabase separat și rulează `database/schema.sql`.
2. Completează variabilele Supabase în `.env.local`.
3. Adaugă cheia OpenAI.
4. În WordPress Travelistul.com creează un Application Password pentru utilizatorul editorial.
5. Completează variabilele WordPress.
6. Păstrează `WORDPRESS_DEFAULT_STATUS=draft`.
7. Nu seta `ALLOW_LIVE_PUBLISHING=true` până când fluxul de verificare nu este testat complet.

## Flux

`Source Monitor → Fetch/Normalize → Duplicate Detector → AI Classifier → Intelligence Score → AI Writer → Human Approval → WordPress Draft`

## Categorii principale

Zboruri, rute noi, vize, taxe, destinații, companii aeriene, aeroporturi, promoții, bagaje, siguranță, transport, hoteluri și turism.
