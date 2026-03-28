"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabase";
import type {
  FounderRestaurantExtRow,
  FounderRestaurantRow,
  FounderRestaurantTableRow,
  FounderScanEventRow,
} from "@/lib/founder-types";
import { fp } from "../founder-palette";

type UiStatus = "live" | "setup" | "pause";

type Draft = {
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
  restaurantTables: FounderRestaurantTableRow[];
  isMobile: boolean;
  onRefresh: () => Promise<void>;
};

const STICKER_TIERS = [
  { key: "starter", label: "Starter" },
  { key: "studio", label: "Studio" },
  { key: "pro", label: "Pro" },
] as const;

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
  restaurantTables,
  isMobile,
  onRefresh,
}: Props) {
  const [section, setSection] = useState<"liste" | "tische">("liste");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draftById, setDraftById] = useState<Record<string, Draft>>({});
  const [pending, setPending] = useState(false);
  const [tableRestaurantId, setTableRestaurantId] = useState<string>(() => restaurants[0]?.id ?? "");
  const [newTischNr, setNewTischNr] = useState("");
  const [newBereich, setNewBereich] = useState("");

  useEffect(() => {
    if (restaurants.length > 0 && !restaurants.some((r) => r.id === tableRestaurantId)) {
      setTableRestaurantId(restaurants[0]!.id);
    }
  }, [restaurants, tableRestaurantId]);

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

  const tablesForRestaurant = useMemo(() => {
    return restaurantTables.filter((t) => t.restaurant_id === tableRestaurantId).sort((a, b) => a.tisch_nummer - b.tisch_nummer);
  }, [restaurantTables, tableRestaurantId]);

  const run = useCallback(
    async (op: PromiseLike<{ error: { message: string } | null }>) => {
      setPending(true);
      try {
        const { error } = await Promise.resolve(op);
        if (error) {
          window.alert(error.message);
          return;
        }
        await onRefresh();
      } finally {
        setPending(false);
      }
    },
    [onRefresh],
  );

  function openDraft(r: FounderRestaurantRow) {
    const ex = extForRestaurant(restaurantExtras, r.id);
    const d: Draft = {
      next_visit: ex?.next_visit ?? "",
      last_visit: ex?.last_visit ?? "",
      note: ex?.note ?? r.notizen ?? "",
      sticker_tier: (ex?.sticker_tier ?? "").toLowerCase() || "starter",
      sticker_paid: ex?.sticker_paid ?? false,
      sticker_count: ex?.sticker_count ?? r.sticker_anzahl ?? 0,
    };
    setDraftById((prev) => ({ ...prev, [r.id]: d }));
    setExpandedId((cur) => (cur === r.id ? null : r.id));
  }

  function setDraft(restaurantId: string, patch: Partial<Draft>) {
    setDraftById((prev) => ({
      ...prev,
      [restaurantId]: { ...prev[restaurantId]!, ...patch },
    }));
  }

  const pad = isMobile ? 14 : 18;

  const subNav = (
    <div className="flex gap-2" style={{ marginBottom: 16 }}>
      {(
        [
          { id: "liste" as const, label: "Restaurants" },
          { id: "tische" as const, label: "Tische" },
        ] as const
      ).map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => setSection(s.id)}
          style={{
            padding: "10px 18px",
            borderRadius: 12,
            border: `1px solid ${section === s.id ? fp.or : fp.line}`,
            background: section === s.id ? "rgba(255,92,26,0.12)" : "transparent",
            color: section === s.id ? fp.or : fp.mu,
            fontWeight: 800,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );

  if (section === "tische") {
    return (
      <div className="pb-6">
        {subNav}
        <div style={{ ...cardShell, padding: pad }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: fp.mu }}>
            Restaurant
            <select
              value={tableRestaurantId}
              onChange={(e) => setTableRestaurantId(e.target.value)}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: fp.mu }}>
              Tisch-Nummer
              <input
                type="number"
                min={1}
                value={newTischNr}
                onChange={(e) => setNewTischNr(e.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={{ fontSize: 11, fontWeight: 700, color: fp.mu }}>
              Bereich
              <input value={newBereich} onChange={(e) => setNewBereich(e.target.value)} style={inputStyle} />
            </label>
          </div>
          <button
            type="button"
            disabled={pending || !tableRestaurantId}
            onClick={() => {
              const n = Number.parseInt(newTischNr, 10);
              if (!Number.isFinite(n) || n < 1) {
                window.alert("Bitte gültige Tisch-Nummer eingeben.");
                return;
              }
              void run(
                supabase.from("restaurant_tables").insert({
                  restaurant_id: tableRestaurantId,
                  tisch_nummer: n,
                  bereich: newBereich.trim() || null,
                }),
              ).then(() => {
                setNewTischNr("");
                setNewBereich("");
              });
            }}
            style={{
              marginTop: 14,
              padding: "10px 16px",
              borderRadius: 12,
              border: "none",
              fontWeight: 800,
              fontSize: 13,
              color: "#fff",
              cursor: pending ? "not-allowed" : "pointer",
              background: `linear-gradient(135deg, ${fp.or}, #ff8c4a)`,
            }}
          >
            Tisch hinzufügen
          </button>

          <div className="flex flex-wrap gap-2" style={{ marginTop: 10 }}>
            <button
              type="button"
              disabled={pending || tablesForRestaurant.length === 0}
              onClick={() => {
                const lines = tablesForRestaurant.map((t) => t.qr_url ?? "").filter(Boolean);
                void navigator.clipboard.writeText(lines.join("\n"));
              }}
              style={{
                padding: "10px 16px",
                borderRadius: 12,
                border: `1px solid ${fp.line}`,
                fontWeight: 700,
                fontSize: 13,
                color: fp.mi,
                cursor: pending || tablesForRestaurant.length === 0 ? "not-allowed" : "pointer",
                background: "rgba(255,255,255,0.04)",
              }}
            >
              Alle QR-URLs kopieren
            </button>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            {tablesForRestaurant.length === 0 ? (
              <p style={{ color: fp.mu, fontSize: 13 }}>Keine Tische für dieses Restaurant.</p>
            ) : null}
            {tablesForRestaurant.map((tb) => (
              <div
                key={tb.id}
                style={{
                  border: `1px solid ${fp.line}`,
                  borderRadius: 12,
                  padding: 12,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div className="min-w-0">
                  <div style={{ fontWeight: 800, color: fp.tx }}>
                    Tisch {tb.tisch_nummer}
                    {tb.bereich ? (
                      <span style={{ color: fp.mu, fontWeight: 600 }}> · {tb.bereich}</span>
                    ) : null}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: fp.mi,
                      marginTop: 4,
                      wordBreak: "break-all",
                    }}
                  >
                    {tb.qr_url ?? "—"}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: fp.mi }}>
                    <input
                      type="checkbox"
                      checked={tb.nfc_programmiert}
                      disabled={pending}
                      onChange={(e) =>
                        void run(
                          supabase
                            .from("restaurant_tables")
                            .update({ nfc_programmiert: e.target.checked })
                            .eq("id", tb.id),
                        )
                      }
                      style={{ accentColor: fp.or }}
                    />
                    NFC
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: fp.mi }}>
                    <input
                      type="checkbox"
                      checked={tb.sticker_angebracht}
                      disabled={pending}
                      onChange={(e) =>
                        void run(
                          supabase
                            .from("restaurant_tables")
                            .update({ sticker_angebracht: e.target.checked })
                            .eq("id", tb.id),
                        )
                      }
                      style={{ accentColor: fp.green }}
                    />
                    Sticker
                  </label>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void run(supabase.from("restaurant_tables").delete().eq("id", tb.id))}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: fp.red,
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Löschen
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-6">
      {subNav}
      {sorted.map((r) => {
        const scans7d = scansByRestaurant.get(r.id) ?? 0;
        const expanded = expandedId === r.id;
        const st = restaurantUiStatus(r);
        const pill = statusPillStyle(st);
        const draft = draftById[r.id];

        return (
          <div key={r.id} style={{ ...cardShell, overflow: "hidden", padding: 0 }}>
            <button
              type="button"
              onClick={() => {
                if (!expanded) openDraft(r);
                else setExpandedId(null);
              }}
              className="flex w-full items-center gap-4 text-left"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "inherit",
                padding: pad,
              }}
            >
              <div
                style={{
                  width: isMobile ? 44 : 48,
                  height: isMobile ? 44 : 48,
                  borderRadius: 9999,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: isMobile ? 16 : 18,
                  fontWeight: 800,
                  background: "rgba(255,92,26,0.2)",
                  color: fp.or,
                }}
              >
                {initialLetter(r.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div style={{ fontWeight: 800, fontSize: isMobile ? 14 : 15, color: fp.tx }}>{r.name}</div>
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
                <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, color: fp.blue, fontVariantNumeric: "tabular-nums" }}>
                  {scans7d}
                </div>
                <div style={{ fontSize: 11, color: fp.or, fontWeight: 700 }}>{expanded ? "▲" : "▼"}</div>
              </div>
            </button>
            {expanded && draft ? (
              <div style={{ borderTop: `1px solid ${fp.line}`, padding: pad }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: fp.mu }}>
                  Nächster Besuch
                  <input
                    value={draft.next_visit}
                    onChange={(e) => setDraft(r.id, { next_visit: e.target.value })}
                    style={inputStyle}
                  />
                </label>
                <label style={{ display: "block", marginTop: 12, fontSize: 11, fontWeight: 700, color: fp.mu }}>
                  Letzter Besuch
                  <input
                    value={draft.last_visit}
                    onChange={(e) => setDraft(r.id, { last_visit: e.target.value })}
                    style={inputStyle}
                  />
                </label>
                <label style={{ display: "block", marginTop: 12, fontSize: 11, fontWeight: 700, color: fp.mu }}>
                  Notiz
                  <textarea
                    value={draft.note}
                    onChange={(e) => setDraft(r.id, { note: e.target.value })}
                    rows={3}
                    style={{ ...inputStyle, resize: "none" as const }}
                  />
                </label>
                <p style={{ margin: "14px 0 6px", fontSize: 11, fontWeight: 700, color: fp.mu }}>Sticker-Tier</p>
                <div className="flex flex-wrap gap-2">
                  {STICKER_TIERS.map((tier) => (
                    <button
                      key={tier.key}
                      type="button"
                      onClick={() => setDraft(r.id, { sticker_tier: tier.key })}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 10,
                        border: `1px solid ${draft.sticker_tier === tier.key ? fp.or : fp.line}`,
                        background: draft.sticker_tier === tier.key ? "rgba(255,92,26,0.12)" : "transparent",
                        color: draft.sticker_tier === tier.key ? fp.or : fp.mi,
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      {tier.label}
                    </button>
                  ))}
                </div>
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
                    onChange={(e) => setDraft(r.id, { sticker_paid: e.target.checked })}
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
                      setDraft(r.id, { sticker_count: Number.parseInt(e.target.value, 10) || 0 })
                    }
                    style={inputStyle}
                  />
                </label>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      void run(
                        supabase.from("founder_restaurants").upsert(
                          {
                            restaurant_id: r.id,
                            next_visit: draft.next_visit.trim() || null,
                            last_visit: draft.last_visit.trim() || null,
                            note: draft.note.trim() || null,
                            sticker_tier: draft.sticker_tier.trim() || null,
                            sticker_paid: draft.sticker_paid,
                            sticker_count: draft.sticker_count,
                            updated_at: new Date().toISOString(),
                          },
                          { onConflict: "restaurant_id" },
                        ),
                      )
                    }
                    style={{
                      flex: 1,
                      minWidth: 140,
                      padding: "12px 16px",
                      borderRadius: 12,
                      border: "none",
                      fontWeight: 800,
                      fontSize: 14,
                      color: "#fff",
                      cursor: pending ? "not-allowed" : "pointer",
                      background: `linear-gradient(135deg, ${fp.or}, #ff8c4a)`,
                      boxShadow: `0 6px 20px ${fp.or}40`,
                    }}
                  >
                    Speichern
                  </button>
                  <a
                    href={`/${r.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: "12px 16px",
                      borderRadius: 12,
                      border: `1px solid ${fp.line}`,
                      fontWeight: 700,
                      fontSize: 13,
                      color: fp.mi,
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
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
    </div>
  );
}
