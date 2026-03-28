"use client";

import { useMemo, useState } from "react";
import type {
  FounderRestaurantExtRow,
  FounderRestaurantRow,
  FounderScanEventRow,
} from "@/lib/founder-types";
import { FOUNDER_DESKTOP_MEDIA, useMediaQuery } from "@/hooks/useMediaQuery";
import { founderDash, founderGlassCard } from "../constants";

type SavePatch = {
  next_visit: string;
  last_visit: string;
  note: string;
  sticker_tier: string;
  sticker_paid: boolean;
  sticker_count: number;
};

type Props = {
  restaurants: FounderRestaurantRow[];
  scanEvents: FounderScanEventRow[];
  restaurantExtras: FounderRestaurantExtRow[];
  saving: boolean;
  onSaveExt: (restaurantId: string, patch: SavePatch) => Promise<void>;
};

function extForRestaurant(
  extras: FounderRestaurantExtRow[],
  restaurantId: string,
): FounderRestaurantExtRow | undefined {
  return extras.find((e) => e.restaurant_id === restaurantId);
}

export function RestaurantsTab({
  restaurants,
  scanEvents,
  restaurantExtras,
  saving,
  onSaveExt,
}: Props) {
  const isDesktop = useMediaQuery(FOUNDER_DESKTOP_MEDIA);
  const [openId, setOpenId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SavePatch>({
    next_visit: "",
    last_visit: "",
    note: "",
    sticker_tier: "",
    sticker_paid: false,
    sticker_count: 0,
  });

  const scansByRestaurant = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of scanEvents) {
      if (!e.restaurant_id) continue;
      m.set(e.restaurant_id, (m.get(e.restaurant_id) ?? 0) + 1);
    }
    return m;
  }, [scanEvents]);

  function openOverlay(r: FounderRestaurantRow) {
    const ex = extForRestaurant(restaurantExtras, r.id);
    setOpenId(r.id);
    setDraft({
      next_visit: ex?.next_visit ?? "",
      last_visit: ex?.last_visit ?? "",
      note: ex?.note ?? "",
      sticker_tier: ex?.sticker_tier ?? "",
      sticker_paid: ex?.sticker_paid ?? false,
      sticker_count: ex?.sticker_count ?? 0,
    });
  }

  async function submitOverlay() {
    if (!openId) return;
    await onSaveExt(openId, draft);
    setOpenId(null);
  }

  function toggleExpand(id: string) {
    setExpandedId((cur) => (cur === id ? null : id));
  }

  const overlay = openId ? (
    <div
      className="fixed inset-0 z-[300] flex items-end justify-center px-3 backdrop-blur-sm md:items-center"
      style={{ backgroundColor: "rgba(0,0,0,0.72)" }}
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Schließen"
        onClick={() => !saving && setOpenId(null)}
      />
      <div
        className="relative z-10 mb-6 w-full max-w-[430px] p-5 shadow-xl md:mb-0 md:max-w-lg"
        style={{ ...founderGlassCard, background: "rgba(12,14,35,0.92)" }}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="text-base font-extrabold" style={{ color: founderDash.tx }}>
            Restaurant-Notizen
          </h3>
          <button
            type="button"
            disabled={saving}
            onClick={() => setOpenId(null)}
            className="rounded-lg border px-2 py-1 text-xs font-semibold"
            style={{ borderColor: founderDash.bo, color: founderDash.mu }}
          >
            Schließen
          </button>
        </div>
        <label className="block text-xs font-semibold" style={{ color: founderDash.mu }}>
          Nächster Besuch
          <input
            value={draft.next_visit}
            onChange={(e) => setDraft((d) => ({ ...d, next_visit: e.target.value }))}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none"
            style={{ backgroundColor: founderDash.s2, borderColor: founderDash.bo, color: founderDash.tx }}
            placeholder="z. B. 2025-04-01"
          />
        </label>
        <label className="mt-3 block text-xs font-semibold" style={{ color: founderDash.mu }}>
          Letzter Besuch
          <input
            value={draft.last_visit}
            onChange={(e) => setDraft((d) => ({ ...d, last_visit: e.target.value }))}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none"
            style={{ backgroundColor: founderDash.s2, borderColor: founderDash.bo, color: founderDash.tx }}
          />
        </label>
        <label className="mt-3 block text-xs font-semibold" style={{ color: founderDash.mu }}>
          Notiz
          <textarea
            value={draft.note}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
            rows={3}
            className="mt-1 w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none"
            style={{ backgroundColor: founderDash.s2, borderColor: founderDash.bo, color: founderDash.tx }}
          />
        </label>
        <label className="mt-3 block text-xs font-semibold" style={{ color: founderDash.mu }}>
          Sticker-Tier
          <input
            value={draft.sticker_tier}
            onChange={(e) => setDraft((d) => ({ ...d, sticker_tier: e.target.value }))}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none"
            style={{ backgroundColor: founderDash.s2, borderColor: founderDash.bo, color: founderDash.tx }}
          />
        </label>
        <div className="mt-3 flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm" style={{ color: founderDash.tx }}>
            <input
              type="checkbox"
              checked={draft.sticker_paid}
              onChange={(e) => setDraft((d) => ({ ...d, sticker_paid: e.target.checked }))}
              className="h-4 w-4 rounded border"
              style={{ accentColor: founderDash.or }}
            />
            Sticker bezahlt
          </label>
        </div>
        <label className="mt-3 block text-xs font-semibold" style={{ color: founderDash.mu }}>
          Sticker-Anzahl
          <input
            type="number"
            min={0}
            value={draft.sticker_count}
            onChange={(e) =>
              setDraft((d) => ({ ...d, sticker_count: Number.parseInt(e.target.value, 10) || 0 }))
            }
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none"
            style={{ backgroundColor: founderDash.s2, borderColor: founderDash.bo, color: founderDash.tx }}
          />
        </label>
        <button
          type="button"
          disabled={saving}
          onClick={() => void submitOverlay()}
          className="mt-5 w-full rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50"
          style={{
            background: `linear-gradient(135deg, ${founderDash.or}, ${founderDash.or2})`,
          }}
        >
          {saving ? "Speichert …" : "Speichern"}
        </button>
      </div>
    </div>
  ) : null;

  if (isDesktop) {
    return (
      <div className="pb-4">
        <div className="overflow-x-auto rounded-[20px]" style={founderGlassCard}>
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid rgba(255,255,255,0.11)` }}>
                <th className="px-4 py-3 font-bold" style={{ color: founderDash.or }}>
                  Restaurant
                </th>
                <th className="px-4 py-3 font-bold" style={{ color: founderDash.mu }}>
                  Slug
                </th>
                <th className="px-4 py-3 font-bold" style={{ color: founderDash.mu }}>
                  Stadt
                </th>
                <th className="px-4 py-3 font-bold" style={{ color: founderDash.mu }}>
                  Status
                </th>
                <th className="px-4 py-3 font-bold tabular-nums" style={{ color: founderDash.mu }}>
                  Scans 7d
                </th>
                <th className="px-4 py-3 font-bold tabular-nums" style={{ color: founderDash.mu }}>
                  Sticker
                </th>
                <th className="px-4 py-3 font-bold" style={{ color: founderDash.mu }}>
                  Notizen
                </th>
              </tr>
            </thead>
            <tbody>
              {restaurants.map((r) => {
                const ex = extForRestaurant(restaurantExtras, r.id);
                const scans7d = scansByRestaurant.get(r.id) ?? 0;
                return (
                  <tr
                    key={r.id}
                    style={{ borderBottom: `1px solid rgba(255,255,255,0.06)` }}
                    className="transition hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-3 font-semibold" style={{ color: founderDash.tx }}>
                      {r.name}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: founderDash.mi }}>
                      {r.slug}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: founderDash.mi }}>
                      {r.stadt ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase"
                        style={{
                          borderColor: r.aktiv ? founderDash.gr : founderDash.bo,
                          color: r.aktiv ? founderDash.gr : founderDash.mu,
                        }}
                      >
                        {r.aktiv ? "live" : "aus"}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums font-bold" style={{ color: founderDash.tx }}>
                      {scans7d}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-bold" style={{ color: founderDash.tx }}>
                      {ex?.sticker_count ?? r.sticker_anzahl ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openOverlay(r)}
                        className="rounded-lg px-3 py-1.5 text-xs font-bold"
                        style={{
                          border: `1px solid ${founderDash.orm}`,
                          color: founderDash.or,
                          background: founderDash.ord,
                        }}
                      >
                        Öffnen
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {overlay}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-28">
      {restaurants.map((r) => {
        const ex = extForRestaurant(restaurantExtras, r.id);
        const scans7d = scansByRestaurant.get(r.id) ?? 0;
        const expanded = expandedId === r.id;
        return (
          <div key={r.id} style={founderGlassCard} className="overflow-hidden">
            <button
              type="button"
              onClick={() => toggleExpand(r.id)}
              className="flex w-full items-start justify-between gap-2 p-4 text-left transition active:scale-[0.99]"
            >
              <div className="min-w-0">
                <div className="truncate font-bold" style={{ color: founderDash.tx }}>
                  {r.name}
                </div>
                <div className="truncate text-xs" style={{ color: founderDash.mu }}>
                  {r.slug} · {r.stadt ?? "—"}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase"
                  style={{
                    borderColor: r.aktiv ? founderDash.gr : founderDash.bo,
                    color: r.aktiv ? founderDash.gr : founderDash.mu,
                  }}
                >
                  {r.aktiv ? "live" : "aus"}
                </span>
                <span className="text-xs font-bold" style={{ color: founderDash.or }}>
                  {expanded ? "▲" : "▼"}
                </span>
              </div>
            </button>
            {expanded ? (
              <div className="border-t px-4 pb-4 pt-0" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div className="rounded-xl border py-2" style={{ borderColor: founderDash.bo }}>
                    <div style={{ color: founderDash.mu }}>Scans 7d</div>
                    <div className="font-bold tabular-nums" style={{ color: founderDash.tx }}>
                      {scans7d}
                    </div>
                  </div>
                  <div className="rounded-xl border py-2" style={{ borderColor: founderDash.bo }}>
                    <div style={{ color: founderDash.mu }}>Sticker</div>
                    <div className="font-bold tabular-nums" style={{ color: founderDash.tx }}>
                      {ex?.sticker_count ?? r.sticker_anzahl ?? 0}
                    </div>
                  </div>
                  <div className="rounded-xl border py-2" style={{ borderColor: founderDash.bo }}>
                    <div style={{ color: founderDash.mu }}>Besuch</div>
                    <div className="truncate font-bold text-[10px]" style={{ color: founderDash.mi }}>
                      {ex?.next_visit?.trim() || "—"}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openOverlay(r)}
                  className="mt-3 w-full rounded-xl py-2.5 text-xs font-bold text-white"
                  style={{
                    background: `linear-gradient(135deg, ${founderDash.or}, ${founderDash.or2})`,
                  }}
                >
                  Notizen & Sticker
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
      {overlay}
    </div>
  );
}
