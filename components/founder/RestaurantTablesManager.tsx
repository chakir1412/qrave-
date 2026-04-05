"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { FounderRestaurantRow, FounderRestaurantTableRow } from "@/lib/founder-types";

const ORANGE = "#FF5C1A";
const ERR_RED = "#FF4B6E";
const GREEN = "#34E89E";
const GRAY_ICON = "rgba(255,255,255,0.28)";

const cardBase: CSSProperties = {
  background: "linear-gradient(145deg, #17171f, #141420)",
  borderRadius: 20,
  border: "0.5px solid rgba(255,255,255,0.09)",
  boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
};

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
  | { kind: "bulk"; ids: string[] }
  | null;

type RenameState = {
  displayKey: string;
  oldIsNull: boolean;
  oldBereichEq: string;
  input: string;
};

type AddToAreaState = { displayKey: string; bereichDb: string; isNull: boolean };

function IconNfc({ on, size = 14 }: { on: boolean; size?: number }) {
  const c = on ? GREEN : GRAY_ICON;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 12a4 4 0 018 0M6 10a6 6 0 0112 0M4 8a8 8 0 0116 0"
        stroke={c}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconSticker({ on, size = 14 }: { on: boolean; size?: number }) {
  const c = on ? GREEN : GRAY_ICON;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 4h10l6 6v10a2 2 0 01-2 2H4V4z"
        stroke={c}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <path d="M14 4v6h6" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AreaSelectAllCheckbox({
  allSelected,
  someSelected,
  disabled,
  onToggle,
}: {
  allSelected: boolean;
  someSelected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.indeterminate = !allSelected && someSelected;
  }, [allSelected, someSelected]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={allSelected}
      disabled={disabled}
      onChange={onToggle}
      style={{ accentColor: ORANGE, width: 14, height: 14 }}
    />
  );
}

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [menuTableId, setMenuTableId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [addToArea, setAddToArea] = useState<AddToAreaState | null>(null);
  const [addToAreaCount, setAddToAreaCount] = useState("2");
  const [addToAreaSaving, setAddToAreaSaving] = useState(false);
  const [rename, setRename] = useState<RenameState | null>(null);
  const [toggleBusyId, setToggleBusyId] = useState<string | null>(null);

  const byBereich = useMemo(() => groupTablesByBereich(tables), [tables]);
  const bereichNames = useMemo(() => [...byBereich.keys()], [byBereich]);
  const selCount = selectedIds.size;
  const selectionMode = selCount > 0;

  useEffect(() => {
    const valid = new Set(tables.map((t) => t.id));
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [tables]);

  useEffect(() => {
    if (!menuTableId) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenuTableId(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuTableId]);

  async function apiPost(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch("/api/founder/restaurant-tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    const j = (await res.json()) as { error?: string };
    if (!res.ok) {
      return { ok: false, error: j.error ?? `Fehler ${res.status}` };
    }
    return { ok: true };
  }

  async function apiToggleStatus(tischId: string, field: "nfc_installiert" | "sticker_installiert") {
    onClearSupabaseError();
    setToggleBusyId(`${tischId}:${field}`);
    try {
      const res = await fetch("/api/founder/restaurant-tables", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "toggleStatus", tischId, field }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        onSupabaseError(j.error ?? `Fehler ${res.status}`);
        return;
      }
      await onRefresh();
    } catch {
      onSupabaseError("Netzwerkfehler");
    } finally {
      setToggleBusyId(null);
    }
  }

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
      const r = await apiPost({ restaurantId: restaurant.id, bereich, count: n });
      if (!r.ok) {
        setApiError(r.error ?? "Fehler");
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

  async function submitAddToExistingArea() {
    if (!addToArea) return;
    setAreaFormError(null);
    setApiError(null);
    const n = Number.parseInt(addToAreaCount, 10);
    if (!Number.isFinite(n) || n < 1 || n > 120) {
      setAreaFormError("Anzahl muss zwischen 1 und 120 liegen.");
      return;
    }
    if (!addToArea.isNull && !addToArea.bereichDb.trim()) {
      setAreaFormError("Ungültiger Bereich.");
      return;
    }
    setAddToAreaSaving(true);
    try {
      const r = await apiPost(
        addToArea.isNull
          ? { restaurantId: restaurant.id, bereichNull: true, count: n }
          : { restaurantId: restaurant.id, bereich: addToArea.bereichDb.trim(), count: n },
      );
      if (!r.ok) {
        setApiError(r.error ?? "Fehler");
        return;
      }
      setAddToArea(null);
      setAddToAreaCount("2");
      await onRefresh();
    } catch {
      setApiError("Netzwerkfehler");
    } finally {
      setAddToAreaSaving(false);
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
      setMenuTableId(null);
      setSelectedIds((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      await onRefresh();
    } catch {
      setApiError("Netzwerkfehler");
    } finally {
      setPending(false);
    }
  }

  async function deleteBulk(ids: string[]) {
    setApiError(null);
    setPending(true);
    try {
      const r = await apiPost({ action: "deleteMany", tableIds: ids });
      if (!r.ok) {
        setApiError(r.error ?? "Fehler");
        return;
      }
      setConfirm(null);
      setSelectedIds(new Set());
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

  async function moveTable(tableId: string, targetDisplay: string) {
    setApiError(null);
    const bereich = targetDisplay === "Ohne Bereich" ? null : targetDisplay;
    setMenuTableId(null);
    setPending(true);
    try {
      const r = await apiPost({ action: "move", tableId, bereich });
      if (!r.ok) {
        setApiError(r.error ?? "Fehler");
        return;
      }
      await onRefresh();
    } catch {
      setApiError("Netzwerkfehler");
    } finally {
      setPending(false);
    }
  }

  async function saveRename() {
    if (!rename) return;
    const next = rename.input.trim();
    if (!next) {
      if (rename.oldIsNull) {
        setRename(null);
      } else {
        setApiError("Bereichsname darf nicht leer sein.");
      }
      return;
    }
    if (next === rename.displayKey) {
      setRename(null);
      return;
    }
    setApiError(null);
    setPending(true);
    try {
      const r = await apiPost({
        action: "renameArea",
        restaurantId: restaurant.id,
        newBereich: next,
        oldBereichIsNull: rename.oldIsNull,
        ...(rename.oldIsNull ? {} : { oldBereich: rename.oldBereichEq }),
      });
      if (!r.ok) {
        setApiError(r.error ?? "Fehler");
        return;
      }
      setRename(null);
      await onRefresh();
    } catch {
      setApiError("Netzwerkfehler");
    } finally {
      setPending(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleSelectAllInArea(tische: FounderRestaurantTableRow[]) {
    const ids = tische.map((t) => t.id);
    const allOn = ids.length > 0 && ids.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (allOn) {
        for (const id of ids) n.delete(id);
      } else {
        for (const id of ids) n.add(id);
      }
      return n;
    });
  }

  function moveTargetsFor(currentDisplay: string): string[] {
    return bereichNames.filter((b) => b !== currentDisplay);
  }

  const pad = isMobile ? 16 : 22;

  const gridCols = isMobile ? "grid-cols-3" : "sm:grid-cols-4 lg:grid-cols-6";

  return (
    <div className={selCount > 0 ? "pb-24" : undefined} style={{ ...cardBase, padding: pad }}>
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

      <p className="mb-4 text-xs" style={{ color: "rgba(255,255,255,0.38)", lineHeight: 1.5 }}>
        Kompakte Kacheln · Hover für Link & Menü · Klick auf NFC-/Sticker-Icon schaltet den Status.
      </p>

      {apiError ? (
        <p className="mb-3 text-xs font-semibold" style={{ color: ERR_RED }}>
          {apiError}
        </p>
      ) : null}

      {tables.length === 0 ? (
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14 }}>Noch keine Tische — Bereich anlegen.</p>
      ) : null}

      <div className="flex flex-col gap-8">
        {[...byBereich.entries()].map(([bereichName, tische]) => {
          const allSelected = tische.length > 0 && tische.every((t) => selectedIds.has(t.id));
          const someSelected = tische.some((t) => selectedIds.has(t.id));
          const isRenaming = rename?.displayKey === bereichName;
          const dbNull = bereichName === "Ohne Bereich";

          return (
            <section key={bereichName}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-2">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                  {isRenaming ? (
                    <input
                      autoFocus
                      value={rename.input}
                      onChange={(e) => setRename((r) => (r ? { ...r, input: e.target.value } : r))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void saveRename();
                        if (e.key === "Escape") setRename(null);
                      }}
                      onBlur={() => void saveRename()}
                      className="max-w-[200px] rounded-lg px-2 py-1 text-sm font-bold text-white"
                      style={{ ...inputBase, margin: 0 }}
                    />
                  ) : (
                    <h3 className="text-sm font-bold tracking-wide" style={{ color: "rgba(255,255,255,0.88)" }}>
                      {bereichName}
                    </h3>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                  <label className="flex cursor-pointer items-center gap-1.5 font-semibold">
                    <AreaSelectAllCheckbox
                      allSelected={allSelected}
                      someSelected={someSelected}
                      disabled={pending}
                      onToggle={() => toggleSelectAllInArea(tische)}
                    />
                    Alle auswählen
                  </label>
                  {!isRenaming ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        setRename({
                          displayKey: bereichName,
                          oldIsNull: dbNull,
                          oldBereichEq: bereichName,
                          input: dbNull ? "" : bereichName,
                        })
                      }
                      className="font-semibold"
                      style={{ color: "rgba(255,255,255,0.5)", background: "none", border: "none", cursor: "pointer" }}
                    >
                      Umbenennen
                    </button>
                  ) : null}
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
                    className="font-semibold"
                    style={{ color: "rgba(248,113,113,0.85)", background: "none", border: "none", cursor: "pointer" }}
                  >
                    Bereich entfernen
                  </button>
                </div>
              </div>

              <div className={`grid justify-items-start gap-2 ${gridCols}`}>
                {tische.map((tb) => {
                  const url = tb.qr_url ?? `https://qrave.menu/${restaurant.slug}/tisch-${tb.tisch_nummer}`;
                  const checked = selectedIds.has(tb.id);
                  const moveTargets = moveTargetsFor(bereichName);
                  const busy = toggleBusyId != null && toggleBusyId.startsWith(`${tb.id}:`);
                  const nfcOn = Boolean(tb.nfc_installiert);
                  const stickerOn = Boolean(tb.sticker_installiert);

                  return (
                    <div
                      key={tb.id}
                      className="group/tile relative box-border h-20 w-full max-w-[80px] shrink-0"
                      style={{
                        borderRadius: 12,
                        border: checked ? `2px solid ${ORANGE}` : "1px solid rgba(255,255,255,0.08)",
                        background: "rgba(255,255,255,0.05)",
                        boxShadow: checked ? `0 0 14px rgba(255,92,26,0.28)` : "none",
                        transition: "background 0.15s, border-color 0.15s, box-shadow 0.15s",
                      }}
                    >
                      <div
                        className="absolute inset-0 rounded-[11px] transition-colors group-hover/tile:bg-white/[0.07]"
                        aria-hidden
                      />

                      <label
                        className={`absolute left-1 top-1 z-20 cursor-pointer ${selectionMode ? "opacity-100" : "opacity-0 group-hover/tile:opacity-100"}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={pending}
                          onChange={() => toggleSelect(tb.id)}
                          style={{ accentColor: ORANGE, width: 14, height: 14 }}
                        />
                      </label>

                      <div className="relative z-0 flex h-full flex-col items-center justify-center px-1 pb-1 pt-4">
                        <span className="text-lg font-extrabold tabular-nums leading-none text-white">{tb.tisch_nummer}</span>
                        <div className="mt-1 flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={pending || busy}
                            title="NFC"
                            className="rounded p-0.5"
                            style={{ border: "none", background: "transparent", cursor: busy ? "wait" : "pointer" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              void apiToggleStatus(tb.id, "nfc_installiert");
                            }}
                          >
                            <IconNfc on={nfcOn} />
                          </button>
                          <button
                            type="button"
                            disabled={pending || busy}
                            title="Sticker"
                            className="rounded p-0.5"
                            style={{ border: "none", background: "transparent", cursor: busy ? "wait" : "pointer" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              void apiToggleStatus(tb.id, "sticker_installiert");
                            }}
                          >
                            <IconSticker on={stickerOn} />
                          </button>
                        </div>
                      </div>

                      <div
                        className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-1 rounded-[11px] bg-black/55 opacity-0 transition-opacity group-hover/tile:pointer-events-auto group-hover/tile:opacity-100"
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        <button
                          type="button"
                          disabled={pending}
                          className="rounded-md px-1.5 py-1 text-[10px] font-extrabold text-white"
                          style={{ border: "1px solid rgba(255,255,255,0.25)", background: "rgba(0,0,0,0.35)" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            void navigator.clipboard.writeText(url);
                          }}
                        >
                          🔗 Link
                        </button>
                        <div className="relative" ref={menuTableId === tb.id ? menuRef : undefined}>
                          <button
                            type="button"
                            disabled={pending}
                            className="rounded-md px-2 py-1 text-sm font-bold text-white"
                            style={{ border: "1px solid rgba(255,255,255,0.25)", background: "rgba(0,0,0,0.35)" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuTableId((id) => (id === tb.id ? null : tb.id));
                            }}
                          >
                            ⋮
                          </button>
                          {menuTableId === tb.id ? (
                            <div
                              className="absolute left-1/2 top-full z-[60] mt-1 min-w-[168px] -translate-x-1/2 rounded-lg py-1 shadow-xl"
                              style={{
                                background: "#25252f",
                                border: "0.5px solid rgba(255,255,255,0.12)",
                              }}
                            >
                              <p className="px-2 py-1 text-[9px] font-extrabold tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>
                                VERSCHIEBEN
                              </p>
                              {moveTargets.map((name) => (
                                <button
                                  key={name}
                                  type="button"
                                  className="block w-full px-2 py-1.5 text-left text-xs font-semibold text-white"
                                  style={{ border: "none", background: "transparent", cursor: "pointer" }}
                                  onClick={() => void moveTable(tb.id, name)}
                                >
                                  {name}
                                </button>
                              ))}
                              {!dbNull ? (
                                <button
                                  type="button"
                                  className="block w-full px-2 py-1.5 text-left text-xs font-semibold"
                                  style={{
                                    color: "rgba(255,255,255,0.55)",
                                    border: "none",
                                    borderTop: "0.5px solid rgba(255,255,255,0.08)",
                                    background: "transparent",
                                    cursor: "pointer",
                                  }}
                                  onClick={() => void moveTable(tb.id, "Ohne Bereich")}
                                >
                                  Ohne Bereich
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="block w-full px-2 py-1.5 text-left text-xs font-bold"
                                style={{
                                  color: "#f87171",
                                  border: "none",
                                  borderTop: "0.5px solid rgba(255,255,255,0.08)",
                                  background: "transparent",
                                  cursor: "pointer",
                                }}
                                onClick={() => {
                                  setMenuTableId(null);
                                  setConfirm({ kind: "table", id: tb.id, label: `Tisch ${tb.tisch_nummer}` });
                                }}
                              >
                                Löschen
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={pending || areaSaving}
                onClick={() => {
                  setAddToArea({
                    displayKey: bereichName,
                    bereichDb: bereichName,
                    isNull: dbNull,
                  });
                  setAddToAreaCount("2");
                  setAreaFormError(null);
                  setApiError(null);
                }}
                className="mt-2 text-[11px] font-semibold"
                style={{ color: ORANGE, background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                + Tische hinzufügen
              </button>
            </section>
          );
        })}
      </div>

      {selCount > 0 ? (
        <div
          className="fixed bottom-4 left-1/2 z-[125] flex max-w-[calc(100vw-24px)] -translate-x-1/2 flex-wrap items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl"
          style={{
            background: "linear-gradient(145deg, #22222c, #1a1a24)",
            border: "0.5px solid rgba(255,255,255,0.12)",
          }}
        >
          <span className="text-sm font-bold text-white">{selCount} Tische ausgewählt</span>
          <span style={{ color: "rgba(255,255,255,0.25)" }}>·</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirm({ kind: "bulk", ids: [...selectedIds] })}
            className="text-sm font-extrabold"
            style={{ color: "#f87171", background: "none", border: "none", cursor: "pointer" }}
          >
            Löschen
          </button>
          <span style={{ color: "rgba(255,255,255,0.25)" }}>·</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => setSelectedIds(new Set())}
            className="text-sm font-bold"
            style={{ color: "rgba(255,255,255,0.65)", background: "none", border: "none", cursor: "pointer" }}
          >
            Abbrechen
          </button>
        </div>
      ) : null}

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

      {addToArea ? (
        <div
          className="fixed inset-0 z-[130] flex items-end justify-center p-4 sm:items-center"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}
          role="presentation"
          onClick={() => !addToAreaSaving && setAddToArea(null)}
        >
          <div
            role="dialog"
            aria-modal
            className="w-full max-w-sm"
            style={{ ...cardBase, padding: isMobile ? 16 : 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#fff" }}>Tische hinzufügen</h2>
            <p className="mt-2 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
              Bereich: <strong style={{ color: "#fff" }}>{addToArea.displayKey}</strong>
            </p>
            <label className="mt-4 block text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>
              Anzahl
              <input
                type="number"
                min={1}
                max={120}
                value={addToAreaCount}
                onChange={(e) => setAddToAreaCount(e.target.value)}
                style={{ ...inputBase, marginTop: 6 }}
              />
            </label>
            {areaFormError ? (
              <p className="mt-2 text-xs font-semibold" style={{ color: ERR_RED }}>
                {areaFormError}
              </p>
            ) : null}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={addToAreaSaving}
                onClick={() => setAddToArea(null)}
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
                disabled={addToAreaSaving}
                onClick={() => void submitAddToExistingArea()}
                className="flex-1 rounded-xl py-3 text-sm font-extrabold"
                style={{
                  border: "none",
                  background: ORANGE,
                  color: "#fff",
                  cursor: addToAreaSaving ? "wait" : "pointer",
                }}
              >
                {addToAreaSaving ? "…" : "Hinzufügen"}
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
                : confirm.kind === "bulk"
                  ? `${confirm.ids.length} Tische wirklich löschen?`
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
                  else if (confirm.kind === "bulk") void deleteBulk(confirm.ids);
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
