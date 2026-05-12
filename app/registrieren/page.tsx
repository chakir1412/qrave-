import type { Metadata } from "next";
import RegistrierenWizard from "@/components/registrieren/RegistrierenWizard";

export const metadata: Metadata = {
  title: "Registrieren – Qrave",
  description:
    "Erstelle deine digitale Speisekarte in 3 Minuten. Kostenlos, ohne Abo.",
};

export default function RegistrierenPage() {
  return <RegistrierenWizard />;
}
