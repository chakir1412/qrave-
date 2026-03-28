"use client";

import type { DashboardTab } from "./types";
import { dash } from "./constants";

type Props = {
  active: DashboardTab;
  onChange: (t: DashboardTab) => void;
};

function IconKarte({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[21px] w-[21px]"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: active ? dash.or : dash.mu }}
    >
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function IconHome({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[22px] w-[22px]"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: active ? dash.or : dash.mu }}
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function IconTische({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[21px] w-[21px]"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: active ? dash.or : dash.mu }}
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

export function DashboardBottomNav({ active, onChange }: Props) {
  return (
    <nav
      className="pointer-events-none fixed bottom-0 left-1/2 z-[100] w-full max-w-[430px] -translate-x-1/2 px-4 pb-5"
      style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
    >
      <div
        className="pointer-events-auto flex items-center justify-around rounded-[28px] border px-2 py-2.5 shadow-[0_8px_40px_rgba(0,0,0,0.35)]"
        style={{
          backgroundColor: "rgba(18,18,18,0.72)",
          borderColor: "rgba(255,255,255,0.06)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
        }}
      >
        <button
          type="button"
          onClick={() => onChange("karte")}
          className="flex flex-col items-center gap-0.5 rounded-[18px] px-[18px] py-2 transition active:scale-[0.88]"
          style={{ color: active === "karte" ? dash.or : dash.mu }}
        >
          <IconKarte active={active === "karte"} />
          <span className="text-[10px] font-semibold tracking-wide">Karte</span>
        </button>

        <button
          type="button"
          onClick={() => onChange("home")}
          className="flex flex-col items-center gap-0.5 rounded-[20px] px-[22px] py-2.5 transition active:scale-[0.88]"
          style={{
            backgroundColor: active === "home" ? dash.ord : "transparent",
            color: active === "home" ? dash.or : dash.mu,
          }}
        >
          <IconHome active={active === "home"} />
          <span
            className={`text-[10px] tracking-wide ${active === "home" ? "font-bold" : "font-semibold"}`}
          >
            Home
          </span>
        </button>

        <button
          type="button"
          onClick={() => onChange("tische")}
          className="flex flex-col items-center gap-0.5 rounded-[18px] px-[18px] py-2 transition active:scale-[0.88]"
          style={{ color: active === "tische" ? dash.or : dash.mu }}
        >
          <IconTische active={active === "tische"} />
          <span className="text-[10px] font-semibold tracking-wide">Tische</span>
        </button>
      </div>
    </nav>
  );
}
