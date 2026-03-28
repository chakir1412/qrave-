---
name: qrave-project-rules
description: Sammlung projektweiter Regeln für das Qrave Next.js/Supabase Projekt (Dateistruktur, Supabase-Migrationen, Git-Workflow, Code-Qualität und Qrave-spezifischer Kontext). Verwenden, wenn im Qrave-Repository entwickelt, Dateien angelegt oder umgebaut, Supabase angepasst oder Commits erstellt werden.
---

# Qrave Project Rules

## Zweck

Diese Skill bündelt alle wichtigen Projekt-Regeln für Qrave (Next.js 16, React 19, Tailwind v4, Supabase 2.98.0), damit der Agent bei Arbeiten in diesem Repository konsistent entscheidet und handelt.

Nutzen, sobald:
- im Qrave-Repo Code geändert wird
- neue Komponenten/Seiten angelegt werden
- Supabase-Struktur angepasst wird
- Commits oder Refactorings vorbereitet werden

---

## Dateistruktur (`dateistruktur`)

- **Speisekarten-Komponenten**
  - Lege alle Speisekarten-bezogenen UI-Komponenten in `components/speisekarte/` ab.
  - Beispiele: Grid, Filter, Header, Modale, Wishlist etc.

- **Design-Templates**
  - Lege alle Template-/Brand-spezifischen Komponenten in `components/templates/` ab.
  - Jede Template-Variante erhält dort ihren eigenen Unterordner (`components/templates/<TemplateName>/`).

- **Geteilte Logik & Types**
  - Hooks, Utilities und TypeScript-Types, die von mehreren Bereichen genutzt werden, gehören nach `components/shared/`.
  - Beispiele: `useAnalytics`, `useWishlist`, `useDailyPush`, gemeinsame `types`.

- **Kein Business-Logik-Code in `app/`**
  - In `app/` nur:
    - Routen-Definitionen
    - leichte Composition und Datenweitergabe an Komponenten
  - **Business-Logik und UI-Logik immer in `components/` auslagern.**
  - Wenn neue Funktionalität entsteht: zuerst passende Komponente/Hook unter `components/` anlegen, dann in `app/` nur einbinden.

---

## Supabase-Regeln (`supabase`)

- **Migrationen sind Pflicht**
  - Jede Änderung an der Datenbank muss als Migration unter `supabase/migrations/` abgelegt werden.
  - **Nie** Tabellen, Spalten oder Policies direkt im Supabase UI ändern, ohne die entsprechende SQL-Migration im Repo zu ergänzen.

- **Ausführung der Migrationen**
  - Supabase CLI ist **nicht** installiert.
  - Migrationen werden **manuell im Supabase SQL Editor** ausgeführt.
  - Vorgehen:
    1. Neue SQL-Datei unter `supabase/migrations/` mit sprechendem Namen anlegen.
    2. Inhalt in den Supabase SQL Editor kopieren.
    3. Migration im Editor ausführen und Ergebnis prüfen.

- **RLS (Row Level Security)**
  - Für **jede neue Tabelle** RLS **immer aktivieren**.
  - Policies so formulieren, dass nur autorisierte Zugriffe möglich sind (typischerweise gefiltert nach Restaurant / User).

- **Konsistenz zwischen Code und DB**
  - Wenn Tabellen oder Spalten geändert werden:
    - erst Migration entwerfen
    - dann Types / Queries / Zod-Schemas im Code anpassen
  - Bei Unsicherheit lieber eine neue, additive Spalte nutzen als destruktiv zu ändern.

- **Supabase Auth (Next.js App Router) — nur dieses Muster**
  - **Erlaubt (einzig für Auth-Client):** `import { supabase } from "@/lib/supabase"` — **kein** `createClient` aus `@/lib/supabase` importieren, kein zweiter Supabase-Browser-Client.
  - **Session prüfen (kanonisch):**
    ```ts
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) redirect("/login");
    ```
    - In **Server Components** / **Server Actions:** `redirect` aus `next/navigation` importieren.
    - In **`"use client"`**-Seiten: dieselbe `getSession()`-Prüfung; statt `redirect()` typischerweise `useRouter()` und `router.replace("/login")` (oder mit Query `?redirect=…`), da `redirect` dort nicht das Standard-Muster ist.
  - **Strikt nicht verwenden:** `@supabase/auth-helpers-nextjs`, `createServerComponentClient`, `createBrowserClient`, `createRouteHandlerClient`, `createMiddlewareClient` oder vergleichbare Auth-Helper-Clients.
  - Login/Logout: `supabase.auth.signInWithPassword`, `supabase.auth.signOut` usw. — weiter über denselben `supabase`-Export.

