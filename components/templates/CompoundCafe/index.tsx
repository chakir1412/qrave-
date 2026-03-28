import Speisekarte, { type SpeisekarteProps } from "@/components/speisekarte";

// Design-Referenz: templates-html/cafe-menu.html
// Placeholder: rendert vorerst die Standard-Speisekarte.

export default function CompoundCafeTemplate(props: SpeisekarteProps) {
  return <Speisekarte {...props} />;
}

