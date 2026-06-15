"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Props = {
  /** Erklärungstext, max 2 Sätze. */
  text: string;
  /** Veraltet — Richtung wird jetzt dynamisch nach Viewport-Position bestimmt.
   *  Prop bleibt für Backward-Compat im Signatur-Vertrag bestehender Caller. */
  placement?: "top" | "bottom";
};

type TooltipStyle = {
  top?: number;
  bottom?: number;
  left: number;
  transform: string;
};

const TOOLTIP_WIDTH = 240;
const MARGIN = 8;

/** Kleines `?`-Icon mit Popup-Erklärung — lila Border, dunkler Hintergrund.
 *  Auf Klick toggle (touch-friendly), auf Hover bei Pointer-Geräten.
 *
 *  Tooltip rendert via `position: fixed` mit Koordinaten aus
 *  `triggerRef.getBoundingClientRect()` — escapes alle `overflow: hidden`-
 *  Eltern (Cards) ohne Portal. */
export function Hint({ text }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [tipStyle, setTipStyle] = useState<TooltipStyle | null>(null);

  // Klick außerhalb / Touch außerhalb schließt den Hint.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent | TouchEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  // Position aus Trigger-Rect berechnen. Vertikale Richtung anhand
  // Viewport-Halbierung (Icon oben → Tooltip unten und umgekehrt).
  // Horizontal zentriert, an Viewport-Rand abgeklemmt.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setTipStyle(null);
      return;
    }
    const trigger = triggerRef.current.getBoundingClientRect();
    const viewportW = document.documentElement.clientWidth;
    const viewportH = window.innerHeight;

    const cx = trigger.left + trigger.width / 2;
    let left: number;
    let transform: string;
    if (cx - TOOLTIP_WIDTH / 2 < MARGIN) {
      left = MARGIN;
      transform = "none";
    } else if (cx + TOOLTIP_WIDTH / 2 > viewportW - MARGIN) {
      left = viewportW - MARGIN - TOOLTIP_WIDTH;
      transform = "none";
    } else {
      left = cx;
      transform = "translateX(-50%)";
    }

    if (trigger.top < viewportH / 2) {
      // Icon obere Bildschirmhälfte → Tooltip nach unten.
      setTipStyle({ top: Math.round(trigger.bottom + MARGIN), left, transform });
    } else {
      // Icon untere Hälfte → Tooltip nach oben. `bottom` statt `top`,
      // damit wir die Tooltip-Höhe nicht messen müssen.
      setTipStyle({
        bottom: Math.round(viewportH - trigger.top + MARGIN),
        left,
        transform,
      });
    }
  }, [open, text]);

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        aria-label="Hilfe"
        className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] font-bold transition"
        style={{
          background: "rgba(255,255,255,0.08)",
          color: "rgba(242,242,242,0.65)",
          border: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        ?
      </button>
      {open && tipStyle ? (
        <span
          role="tooltip"
          className="pointer-events-none rounded-[10px] border px-3 py-2 text-[12px] leading-relaxed shadow-xl"
          style={{
            position: "fixed",
            top: tipStyle.top,
            bottom: tipStyle.bottom,
            left: tipStyle.left,
            transform: tipStyle.transform,
            width: TOOLTIP_WIDTH,
            zIndex: 9999,
            background: "rgba(12,8,24,0.95)",
            color: "#f2f2f2",
            borderColor: "color-mix(in srgb, var(--qrave-accent) 40%, transparent)",
            backdropFilter: "blur(8px)",
          }}
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}