---

## Git-Workflow (`git`)

- **Nie direkt auf `main` pushen**
  - Immer einen Feature-/Fix-Branch verwenden.
  - PRs/Code-Review sind erwünscht, bevor Änderungen in `main` landen.

- **Commit-Messages auf Deutsch**
  - Commit-Beschreibungen **immer auf Deutsch** verfassen.
  - Kurz, präzise, erklärend (z. B. `feat: Speisekarten-Filter für Kategorien hinzufügen`).

- **Build vor jedem Commit prüfen**
  - Vor dem Commit sicherstellen, dass der Build durchläuft.
  - Mindestens:
    - `npm run build` oder
    - bei schnellen Iterationen zumindest `npm run lint`/**und** relevante Tests, wenn vorhanden.
  - Wenn der Agent Änderungen vorgeschlagen hat: diese erst nach erfolgreichem Build/Lint als „fertig“ betrachten.

---

## Code-Qualität (`code-qualitaet`)

- **Betroffene Datei immer zuerst lesen**
  - Vor jeglicher Änderung an einer Datei muss der Agent die Datei mit dem `Read`-Tool vollständig (oder sinnvoll segmentiert) lesen.
  - Keine „Blind-Edits“ ohne Kontext.

- **Refactoring vs. Funktionsänderung**
  - Wenn der User **explizit nur Refactoring** wünscht:
    - keine fachliche Logik ändern
    - keine neuen Features hinzufügen oder bestehende entfernen
    - nur Struktur, Lesbarkeit, Wiederverwendbarkeit, Performance verbessern.
  - Unterschiede klar trennen und im Zweifel Refactoring und Feature-Änderung in getrennten Schritten halten.

- **Keine `alert()`-Aufrufe**
  - In diesem Projekt **keine** `alert()`-Calls im Browser verwenden.
  - Stattdessen **visuelles Feedback**:
    - UI-Komponenten (z. B. Banner, Toasts, Inline-Fehlertexte)
    - klare Zustände im React-UI (Loading, Success, Error).

- **TypeScript & Strictness**
  - TypeScript läuft im Strict-Modus, **niemals** `any` verwenden.
  - Lieber generische, präzise Types in `components/shared/types.ts` oder spezifische Types nahe der Nutzung definieren.

---

## Qrave-Kontext (`qrave-kontext`)

- **Projektbeschreibung**
  - Qrave ist eine **kostenlose QR-Speisekarten Plattform für Restaurants**.
  - Alle Texte, Bezeichner und Erklärungen sollten diesen Produktkontext reflektieren.

- **Wichtige Konstanten**
  - Demo-Restaurant Slug: `qrave-demo`
  - Supabase Projekt-ID: `jpcwbajwjxtuvzomoozp`
  - Admin E-Mail: `chakir.elhaji@gmail.com`

- **Allergene**
  - Allergene werden **nicht** im Detail angezeigt.
  - Es gibt nur einen **Disclaimer-Text**, der darauf hinweist, dass Gäste sich beim Personal zu Allergenen informieren sollen.
  - Keine UI bauen, die suggeriert, dass eine vollständige Allergen-Datenbank existiert.

- **Design / Theme**
  - Dark Mode ist **deaktiviert**.
  - Immer von **Light Mode** ausgehen:
    - Farben, Kontraste und Komponenten so wählen, dass sie in einem hellen Layout funktionieren.
  - Keine Dark-Mode-Toggles oder -Themes einbauen, außer der User fordert explizit eine Design-Erweiterung an.

---

## Beispiele für Anwendung dieser Skill

- **Neue Speisekarten-Komponente anlegen**
  - Lege die Datei unter `components/speisekarte/` an.
  - Nutze geteilte Hooks/Types aus `components/shared/`, falls sinnvoll.
  - Binde die Komponente in einer `app/`-Route nur als „Shell“ ein.

- **Supabase-Tabelle erweitern**
  - Erstelle eine neue SQL-Migration unter `supabase/migrations/`.
  - Aktiviere RLS für neue Tabellen und definiere Policies.
  - Führe die Migration im Supabase SQL Editor aus und update anschließend die Types im Code.

- **Commit vorbereiten**
  - Stelle sicher, dass der Build/Lint läuft.
  - Formuliere die Commit-Message auf Deutsch und beschreibe klar den Mehrwert.
  - Push niemals direkt auf `main`, sondern über einen Branch.

