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
        Besuchs). Es werden keine personenbezogenen Daten wie IP-Adressen,
        Geräte-IDs oder Standortdaten gespeichert. Eine Identifizierung einzelner
        Personen ist nicht möglich.
      </p>
      <p className="mt-3 text-[15px] leading-[1.8] text-white/60">
        Die Erhebung dieser Daten erfolgt auf Basis von Art. 6 Abs. 1 lit. f DSGVO
        (berechtigtes Interesse). Detaillierte Nutzungsanalysen werden nur nach
        ausdrücklicher Einwilligung via Consent-Banner erhoben (Art. 6 Abs. 1
        lit. a DSGVO).
      </p>

      <h2 className="mt-10 text-lg font-medium text-white">5. Betroffenenrechte</h2>
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

      <h2 className="mt-10 text-lg font-medium text-white">6. Beschwerderecht</h2>
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
