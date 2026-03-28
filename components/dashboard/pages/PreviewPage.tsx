"use client";

import type { DailyPush } from "@/lib/supabase";
import type { MenuItem } from "@/lib/supabase";
import { formatPreisEUR } from "../utils";
import { dash } from "../constants";

type Props = {
  open: boolean;
  onClose: () => void;
  restaurantName: string;
  slug: string;
  logoUrl: string | null;
  menuItems: MenuItem[];
  dailyPush: DailyPush | null;
  guestNotiz: string;
};

export function PreviewPage({
  open,
  onClose,
  restaurantName,
  slug,
  logoUrl,
  menuItems,
  dailyPush,
  guestNotiz,
}: Props) {
  if (!open) return null;

  const categories = [...new Set(menuItems.map((m) => m.kategorie))];

  return (
    <div
      className="fixed inset-0 z-[150] flex flex-col overflow-y-auto transition-transform duration-300"
      style={{
        backgroundColor: dash.bg,
        transform: open ? "translateX(0)" : "translateX(110%)",
      }}
    >
      <div
        className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: dash.bo, backgroundColor: "rgba(10,10,10,0.95)" }}
      >
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
          style={{ borderColor: dash.bo, color: dash.mi }}
        >
          ← Zurück
        </button>
        <span
          className="rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wider"
          style={{ borderColor: dash.orm, color: dash.or }}
        >
          Vorschau
        </span>
      </div>

      <div className="flex flex-1 flex-col px-5 pb-8 pt-6">
        <div className="mb-4 flex flex-col items-center text-center">
          <div
            className="mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border"
            style={{ borderColor: dash.bo, backgroundColor: dash.s1 }}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-full w-full object-contain" />
            ) : (
              <span className="text-2xl">🍽</span>
            )}
          </div>
          <h1 className="text-xl font-black tracking-tight">{restaurantName}</h1>
          <p className="mt-1 text-[11px]" style={{ color: dash.mu }}>
            qrave.menu/{slug}
          </p>
        </div>

        {dailyPush && (
          <div
            className="mb-4 rounded-2xl border px-4 py-3"
            style={{
              backgroundColor: dash.ord,
              borderColor: dash.orm,
            }}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: dash.or }}>
              Tages-Special
            </div>
            <div className="text-lg font-extrabold">
              {dailyPush.item_emoji} {dailyPush.item_name}
            </div>
            {dailyPush.item_desc && (
              <div className="mt-1 text-xs" style={{ color: dash.mi }}>
                {dailyPush.item_desc}
              </div>
            )}
          </div>
        )}

        {guestNotiz.trim() && (
          <div
            className="mb-4 rounded-xl border px-3 py-2 text-sm"
            style={{ backgroundColor: dash.s1, borderColor: dash.bo }}
          >
            {guestNotiz}
          </div>
        )}

        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <span
              key={cat}
              className="shrink-0 rounded-full border px-3 py-1 text-xs font-semibold"
              style={{ borderColor: dash.bo, color: dash.mi }}
            >
              {cat}
            </span>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          {menuItems.map((m) => (
            <div
              key={m.id}
              className="rounded-xl border px-3 py-2.5"
              style={{
                borderColor: dash.bo,
                backgroundColor: dash.s1,
                opacity: m.aktiv ? 1 : 0.45,
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div
                    className={`font-semibold ${!m.aktiv ? "text-[rgba(249,249,249,0.38)] line-through" : ""}`}
                  >
                    {m.name}
                  </div>
                  {m.beschreibung && (
                    <div className="text-[11px]" style={{ color: dash.mu }}>
                      {m.beschreibung}
                    </div>
                  )}
                  <div className="mt-0.5 text-[10px]" style={{ color: dash.mu }}>
                    {m.kategorie}
                  </div>
                </div>
                <div
                  className="shrink-0 text-sm font-bold"
                  style={{ color: m.aktiv ? dash.or : dash.mu }}
                >
                  {formatPreisEUR(m.preis)}
                </div>
              </div>
              {!m.aktiv && (
                <div className="mt-1 text-[10px] italic" style={{ color: dash.mu }}>
                  Für Gäste ausgeblendet
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-[11px]" style={{ color: dash.mu }}>
          Powered by Qrave
        </p>
      </div>
    </div>
  );
}
