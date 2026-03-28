import Speisekarte, { type SpeisekarteProps } from "@/components/speisekarte";

// Design-Referenz: templates-html/sushi-menu.html
// Placeholder: rendert vorerst die Standard-Speisekarte.

export default function NamiSushiTemplate(props: SpeisekarteProps) {
  return <Speisekarte {...props} />;
}

