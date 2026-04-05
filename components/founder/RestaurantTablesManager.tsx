"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabase";
import type { FounderRestaurantRow, FounderRestaurantTableRow } from "@/lib/founder-types";

const ORANGE = "#FF5C1A";
const ERR_RED = "#FF4B6E";

const inputBase: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 14,
  border: "0.5px solid rgba(255,255,255,0.12)",
  background: "rgba(0,0,0,0.35)",
  color: "rgba(255,255,255,0.92)",
  fontSize: 14,
  outline: "none",
};

const cardBase: CSSProperties = {
  background: "linear-gradient(145deg, #17171f, #141420)",
  borderRadius: 20,
  border: "0.5px solid rgba(255,255,255,0.09)",
  boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
};

function groupTablesByBereich(tables: FounderRestaurantTableRow[]): Map<string, FounderRestaurantTableRow[]> {
  const m = new Map<string, FounderRestaurantTableRow[]>();
  for (const t of tables) {
    const key = t.bereich?.trim() || "Ohne Bereich";
    const arr = m.get(key) ?? [];
    arr.push(t);
    m.set(key, arr);
  }
  for (const arr of m.values()) {
    arr.sort((a, b) => a.tisch_nummer - b.tisch_nummer);
  }
  return new Map([...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "de")));
}

type ConfirmState =
  | { kind: "table"; id: string; label: string }
  | { kind: "area"; bereich: string; count: number }
  | null;

type Props = {
  restaurant: FounderRestaurantRow;
  tables: FounderRestaurantTableRow[];
  isMobile: boolean;
  pending: boolean;
  onRefresh: () => Promise<void>;
  setPending: (v: boolean) => void;
  onSupabaseError: (message: string) => void;
  onClearSupabaseError: () => void;
};

