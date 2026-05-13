"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  /** Erklärungstext, max 2 Sätze. */
  text: string;
  /** Optionale Position relativ zum Icon. */
  placement?: "top" | "bottom";
};

/** Kleines `?`-Icon mit Popup-Erklärung — lila Border, dunkler Hintergrund.
 *  Auf Klick toggle (touch-friendly), auf Hover bei Pointer-Geräten. */
export function Hint({ text, placement = "top" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);

  // Klick außerhalb schließt den Hint.
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

  return (
    <span ref={ref} className="relative inline-flex">
      <button
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
      {open ? (
        <span
          role="tooltip"
          className={`pointer-events-none absolute left-1/2 z-[60] w-[240px] -translate-x-1/2 rounded-[10px] border px-3 py-2 text-[12px] leading-relaxed shadow-xl ${placement === "top" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]"}`}
          style={{
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
