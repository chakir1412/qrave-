"use client";

import { useEffect } from "react";

/** JS-Fallback gegen iOS-Safari Rubber-Band am oberen Dokument-Rand.
 *
 *  CSS-only (`overscroll-behavior-y: none` auf html/body in globals.css)
 *  greift auf manchen iOS-Ständen nicht zuverlässig — dann wandert die
 *  sticky Kategorie-Tab-Leiste beim Ziehen am oberen Rand sichtbar mit.
 *  Dieser Guard installiert einen document-level touchmove-Listener und
 *  blockt die Geste NUR wenn:
 *    - der Dokument-Scroll ganz oben steht (scrollTop <= 0)
 *    - UND die Bewegung nach unten zeigt (dy > 0)
 *    - UND vertikal-dominant ist (|dy| > |dx|) — horizontales Tab-
 *      Scrollen und schrägen Swipes bleiben unbeeinflusst
 *    - UND ein Single-Touch (Pinch/Zoom nicht blocken)
 *
 *  Wird nur auf der Speisekarte-Route (`/[slug]/karte`) montiert. */
export function OverscrollGuard() {
  useEffect(() => {
    let startY = 0;
    let startX = 0;
    let active = false;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        active = false;
        return;
      }
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      active = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!active || e.touches.length !== 1) return;
      const y = e.touches[0].clientY;
      const x = e.touches[0].clientX;
      const dy = y - startY;
      const dx = x - startX;
      const scroller =
        document.scrollingElement ?? document.documentElement ?? document.body;
      const scrollTop = scroller?.scrollTop ?? 0;
      // Rubber-Band am oberen Rand nach unten unterbinden.
      if (scrollTop <= 0 && dy > 0 && Math.abs(dy) > Math.abs(dx)) {
        // Nur wenn das Ziel nicht selbst scrollbar ist — sonst würde man
        // das Ziehen innerhalb eines Modal-Panels oder eines
        // overflow-y-auto-Bereichs blockieren.
        const target = e.target as Element | null;
        if (target && targetIsInsideScrollable(target)) return;
        e.preventDefault();
      }
    };

    const onTouchEnd = () => {
      active = false;
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  return null;
}

/** True wenn das Touch-Ziel innerhalb eines eigenen VERTIKAL scrollbaren
 *  Containers liegt, in dem tatsächlich gescrollt werden kann
 *  (scrollHeight > clientHeight). Nur dann darf die Geste nicht globally
 *  geblockt werden — der innere Scroll übernimmt. Horizontal-only
 *  Container (Tab-Leiste `overflow-x-auto`) werden nicht ausgenommen,
 *  weil das Rubber-Band vertikal ist. */
function targetIsInsideScrollable(el: Element): boolean {
  let node: Element | null = el;
  const doc = document.documentElement;
  while (node && node !== doc && node !== document.body) {
    const style = window.getComputedStyle(node);
    const oy = style.overflowY;
    if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}
