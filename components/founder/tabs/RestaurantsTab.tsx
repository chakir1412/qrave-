"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type {
  FounderRestaurantExtRow,
  FounderRestaurantRow,
  FounderScanEventRow,
} from "@/lib/founder-types";
import { fp } from "../founder-palette";

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

type UiStatus = "live" | "setup" | "pause";

function extForRestaurant(
  extras: FounderRestaurantExtRow[],
  restaurantId: string,
): FounderRestaurantExtRow | undefined {
  return extras.find((e) => e.restaurant_id === restaurantId);
}

function restaurantUiStatus(r: FounderRestaurantRow): UiStatus {
  const v = r.vertragsstatus;
  if (v === "pausiert" || v === "gekündigt") return "pause";
  if (r.aktiv) return "live";
  return "setup";
}

function statusPillStyle(status: UiStatus): CSSProperties {
  if (status === "live")
    return { background: "rgba(52,232,158,0.14)", color: fp.green, border: `1px solid ${fp.green}44` };
  if (status === "setup")
    return { background: "rgba(255,92,26,0.12)", color: fp.or, border: `1px solid ${fp.or}44` };
  return { background: "rgba(255,255,255,0.06)", color: fp.mu, border: `1px solid ${fp.line}` };
}

function initialLetter(name: string): string {
  const t = name.trim();
  return t ? t[0]!.toUpperCase() : "?";
}

const cardShell: CSSProperties = {
  background: fp.card,
  borderRadius: 16,
  border: `1px solid ${fp.line}`,
  boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
};

const inputStyle: CSSProperties = {
  width: "100%",
  marginTop: 6,
  padding: "10px 12px",
  borderRadius: 10,
  border: `1px solid ${fp.line}`,
  background: "rgba(0,0,0,0.25)",
  color: fp.tx,
  fontSize: 13,
  outline: "none",
};

