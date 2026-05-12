/** Forward-Animation: Speisekarte kommt von unten rein (slide-up).
 *  Next.js mountet template.tsx bei jeder Navigation neu — perfekt
 *  als Animation-Trigger ohne State. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="qrave-slide-up-in">{children}</div>;
}
