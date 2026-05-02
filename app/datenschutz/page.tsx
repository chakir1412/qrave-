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
        Mohammed Chakir El Haji, Hortensienring 18, 65929 Frankfurt am Main
        <br />
        E-Mail:{" "}
        <a
          href="mailto:hallo@qrave.menu"
          className="text-white/80 underline-offset-4 hover:text-white hover:underline"
        >
          hallo@qrave.menu
        </a>
      </p>

      <h2 className="mt-10 text-lg font-medium text-white">2. Was wir erfassen</h2>
      <p className="mt-2 text-[15px] leading-[1.8] text-white/60">
        Beim Besuch unserer digitalen Speisekarte erfassen wir folgende anonyme
        Nutzungsdaten:
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-[1.8] text-white/60">
        <li>Zeitpunkt des Seitenaufrufs</li>
        <li>Gerättyp (Mobil/Desktop)</li>
        <li>Aufgerufene Kategorien und Menüpunkte</li>
        <li>Tischnummer (sofern über QR-Code aufgerufen)</li>
      </ul>
      <p className="mt-4 text-[15px] leading-[1.8] text-white/60">
        Wir erfassen keine personenbezogenen Daten wie Name, E-Mail-Adresse oder
        Standort.
      </p>

      <h2 className="mt-10 text-lg font-medium text-white">3. Zweck der Datenerfassung</h2>
      <p className="mt-2 text-[15px] leading-[1.8] text-white/60">
        Die Daten werden ausschließlich verwendet um die Speisekarte zu
        optimieren, beliebte Gerichte zu identifizieren und die technische
        Funktionsfähigkeit sicherzustellen.
      </p>

      <h2 className="mt-10 text-lg font-medium text-white">4. Consent</h2>
      <p className="mt-2 text-[15px] leading-[1.8] text-white/60">
        Beim ersten Besuch werden Sie gefragt ob Sie der anonymen Datenerfassung
        zustimmen. Ohne Zustimmung erfassen wir nur technisch notwendige Daten
        (Tier 0). Ihre Wahl wird im localStorage Ihres Browsers gespeichert.
      </p>

      <h2 className="mt-10 text-lg font-medium text-white">5. Datenspeicherung</h2>
      <p className="mt-2 text-[15px] leading-[1.8] text-white/60">
        Alle Daten werden auf Servern von Supabase (EU-Region) und Vercel
        gespeichert. Keine Weitergabe an Dritte.
      </p>

      <h2 className="mt-10 text-lg font-medium text-white">6. Ihre Rechte</h2>
      <p className="mt-2 text-[15px] leading-[1.8] text-white/60">
        Da wir keine personenbezogenen Daten speichern, ist eine individuelle
        Zuordnung nicht möglich. Bei Fragen:{" "}
        <a
          href="mailto:hallo@qrave.menu"
          className="text-white/80 underline-offset-4 hover:text-white hover:underline"
        >
          hallo@qrave.menu
        </a>
      </p>

      <h2 className="mt-10 text-lg font-medium text-white">7. Cookies</h2>
      <p className="mt-2 text-[15px] leading-[1.8] text-white/60">
        Wir verwenden keine Cookies. Die Consent-Entscheidung wird ausschließlich
        über localStorage gespeichert.
      </p>

      <h2 className="mt-10 text-lg font-medium text-white">8. Hosting</h2>
      <p className="mt-2 text-[15px] leading-[1.8] text-white/60">
        Vercel Inc., 340 Pine Street, Suite 701, San Francisco, CA 94104, USA.
        <br />
        <a
          href="https://vercel.com/legal/privacy-policy"
          className="text-white/80 underline-offset-4 hover:text-white hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          https://vercel.com/legal/privacy-policy
        </a>
      </p>
    </LegalPageShell>
  );
}
