# Qrave Project Rules – Referenz

Diese Datei ergänzt die `SKILL.md` um etwas mehr Kontext und kann bei Bedarf gelesen werden, wenn genauere Erläuterungen zu einzelnen Regeln benötigt werden.

## Dateistruktur

- **Warum Trennung nach `speisekarte` / `templates` / `shared`?**
  - `components/speisekarte/` hält alle funktionalen Bausteine der QR-Speisekarte (Filter, Grid, Wishlist usw.).
  - `components/templates/` bildet konkrete visuelle Designs/Brandings auf Basis derselben Daten ab.
  - `components/shared/` enthält Logik und Types, die in beiden Welten wiederverwendbar sind.
  - Dadurch bleiben:
    - UI-Varianten und Business-Logik sauber getrennt,
    - neue Templates leichter implementierbar,
    - Wiederverwendung maximiert.

- **Kein Logik-Code in `app/`**
  - `app/` dient nur als Routing- und Kompositionsschicht.
  - Die eigentliche Fachlogik (z. B. wie ein Daily Push berechnet oder eine Wishlist gespeichert wird) liegt in Hooks/Komponenten in `components/`.
  - Das macht die App:
    - besser testbar,
    - einfacher zu refactoren,
    - kompatibler mit zukünftigen Layout-/Routing-Anpassungen.

## Supabase

- **Warum zwingend Migrationen?**
  - Das Repo soll jederzeit den kompletten Stand der Datenbank-Struktur abbilden.
  - Änderungen nur im Supabase UI ohne Migration würden:
    - Deployments unvorhersehbar machen,
    - Onboarding neuer Entwickler erschweren,
    - Debugging von Produktionsproblemen verkomplizieren.

- **Manuelle Ausführung im SQL Editor**
  - Da keine Supabase CLI installiert ist, ist der SQL Editor die Quelle der Wahrheit für das Ausführen.
  - Die Migration im Repo ist die Dokumentation; der Editor ist das Ausführungswerkzeug.

- **RLS-Grundidee**
  - Jede Tabelle ist standardmäßig geschlossen.
  - Policies öffnen genau die Fälle, die für Qrave nötig sind (z. B. Zugriff nur auf das eigene Restaurant).

## Git & Code-Qualität

- **Deutsche Commits**
  - Erleichtern für deutschsprachige Teams die Historie und Reviews.
  - Erlauben präzise Beschreibung der fachlichen Änderungen im Domänenkontext.

- **Build-/Lint-Pflicht**
  - Verhindert, dass fehlerhafter Code in Branches oder PRs landet.
  - Spart Zeit im Review, weil offensichtliche Fehler vorher abgefangen werden.

- **Keine `alert()`-Nutzung**
  - Nutzerfreundliche, barrierearme Anwendungen verwenden konsistente visuelle Feedback-Komponenten.
  - Alerts sind schwer zu stylen, blockierend und passen nicht zum Qrave-UX-Ansatz.

## Qrave-spezifische Aspekte

- **Allergene als Disclaimer**
  - Qrave übernimmt keine Haftung für Allergenangaben.
  - Statt strukturierter Allergen-Daten zeigt Qrave nur einen Hinweis, dass Gäste beim Personal nachfragen müssen.

- **Light Mode only**
  - Designentscheid: Qrave ist aktuell nur in Light Mode geplant.
  - Dark Mode würde:
    - Design-Aufwand erhöhen,
    - mehr Zustände in Styles erzwingen,
    - zusätzliche Tests erfordern.
  - Solange nicht ausdrücklich gewünscht, bleibt Dark Mode außen vor.