export function RestaurantTablesManager({
  restaurant,
  tables,
  isMobile,
  pending,
  onRefresh,
  setPending,
  onSupabaseError,
  onClearSupabaseError,
}: Props) {
  const [addAreaOpen, setAddAreaOpen] = useState(false);
  const [newBereich, setNewBereich] = useState("");
  const [newCount, setNewCount] = useState("4");
  const [areaSaving, setAreaSaving] = useState(false);
  const [areaFormError, setAreaFormError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const byBereich = useMemo(() => groupTablesByBereich(tables), [tables]);

  useEffect(() => {
    if (!copiedId) return;
    const t = window.setTimeout(() => setCopiedId(null), 2000);
    return () => window.clearTimeout(t);
  }, [copiedId]);

  const runSupabase = useCallback(
    async (op: PromiseLike<{ error: { message: string } | null }>) => {
      onClearSupabaseError();
      setPending(true);
      try {
        const { error } = await Promise.resolve(op);
        if (error) {
          onSupabaseError(error.message);
          return;
        }
        await onRefresh();
      } finally {
        setPending(false);
      }
    },
    [onRefresh, onClearSupabaseError, onSupabaseError, setPending],
  );

  async function submitNewArea() {
    setAreaFormError(null);
    setApiError(null);
    const bereich = newBereich.trim();
    const n = Number.parseInt(newCount, 10);
    if (!bereich) {
      setAreaFormError("Bitte einen Bereichsnamen eingeben.");
      return;
    }
    if (!Number.isFinite(n) || n < 1 || n > 120) {
      setAreaFormError("Anzahl muss zwischen 1 und 120 liegen.");
      return;
    }
    setAreaSaving(true);
    try {
      const res = await fetch("/api/founder/restaurant-tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ restaurantId: restaurant.id, bereich, count: n }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setApiError(j.error ?? `Fehler ${res.status}`);
        return;
      }
      setNewBereich("");
      setNewCount("4");
      setAddAreaOpen(false);
      await onRefresh();
    } catch {
      setApiError("Netzwerkfehler");
    } finally {
      setAreaSaving(false);
    }
  }

  async function deleteTable(id: string) {
    setApiError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/founder/restaurant-tables?tableId=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setApiError(j.error ?? `Fehler ${res.status}`);
        return;
      }
      setConfirm(null);
      await onRefresh();
    } catch {
      setApiError("Netzwerkfehler");
    } finally {
      setPending(false);
    }
  }

  async function deleteArea(bereich: string) {
    setApiError(null);
    setPending(true);
    try {
      const q = new URLSearchParams({ restaurantId: restaurant.id });
      if (bereich === "Ohne Bereich") {
        q.set("emptyBereich", "1");
      } else {
        q.set("bereich", bereich);
      }
      const res = await fetch(`/api/founder/restaurant-tables?${q.toString()}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setApiError(j.error ?? `Fehler ${res.status}`);
        return;
      }
      setConfirm(null);
      await onRefresh();
    } catch {
      setApiError("Netzwerkfehler");
    } finally {
      setPending(false);
    }
  }

  const pad = isMobile ? 16 : 22;

  return (
    <div style={{ ...cardBase, padding: pad }}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.08em",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          TISCHE · BEREICHE
        </p>
        <button
          type="button"
          disabled={pending || areaSaving}
          onClick={() => {
            setAddAreaOpen(true);
            setAreaFormError(null);
            setApiError(null);
          }}
          className="shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold"
          style={{
            border: `1px solid ${ORANGE}`,
            background: "transparent",
            color: ORANGE,
            cursor: pending || areaSaving ? "not-allowed" : "pointer",
          }}
        >
          + Bereich hinzufügen
        </button>
      </div>

      <p className="mb-4 text-xs" style={{ color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
        Pro Bereich legst du die Anzahl Tische fest — die Nummern sind im Restaurant fortlaufend (
        <span style={{ fontFamily: "ui-monospace, monospace" }}>qrave.menu/{restaurant.slug}/tisch-…</span>
        ).
      </p>

      {apiError ? (
        <p className="mb-3 text-xs font-semibold" style={{ color: ERR_RED }}>
          {apiError}
        </p>
      ) : null}

      {tables.length === 0 ? (
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14 }}>Noch keine Tische — Bereich anlegen.</p>
      ) : null}

      <div className="flex flex-col gap-6">
        {[...byBereich.entries()].map(([bereichName, tische]) => (
          <section key={bereichName}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#fff" }}>{bereichName}</h3>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  setConfirm({
                    kind: "area",
                    bereich: bereichName,
                    count: tische.length,
                  })
                }
                className="text-xs font-bold"
                style={{
                  border: "1px solid rgba(239,68,68,0.5)",
                  background: "transparent",
                  color: "#f87171",
                  borderRadius: 10,
                  padding: "6px 12px",
                  cursor: pending ? "not-allowed" : "pointer",
                }}
              >
                Bereich entfernen
              </button>
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0,1fr))" }}>
              {tische.map((tb) => {
                const url = tb.qr_url ?? `https://qrave.menu/${restaurant.slug}/tisch-${tb.tisch_nummer}`;
                return (
                  <div
                    key={tb.id}
                    style={{
                      border: "0.5px solid rgba(255,255,255,0.1)",
                      borderRadius: 16,
                      padding: 14,
                    }}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span style={{ fontWeight: 800, color: "#fff", fontSize: 15 }}>Tisch {tb.tisch_nummer}</span>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            void navigator.clipboard.writeText(url).then(() => setCopiedId(tb.id));
                          }}
                          className="text-xs font-bold"
                          style={{
                            border: `1px solid ${ORANGE}`,
                            background: "transparent",
                            color: ORANGE,
                            borderRadius: 10,
                            padding: "6px 10px",
                            cursor: "pointer",
                          }}
                        >
                          {copiedId === tb.id ? "Kopiert" : "Link kopieren"}
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            setConfirm({
                              kind: "table",
                              id: tb.id,
                              label: `Tisch ${tb.tisch_nummer}`,
                            })
                          }
                          style={{
                            padding: "6px 12px",
                            borderRadius: 10,
                            border: "none",
                            background: "rgba(239,68,68,0.85)",
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
                    <p
                      className="mb-3 break-all font-mono text-[11px]"
                      style={{ color: "rgba(255,255,255,0.35)", margin: "0 0 12px" }}
                    >
                      {url}
                    </p>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
                        <input
                          type="checkbox"
                          checked={tb.nfc_programmiert}
                          disabled={pending}
                          onChange={(e) =>
                            void runSupabase(
                              supabase
                                .from("restaurant_tables")
                                .update({ nfc_programmiert: e.target.checked })
                                .eq("id", tb.id),
                            )
                          }
                          style={{ accentColor: ORANGE }}
                        />
                        NFC
                      </label>
                      <label className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
                        <input
                          type="checkbox"
                          checked={tb.sticker_angebracht}
                          disabled={pending}
                          onChange={(e) =>
                            void runSupabase(
                              supabase
                                .from("restaurant_tables")
                                .update({ sticker_angebracht: e.target.checked })
                                .eq("id", tb.id),
                            )
                          }
                          style={{ accentColor: "#34e89e" }}
                        />
                        Sticker
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {addAreaOpen ? (
        <div
          className="fixed inset-0 z-[130] flex items-end justify-center p-4 sm:items-center"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}
          role="presentation"
          onClick={() => !areaSaving && setAddAreaOpen(false)}
        >
          <div
            role="dialog"
            aria-modal
            aria-labelledby="add-area-title"
            className="w-full max-w-sm"
            style={{ ...cardBase, padding: isMobile ? 16 : 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="add-area-title" style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#fff" }}>
              Bereich anlegen
            </h2>
            <div className="mt-4 flex flex-col gap-3">
              <label className="block text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>
                Bereichsname
                <input
                  value={newBereich}
                  onChange={(e) => setNewBereich(e.target.value)}
                  placeholder="z. B. Drinnen"
                  style={{ ...inputBase, marginTop: 6 }}
                />
              </label>
              <label className="block text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>
                Anzahl Tische
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={newCount}
                  onChange={(e) => setNewCount(e.target.value)}
                  style={{ ...inputBase, marginTop: 6 }}
                />
              </label>
              {areaFormError ? (
                <p className="text-xs font-semibold" style={{ color: ERR_RED }}>
                  {areaFormError}
                </p>
              ) : null}
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={areaSaving}
                onClick={() => setAddAreaOpen(false)}
                className="flex-1 rounded-xl py-3 text-sm font-bold"
                style={{
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.75)",
                  cursor: "pointer",
                }}
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={areaSaving}
                onClick={() => void submitNewArea()}
                className="flex-1 rounded-xl py-3 text-sm font-extrabold"
                style={{
                  border: "none",
                  background: ORANGE,
                  color: "#fff",
                  cursor: areaSaving ? "wait" : "pointer",
                }}
              >
                {areaSaving ? "…" : "Anlegen"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirm ? (
        <div
          className="fixed inset-0 z-[135] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
          role="presentation"
          onClick={() => setConfirm(null)}
        >
          <div
            role="dialog"
            aria-modal
            className="w-full max-w-sm"
            style={{ ...cardBase, padding: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff", lineHeight: 1.4 }}>
              {confirm.kind === "table"
                ? `„${confirm.label}“ wirklich löschen?`
                : `Bereich „${confirm.bereich}“ mit ${confirm.count} Tisch${confirm.count === 1 ? "" : "en"} entfernen?`}
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirm(null)}
                className="flex-1 rounded-xl py-3 text-sm font-bold"
                style={{
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.75)",
                  cursor: "pointer",
                }}
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (confirm.kind === "table") void deleteTable(confirm.id);
                  else void deleteArea(confirm.bereich);
                }}
                className="flex-1 rounded-xl py-3 text-sm font-extrabold"
                style={{
                  border: "none",
                  background: "rgba(239,68,68,0.9)",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
