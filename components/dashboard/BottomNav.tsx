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
      style={{ color: active ? dash.teal : dash.navInactive }}
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
      style={{ color: active ? dash.teal : dash.navInactive }}
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
      style={{ color: active ? dash.teal : dash.navInactive }}
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
    <nav className="pointer-events-none fixed bottom-0 left-1/2 z-[100] w-full max-w-[480px] -translate-x-1/2 md:max-w-[860px]">
      <div
        className="pointer-events-auto flex items-center justify-around border-t px-2 pt-2.5"
        style={{
          backgroundColor: dash.navBg,
          borderColor: dash.navBorderTop,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        }}
      >
        <button
          type="button"
          onClick={() => onChange("karte")}
          className="flex flex-col items-center gap-0.5 rounded-[12px] px-5 py-1.5 transition active:scale-[0.92]"
          style={{ color: active === "karte" ? dash.teal : dash.navInactive }}
        >
          <IconKarte active={active === "karte"} />
          <span className="text-[11px] font-semibold tracking-wide md:text-sm">Karte</span>
        </button>

        <button
          type="button"
          onClick={() => onChange("home")}
          className="flex flex-col items-center gap-0.5 rounded-[12px] px-6 py-1.5 transition active:scale-[0.92]"
          style={{ color: active === "home" ? dash.teal : dash.navInactive }}
        >
          <IconHome active={active === "home"} />
          <span className="text-[11px] font-semibold tracking-wide md:text-sm">Home</span>
        </button>

        <button
          type="button"
          onClick={() => onChange("tische")}
          className="flex flex-col items-center gap-0.5 rounded-[12px] px-5 py-1.5 transition active:scale-[0.92]"
          style={{ color: active === "tische" ? dash.teal : dash.navInactive }}
        >
          <IconTische active={active === "tische"} />
          <span className="text-[11px] font-semibold tracking-wide md:text-sm">Tische</span>
        </button>
      </div>
    </nav>
  );
}
