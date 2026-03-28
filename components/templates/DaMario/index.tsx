import Speisekarte, { type SpeisekarteProps } from "@/components/speisekarte";

// Design-Referenz: templates-html/pizza-menu.html
// Placeholder: rendert vorerst die Standard-Speisekarte.

export default function DaMarioTemplate(props: SpeisekarteProps) {
  return <Speisekarte {...props} />;
}

