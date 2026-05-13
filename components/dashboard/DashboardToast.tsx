"use client";

import { useEffect } from "react";
import { dash } from "./constants";

type Props = {
  message: string | null;
  onHide: () => void;
  durationMs?: number;
};

export function DashboardToast({ message, onHide, durationMs = 2500 }: Props) {
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(onHide, durationMs);
    return () => window.clearTimeout(t);
  }, [message, onHide, durationMs]);

  if (!message) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-6 left-1/2 z-[300] max-w-[90vw] -translate-x-1/2 rounded-xl border px-5 py-3 text-[13px] font-semibold shadow-2xl transition-all duration-300"
      style={{
        backgroundColor: "rgba(12,8,24,0.95)",
        borderColor: "color-mix(in srgb, var(--qrave-accent) 35%, transparent)",
        color: "#f2f2f2",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        opacity: 1,
        transform: "translateX(-50%) translateY(0)",
      }}
      role="status"
    >
      {message}
    </div>
  );
}
