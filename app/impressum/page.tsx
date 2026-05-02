import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Impressum – Qrave",
  description: "Impressum und rechtliche Angaben zu Qrave.",
};

export default function ImpressumPage() {
  return (
    <LegalPageShell>
      <h1 className="text-[32px] font-semibold text-white">Impressum</h1>

      <p className="mt-6 text-[15px] leading-[1.8] text-white/60">
        Angaben gemäß § 5 TMG
      </p>
      <p className="mt-2 text-[15px] leading-[1.8] text-white/60">
        Mohammed Chakir El Haji
        <br />
        Hortensienring 18
        <br />
        65929 Frankfurt am Main
      </p>

      <h2 className="mt-10 text-lg font-medium text-white">Kontakt</h2>
      <p className="mt-2 text-[15px] leading-[1.8] text-white/60">
        E-Mail:{" "}
        <a
          href="mailto:hallo@qrave.menu"
          className="text-white/80 underline-offset-4 hover:text-white hover:underline"
        >
          hallo@qrave.menu
        </a>
      </p>

      <h2 className="mt-10 text-lg font-medium text-white">Umsatzsteuer</h2>
      <p className="mt-2 text-[15px] leading-[1.8] text-white/60">
        Kleinunternehmer gemäß § 19 UStG. Es wird keine Umsatzsteuer berechnet.
      </p>

      <h2 className="mt-10 text-lg font-medium text-white">
        Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV
      </h2>
      <p className="mt-2 text-[15px] leading-[1.8] text-white/60">
        Mohammed Chakir El Haji, Hortensienring 18, 65929 Frankfurt am Main
      </p>

      <h2 className="mt-10 text-lg font-medium text-white">Streitschlichtung</h2>
      <p className="mt-2 text-[15px] leading-[1.8] text-white/60">
        Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung
        bereit:{" "}
        <a
          href="https://ec.europa.eu/consumers/odr"
          className="text-white/80 underline-offset-4 hover:text-white hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          https://ec.europa.eu/consumers/odr
        </a>{" "}
        — Wir nehmen nicht an Streitbeilegungsverfahren teil.
      </p>
    </LegalPageShell>
  );
}
