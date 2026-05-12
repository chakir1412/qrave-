/** Forward-Animation: Kontaktseite kommt von unten rein (slide-up).
 *  Beim Verlassen via AnimatedBackLink wird die Seite via
 *  qrave-slide-down-out wieder nach unten geschoben. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="qrave-slide-up-in">{children}</div>;
}
