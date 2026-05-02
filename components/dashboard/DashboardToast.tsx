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
      className="pointer-events-none fixed bottom-[100px] left-1/2 z-[300] max-w-[90vw] -translate-x-1/2 rounded-xl border px-[18px] py-2.5 text-[13px] font-semibold transition-all duration-300"
      style={{
        backgroundColor: "rgba(10,10,20,0.92)",
        borderColor: "rgba(52,232,158,0.35)",
        color: dash.gr,
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
