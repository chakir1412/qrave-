"use client";

import { dash } from "./constants";

type Props = {
  onOpenSettings: () => void;
};

export function DashboardHeader({ onOpenSettings }: Props) {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-0 pt-4 pb-3.5">
      <div className="text-[22px] font-semibold tracking-tight text-white md:text-[26px]">Qrave</div>
      <div className="flex items-center gap-2.5">
        <div
          className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold md:text-xs"
          style={{
            backgroundColor: dash.onlineBg,
            borderColor: dash.onlineBorder,
            color: dash.onlineFg,
          }}
        >
          <span
            className="h-[5px] w-[5px] shrink-0 rounded-full animate-pulse"
            style={{ backgroundColor: dash.onlineFg }}
          />
          Online
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] transition active:scale-95"
          style={{
            backgroundColor: dash.secondaryBg,
            border: `1px solid ${dash.secondaryBorder}`,
            color: dash.secondaryFg,
          }}
          aria-label="Einstellungen"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <title>Einstellungen</title>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
