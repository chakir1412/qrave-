# CLAUDE.md — Qrave Projekt

Verhaltensregeln für Claude Code im Qrave-Projekt. Immer einhalten.

---

## 1. Erst denken, dann coden

**Keine Annahmen. Keine versteckte Verwirrung. Tradeoffs benennen.**

- Annahmen explizit nennen. Bei Unsicherheit fragen.
- Wenn mehrere Interpretationen möglich sind: alle nennen, nicht still eine wählen.
- Wenn ein einfacherer Weg existiert: sagen. Pushback ist erwünscht.
- Wenn etwas unklar ist: stoppen, benennen, fragen.

---

## 2. Simplicity First

**Minimum Code der das Problem löst. Nichts Spekulatives.**

- Keine Features die nicht explizit angefragt wurden.
- Keine Abstraktionen für einmalig genutzten Code.
- Keine "Flexibilität" oder "Konfigurierbarkeit" die nicht verlangt wurde.
- Kein Error Handling für unmögliche Szenarien.
- Wenn 200 Zeilen auch 50 sein könnten: neu schreiben.

Frage: "Würde ein Senior Engineer das als überkompliziert bezeichnen?" Wenn ja: vereinfachen.

---

## 3. Surgical Changes

**Nur das Nötige anfassen. Nur den eigenen Mess aufräumen.**

Beim Editieren von bestehendem Code:
- Keinen "benachbarten" Code verbessern, Kommentare oder Formatierung nicht anpassen.
- Nichts refactoren was nicht kaputt ist.
- Bestehenden Stil übernehmen, auch wenn man es anders machen würde.
- Ungenutzten Code erwähnen — nicht löschen.

Wenn eigene Änderungen Orphans erzeugen:
- Imports/Variablen/Funktionen entfernen die durch EIGENE Änderungen unused wurden.
- Vorher existierenden toten Code nicht entfernen außer explizit angefragt.

Test: Jede geänderte Zeile muss direkt auf die Anfrage zurückführbar sein.

---

## 4. Goal-Driven Execution

**Erfolgskriterien definieren. Loop bis verifiziert.**

Aufgaben in verifizierbare Ziele übersetzen:
- "Fix the bug" → "Reproduziere den Bug, dann fix ihn, dann verifiziere"
- "Baue Feature X" → klare Schritte mit Verifikation pro Schritt

Bei Multi-Step Tasks: kurzen Plan nennen bevor gestartet wird.

Nach jeder Änderung: `npm run build` prüfen bevor deployed wird.

---

## Projekt: Qrave

### Stack
- Next.js App Router, React 19, TypeScript 5, Tailwind v4
- Supabase (DB + Auth + Storage)
- Vercel (Hosting)
- Deploy: immer `npm run build` → wenn grün → `npx vercel --prod`
- GitHub: github.com/chakir1412/qrave-

### Wichtige Konstanten
- Supabase URL: `lkaxapfvkjwfchiqaiee.supabase.co`
- Domain: `qrave.menu`
- Founder User ID: `b48eeabc-0652-4b8c-8579-4286c0570d54`
- Frankfurter Wirtshaus ID: `9a333508-fa4a-4586-9ed2-e79e4a79ba95`
- Cron Secret: `qrave-cron-2026`
- Analytics Endpoint: `https://qrave.menu/api/cron/aggregate-analytics`
- Storage Bucket: `restaurant-assets` (NICHT 'public')

### Design-Token Founder Dashboard
- Hintergrund: `#0c0c0f`
- Akzent Teal: `#00c8a0`
- Akzent Orange: `#ff5c1a`
- Font: DM Sans
- Glasskarten: `backdrop-filter: blur`

### Entfernte Features — nicht zurückbauen
- Tisch-Tracking (`/tisch-[nr]` URLs) — entfernt, alle Restaurants laufen auf `qrave.menu/[slug]`
- QR-Code-Generator im Founder Dashboard — wird extern via QR Monkey gemacht
- Öffnungszeiten-Feature — aus Dashboard, Speisekarte und DB entfernt
- Tische-Button und QR-Codes-Button im Restaurant-Card — entfernt

### Architektur-Entscheidungen
- Kein Abo-Modell — Restaurants zahlen nie
- DSGVO: localStorage Key `qrave_consent` → `'accepted'` oder `'declined'`
- Tier-0 Tracking: server-seitig, kein Consent nötig
- Tier-1 Tracking: nur wenn `qrave_consent === 'accepted'`
- Vercel Hobby: kein 15-Min-Cron möglich — Cron läuft nightly via cron-job.org

### SQL
- Immer OHNE Markdown-Codeblöcke (Supabase SQL Editor)
- `menu_items tags`: PostgreSQL `text[]` Format (nicht JSONB)

### Obsidian Auto-Update

Nach jedem Deploy (`npx vercel --prod`) folgende Dateien aktualisieren:

**Vault-Pfad:** `/Users/mohammedchakirelhaji/Library/Mobile Documents/iCloud~md~obsidian/Documents/Qrave Brain`

- `05 - Tech/Offene Aufgaben.md` — erledigte Tasks abhaken, neue eintragen
- `05 - Tech/Deployment.md` — wenn sich Deploy-Workflow oder ENV ändert
- `02 - Produkt/Produkt-Stand.md` — wenn Features hinzukommen oder entfernt werden
- `01 - Strategie/Finale Entscheidungen.md` — wenn neue Entscheidungen getroffen werden
- `03 - Restaurants/Onboarding Workflow.md` — wenn sich Onboarding-Prozess ändert

Regel: Nur die Dateien updaten die von der aktuellen Session betroffen sind. Nicht alle Dateien bei jedem Deploy neu schreiben.

### Obsidian → founder_todos Auto-Sync

Bei jedem **"Schau dir Obsidian an"** am Anfang einer Session sofort folgenden Sync ausführen, bevor mit der eigentlichen Aufgabe begonnen wird:

1. `05 - Tech/Offene Aufgaben.md` lesen
2. Alle Bullet-Tasks parsen (Tasks mit `- [ ]` oder `- [x]` Prefix, Markdown-Formatierung im Text behalten)
3. Aktuellen Stand der `founder_todos`-Tabelle laden (via Supabase MCP `execute_sql`)
4. Sync-Regeln:
   - **Offen in Obsidian** (`- [ ]`) und nicht in `founder_todos` → INSERT mit `text` = Task-Roh-Text (kompakt, ≤180 Zeichen), `sub` = `'obsidian'`, `prio` = `'1'`/`'2'`/`'3'` je nach Sektion (Priorität 1 / 2 / 3), `done` = `false`
   - **Erledigt in Obsidian** (`- [x]`) und entsprechender Eintrag in `founder_todos` mit `done=false` → UPDATE auf `done=true`
   - **Match-Kriterium**: Titel-Text (Substring-Match nach Trim/lowercase, ohne Markdown-Sterne)
   - **Bestand in `founder_todos` ohne Obsidian-Pendant** → unverändert lassen (User kann manuell anlegen)
5. Keine Duplikate erzeugen — vor jedem INSERT prüfen ob `text ILIKE '%<kerntext>%'` schon existiert

Tabelle: `founder_todos (id uuid, text text NOT NULL, sub text, prio text, done bool, created_at timestamptz)`. Wird vom Founder-Dashboard To-Do-Tab angezeigt.
