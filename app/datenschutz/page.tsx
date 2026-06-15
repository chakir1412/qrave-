import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Datenschutz – Qrave",
  description: "Datenschutzerklärung für Qrave digitale Speisekarten.",
};

export default function DatenschutzPage() {
  return (
    <LegalPageShell>
      <h1 className="text-[32px] font-semibold text-white">Datenschutzerklärung</h1>

      <h2 className="mt-10 text-lg font-medium text-white">1. Verantwortlicher</h2>
      <p className="mt-2 text-[15px] leading-[1.8] text-white/60">
        Mohammed Chakir El Haji
        <br />
        Hortensienring 18
        <br />
        65929 Frankfurt am Main
        <br />
        Telefon:{" "}
        <a
          href="tel:+491738996449"
          className="text-white/80 underline-offset-4 hover:text-white hover:underline"
        >
          +49 173 8996449
        </a>
        <br />
        E-Mail:{" "}
        <a
          href="mailto:info@qrave.menu"
          className="text-white/80 underline-offset-4 hover:text-white hover:underline"
        >
          info@qrave.menu
        </a>
      </p>

      <h2 className="mt-10 text-lg font-medium text-white">
        2. Allgemeines zur Datenverarbeitung
      </h2>
      <p className="mt-2 text-[15px] leading-[1.8] text-white/60">
        Wir nehmen den Schutz Ihrer persönlichen Daten ernst. Diese Website verwendet
        keine Tracking-Tools, keine Cookies zu Werbezwecken und keine externen
        Analyse-Dienste.
      </p>

      <h2 className="mt-10 text-lg font-medium text-white">3. Hosting</h2>
      <p className="mt-2 text-[15px] leading-[1.8] text-white/60">
        Diese Website wird gehostet bei Vercel Inc., 340 Pine Street, Suite 801,
        San Francisco, CA 94104, USA. Vercel verarbeitet beim Aufruf der Website
        technisch notwendige Verbindungsdaten (IP-Adresse, Zeitstempel, aufgerufene
        URL). Diese Daten werden ausschließlich zur Bereitstellung des Dienstes
        verwendet und nicht von uns ausgewertet. Weitere Informationen:{" "}
        <a
          href="https://vercel.com/legal/privacy-policy"
          className="text-white/80 underline-offset-4 hover:text-white hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          https://vercel.com/legal/privacy-policy
        </a>
      </p>

      <h2 className="mt-10 text-lg font-medium text-white">
        4. Digitale Speisekarten (qrave.menu/[restaurant])
      </h2>
      <p className="mt-2 text-[15px] leading-[1.8] text-white/60">
        Beim Aufruf einer digitalen Speisekarte werden anonymisierte Nutzungsdaten
        erhoben (z. B. aufgerufene Kategorien, angeklickte Speisen, Tageszeit des
        Besuchs). Eine Identifizierung einzelner Personen ist nicht möglich.
      </p>
      <p className="mt-3 text-[15px] leading-[1.8] text-white/60">
        <strong className="text-white/80">Tier-0 — ohne Einwilligung:</strong>{" "}
        Beim Aufruf wird ein Zähler-Event mit Tageszeit, Wochentag, Gerätetyp
        (mobile/desktop) und einem nicht-reversiblen HMAC-Hash der IP-Adresse
        (täglich rotierender Schlüssel, daher tag-übergreifend nicht verkettbar)
        geschrieben. Rohdaten werden nach 48 Stunden automatisch gelöscht; vorher
        fließen sie in anonyme Tages-Aggregate ein. Rechtsgrundlage:
        Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse — Reichweitenmessung).
      </p>
      <p className="mt-3 text-[15px] leading-[1.8] text-white/60">
        <strong className="text-white/80">Tier-1 — nur mit Einwilligung:</strong>{" "}
        Nach Klick auf „Helfen" im Consent-Banner werden zusätzlich folgende
        Interaktionen anonym erfasst: Scroll-Tiefe (25 / 50 / 75 / 100 %),
        Verweildauer pro Kategorie und pro geöffnetem Item, Wiederkehr-Flag
        (anonyme Pseudonym-ID im lokalen Speicher), Bounce-Erkennung (Abbruch
        unter 5 Sekunden), Item-Klicks, Kategorie-Wechsel, Filter-Nutzung
        (vegan / vegetarisch / glutenfrei / scharf), Merklisten-Adds inklusive
        Preis, Getränke-Subkategorie (Bier / Wein / Cocktails / …), sowie
        Preis-Bucket des Items (budget / mid / premium). Auch diese Rohdaten
        werden nach 48 Stunden gelöscht. Rechtsgrundlage:
        Art. 6 Abs. 1 lit. a DSGVO (Einwilligung). Du kannst deine Einwilligung
        jederzeit widerrufen, indem du den lokalen Speicher des Browsers löschst.
      </p>

      <h2 className="mt-10 text-lg font-medium text-white">
        5. Auftragsverarbeiter
      </h2>
      <p className="mt-2 text-[15px] leading-[1.8] text-white/60">
        Zur Bereitstellung unserer Dienste setzen wir folgende Auftragsverarbeiter
        ein:
      </p>
      <ul className="mt-3 list-disc space-y-3 pl-5 text-[15px] leading-[1.8] text-white/60">
        <li>
          <strong className="text-white/80">Anthropic PBC</strong>, 548 Market St,
          San Francisco, CA 94104, USA: KI-gestützte Analyse von
          Speisekarten-PDFs und Generierung von Beschreibungen.
          Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).
          Übermittlung in Drittland USA auf Basis von Standardvertragsklauseln.
        </li>
        <li>
          <strong className="text-white/80">DeepL SE</strong>, Maarweg 165, 50825
          Köln: Übersetzung von Speisekarten-Inhalten. Rechtsgrundlage: Art. 6
          Abs. 1 lit. b DSGVO. Verarbeitung innerhalb der EU.
        </li>
      </ul>

      <h2 className="mt-10 text-lg font-medium text-white">
        6. Lokaler Speicher
      </h2>
      <p className="mt-2 text-[15px] leading-[1.8] text-white/60">
        Diese Website nutzt den <em>lokalen Speicher</em> des Browsers
        (localStorage — keine Cookies im technischen Sinne) für folgende
        technisch notwendige Zwecke:
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-[1.8] text-white/60">
        <li>
          <code className="rounded bg-white/5 px-1.5 py-0.5 text-[13px]">
            qrave_landing_consent
          </code>{" "}
          — speichert deine Cookie-/Tracking-Entscheidung auf der Startseite.
        </li>
        <li>
          <code className="rounded bg-white/5 px-1.5 py-0.5 text-[13px]">
            qrave_consent
          </code>{" "}
          — speichert deine Tracking-Entscheidung in der Gäste-Speisekarte (Werte
          „accepted" oder „declined").
        </li>
        <li>
          <code className="rounded bg-white/5 px-1.5 py-0.5 text-[13px]">
            qrave_visitor_id
          </code>{" "}
          — pseudonyme Geräte-ID für Wiederkehr-Erkennung. Wird erst nach
          erteilter Einwilligung erstellt und gespeichert. Ohne Einwilligung
          existiert dieser Eintrag nicht.
        </li>
        <li>
          <code className="rounded bg-white/5 px-1.5 py-0.5 text-[13px]">
            qrave-locale
          </code>{" "}
          — gewählte Sprache der Speisekarte.
        </li>
      </ul>
      <p className="mt-3 text-[15px] leading-[1.8] text-white/60">
        Diese Einträge können in den Browser-Einstellungen jederzeit gelöscht
        werden.
      </p>

      <h2 className="mt-10 text-lg font-medium text-white">7. Betroffenenrechte</h2>
      <p className="mt-2 text-[15px] leading-[1.8] text-white/60">
        Sie haben das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung
        der Verarbeitung Ihrer Daten sowie das Recht auf Datenübertragbarkeit. Da
        wir keine personenbezogenen Daten speichern, können wir keine
        personenbezogenen Auskünfte erteilen.
        <br />
        Bei Fragen wenden Sie sich an:{" "}
        <a
          href="mailto:info@qrave.menu"
          className="text-white/80 underline-offset-4 hover:text-white hover:underline"
        >
          info@qrave.menu
        </a>
      </p>

      <h2 className="mt-10 text-lg font-medium text-white">8. Beschwerderecht</h2>
      <p className="mt-2 text-[15px] leading-[1.8] text-white/60">
        Sie haben das Recht, sich bei der zuständigen Aufsichtsbehörde zu beschweren.
        Zuständig ist der Hessische Beauftragte für Datenschutz und
        Informationsfreiheit:{" "}
        <a
          href="https://datenschutz.hessen.de"
          className="text-white/80 underline-offset-4 hover:text-white hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          https://datenschutz.hessen.de
        </a>
      </p>
    </LegalPageShell>
  );
}
