# Qrave Project Rules – Beispiele

Diese Beispiele zeigen, wie der Agent die Qrave-Regeln in typischen Situationen anwenden soll.

---

## Beispiel 1: Neue Speisekarten-Komponente

- **Situation**: Ein Filter für vegane Gerichte soll hinzugefügt werden.
- **Vorgehen nach Regeln**:
  - Neue UI-Komponente unter `components/speisekarte/` anlegen (z. B. `VeganFilter.tsx`).
  - Eventuelle geteilte Logik (z. B. Filterfunktion auf Daten) in einem Hook oder Utility unter `components/shared/` kapseln.
  - In der relevanten Route unter `app/` nur die neue Komponente einbinden, ohne komplexe Logik in der Page selbst.

---

## Beispiel 2: Supabase-Tabelle erweitern

- **Situation**: In der Tabelle für Gerichte soll ein optionales Feld `is_spicy` ergänzt werden.
- **Vorgehen nach Regeln**:
  - Eine neue SQL-Migration unter `supabase/migrations/` anlegen, z. B. `20260313090000_add_is_spicy_to_dishes.sql`.
  - In der Migration die Spalte hinzufügen und ggf. Default-Werte setzen.
  - Im Supabase SQL Editor die Migration ausführen.
  - Sicherstellen, dass RLS weiterhin korrekt ist bzw. bei neuen Tabellen aktiviert wird.
  - Types und Queries im Code anpassen (z. B. in `components/shared/types.ts`), ohne `any` zu verwenden.

---

## Beispiel 3: Nur Refactoring, keine Verhaltensänderung

- **Situation**: Ein bestehender Hook in `components/shared/useWishlist.ts` soll lesbarer werden.
- **Vorgehen nach Regeln**:
  - Datei zuerst vollständig lesen.
  - Interne Implementierung verbessern (z. B. kleinere Funktionen, bessere Benennung).
  - Öffentliche API (Rückgabewerte, Parameter, Seiteneffekte) unverändert lassen.
  - Keine neuen Features hinzufügen (z. B. keine neuen Speicherorte für Wishlist).

---

## Beispiel 4: Commit vorbereiten

- **Situation**: Ein Bugfix im Daily Push wurde implementiert.
- **Vorgehen nach Regeln**:
  - Sicherstellen, dass `npm run build` (oder mindestens `npm run lint` plus relevante Tests) erfolgreich durchlaufen.
  - Commit-Message auf Deutsch formulieren, z. B.:
    - `fix: Daily-Push zeigt nur noch aktuelle Angebote`
  - Änderungen nicht direkt auf `main` pushen, sondern über einen Feature-/Fix-Branch.

---

## Beispiel 5: UI-Feedback statt `alert()`

- **Situation**: Beim Speichern der Speisekarte soll der Nutzer über einen Fehler informiert werden.
- **Vorgehen nach Regeln**:
  - Keine `alert()`-Nutzung.
  - Stattdessen z. B.:
    - Fehlerzustand im State halten und eine klar sichtbare Fehlermeldung in der Oberfläche anzeigen (Toast, Banner, Inline-Text).
  - Design an Light-Mode-Farben und -Kontraste anpassen.

