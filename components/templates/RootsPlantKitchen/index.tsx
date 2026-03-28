import Speisekarte, { type SpeisekarteProps } from "@/components/speisekarte";

// Design-Referenz: templates-html/vegan-menu.html
// Placeholder: rendert vorerst die Standard-Speisekarte.

export default function RootsTemplate(props: SpeisekarteProps) {
  return <Speisekarte {...props} />;
}