export function RestaurantsTab({
  restaurants,
  scanEvents,
  restaurantExtras,
  saving,
  onSaveExt,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
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

  const sorted = useMemo(() => {
    return [...restaurants].sort(
      (a, b) => (scansByRestaurant.get(b.id) ?? 0) - (scansByRestaurant.get(a.id) ?? 0),
    );
  }, [restaurants, scansByRestaurant]);

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
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Schließen"
        onClick={() => !saving && setOpenId(null)}
      />
      <div
        className="relative z-10 w-full max-w-md overflow-hidden"
        style={{ ...cardShell, padding: 22 }}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: fp.tx }}>Restaurant-Notizen</h3>
          <button
            type="button"
            disabled={saving}
            onClick={() => setOpenId(null)}
            style={{
              border: `1px solid ${fp.line}`,
              background: "transparent",
              color: fp.mu,
              borderRadius: 8,
              padding: "6px 10px",
              fontSize: 12,
              fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            Schließen
          </button>
        </div>
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: fp.mu }}>
          Nächster Besuch
          <input
            value={draft.next_visit}
            onChange={(e) => setDraft((d) => ({ ...d, next_visit: e.target.value }))}
            style={inputStyle}
            placeholder="z. B. 2026-04-01"
          />
        </label>
        <label style={{ display: "block", marginTop: 12, fontSize: 11, fontWeight: 700, color: fp.mu }}>
          Letzter Besuch
          <input
            value={draft.last_visit}
            onChange={(e) => setDraft((d) => ({ ...d, last_visit: e.target.value }))}
            style={inputStyle}
          />
        </label>
        <label style={{ display: "block", marginTop: 12, fontSize: 11, fontWeight: 700, color: fp.mu }}>
          Notiz
          <textarea
            value={draft.note}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
            rows={3}
            style={{ ...inputStyle, resize: "none" as const }}
          />
        </label>
        <label style={{ display: "block", marginTop: 12, fontSize: 11, fontWeight: 700, color: fp.mu }}>
          Sticker-Tier
          <input
            value={draft.sticker_tier}
            onChange={(e) => setDraft((d) => ({ ...d, sticker_tier: e.target.value }))}
            style={inputStyle}
          />
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 14,
            fontSize: 13,
            color: fp.tx,
          }}
        >
          <input
            type="checkbox"
            checked={draft.sticker_paid}
            onChange={(e) => setDraft((d) => ({ ...d, sticker_paid: e.target.checked }))}
            style={{ width: 18, height: 18, accentColor: fp.or }}
          />
          Sticker bezahlt
        </label>
        <label style={{ display: "block", marginTop: 12, fontSize: 11, fontWeight: 700, color: fp.mu }}>
          Sticker-Anzahl
          <input
            type="number"
            min={0}
            value={draft.sticker_count}
            onChange={(e) =>
              setDraft((d) => ({ ...d, sticker_count: Number.parseInt(e.target.value, 10) || 0 }))
            }
            style={inputStyle}
          />
        </label>
        <button
          type="button"
          disabled={saving}
          onClick={() => void submitOverlay()}
          style={{
            marginTop: 20,
            width: "100%",
            padding: "12px 16px",
            borderRadius: 12,
            border: "none",
            fontWeight: 800,
            fontSize: 14,
            color: "#fff",
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.6 : 1,
            background: `linear-gradient(135deg, ${fp.or}, #ff8c4a)`,
            boxShadow: `0 8px 24px ${fp.or}44`,
          }}
        >
          {saving ? "Speichert …" : "Speichern"}
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-3 pb-6">
      {sorted.map((r) => {
        const ex = extForRestaurant(restaurantExtras, r.id);
        const scans7d = scansByRestaurant.get(r.id) ?? 0;
        const expanded = expandedId === r.id;
        const st = restaurantUiStatus(r);
        const pill = statusPillStyle(st);
        const notePreview = (ex?.note ?? r.notizen ?? "").trim();

        return (
          <div key={r.id} style={{ ...cardShell, overflow: "hidden" }}>
            <button
              type="button"
              onClick={() => toggleExpand(r.id)}
              className="flex w-full items-center gap-4 p-4 text-left"
              style={{ background: "transparent", border: "none", cursor: "pointer", color: "inherit" }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 9999,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  fontWeight: 800,
                  background: "rgba(255,92,26,0.2)",
                  color: fp.or,
                }}
              >
                {initialLetter(r.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div style={{ fontWeight: 800, fontSize: 15, color: fp.tx }}>{r.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span style={{ fontSize: 12, color: fp.mu }}>{r.stadt ?? "—"}</span>
                  <span
                    style={{
                      ...pill,
                      fontSize: 10,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      padding: "3px 10px",
                      borderRadius: 9999,
                    }}
                  >
                    {st}
                  </span>
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: fp.mu, textTransform: "uppercase" }}>
                  Scans/Wo
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: fp.blue, fontVariantNumeric: "tabular-nums" }}>
                  {scans7d}
                </div>
                <div style={{ fontSize: 11, color: fp.or, fontWeight: 700 }}>{expanded ? "▲" : "▼"}</div>
              </div>
            </button>
            {expanded ? (
              <div style={{ borderTop: `1px solid ${fp.line}`, padding: "16px 18px 18px" }}>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    style={{
                      borderRadius: 12,
                      border: `1px solid ${fp.line}`,
                      background: "rgba(0,0,0,0.2)",
                      padding: "12px 14px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 11, color: fp.mu }}>Sticker</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: fp.tx, fontVariantNumeric: "tabular-nums" }}>
                      {ex?.sticker_count ?? r.sticker_anzahl ?? 0}
                    </div>
                  </div>
                  <div
                    style={{
                      borderRadius: 12,
                      border: `1px solid ${fp.line}`,
                      background: "rgba(0,0,0,0.2)",
                      padding: "12px 14px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 11, color: fp.mu }}>Nächster Besuch</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: fp.mi, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {ex?.next_visit?.trim() || "—"}
                    </div>
                  </div>
                </div>
                {notePreview ? (
                  <p style={{ margin: "14px 0 0", fontSize: 13, lineHeight: 1.5, color: fp.mi }}>{notePreview}</p>
                ) : (
                  <p style={{ margin: "14px 0 0", fontSize: 12, fontStyle: "italic", color: fp.mu }}>Keine Notiz</p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openOverlay(r)}
                    style={{
                      flex: 1,
                      minWidth: 120,
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: "none",
                      fontWeight: 800,
                      fontSize: 13,
                      color: "#fff",
                      cursor: "pointer",
                      background: `linear-gradient(135deg, ${fp.or}, #ff8c4a)`,
                      boxShadow: `0 6px 20px ${fp.or}40`,
                    }}
                  >
                    Bearbeiten
                  </button>
                  <a
                    href={`/${r.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: `1px solid ${fp.line}`,
                      fontWeight: 700,
                      fontSize: 13,
                      color: fp.mi,
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    Speisekarte
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
      {overlay}
    </div>
  );
}
