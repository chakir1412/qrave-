"use client";

/** Forward-Animation: Speisekarte kommt von unten rein (slide-up).
 *  Nach Ende der Animation wird die Klasse entfernt, damit kein transform
 *  auf dem Container bleibt — sonst wird position:fixed (ItemModal) relativ
 *  zu diesem Div positioned statt zum Viewport. */
export default function Template({ children }: { children: React.ReactNode }) {
  function handleAnimationEnd(e: React.AnimationEvent<HTMLDivElement>) {
    if (e.animationName === "qrave-slide-up-in") {
      e.currentTarget.classList.remove("qrave-slide-up-in");
    }
  }

  return (
    <div className="qrave-slide-up-in" onAnimationEnd={handleAnimationEnd}>
      {children}
    </div>
  );
}
