"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buildTableQrUrl } from "@/lib/table-links";
import type { Bereich, Tisch } from "../types";
import { dash, dashPrimaryButtonStyle } from "../constants";

function cloneBereiche(src: Bereich[]): Bereich[] {
  return src.map((b) => ({
    ...b,
    tische: b.tische.map((t) => ({ ...t })),
  }));
}

type Props = {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
  slug: string;
  bereiche: Bereich[];
  onToast: (msg: string) => void;
  onTablesUpdated: () => void;
};

export function TischeConfigPage({
  open,
  onClose,
  restaurantId,
  slug,
  bereiche,
  onToast,
  onTablesUpdated,
}: Props) {
  const [local, setLocal] = useState<Bereich[]>([]);
  const [renamingBereich, setRenamingBereich] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState("");

  useEffect(() => {
    if (!open) return;
    setLocal(cloneBereiche(bereiche));
  }, [open, bereiche]);

  const totalActive = useMemo(
    () => local.reduce((s, b) => s + b.tische.filter((t) => t.active).length, 0),
    [local],
  );

  async function commitBereichRename(oldName: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) {
      setRenamingBereich(null);
      return;
    }
    const { error } = await supabase
      .from("restaurant_tables")
      .update({ bereich: trimmed })
      .eq("restaurant_id", restaurantId)
      .eq("bereich", oldName);
    if (error) {
      onToast(error.message ?? "Bereich umbenennen fehlgeschlagen");
      setRenamingBereich(null);
      return;
    }
    setRenamingBereich(null);
    onToast(`✓ Bereich „${oldName}" → „${trimmed}" umbenannt`);
    onTablesUpdated();
  }

  async function deleteBereich(bereichName: string) {
    if (typeof window !== "undefined") {
      const ok = window.confirm(`Bereich „${bereichName}" mit allen Tischen löschen?`);
      if (!ok) return;
    }
    const { error } = await supabase
      .from("restaurant_tables")
      .delete()
      .eq("restaurant_id", restaurantId)
      .eq("bereich", bereichName);
    if (error) {
      onToast(error.message ?? "Bereich konnte nicht gelöscht werden");
      return;
    }
    onToast(`✓ Bereich „${bereichName}" gelöscht`);
    onTablesUpdated();
  }

  async function deleteTable(tableId: string, tisch_nummer: number) {
    const { error } = await supabase.from("restaurant_tables").delete().eq("id", tableId);
    if (error) {
      onToast(error.message ?? "Tisch konnte nicht gelöscht werden");
      return;
    }
    onToast(`✓ Tisch ${tisch_nummer} gelöscht`);
    onTablesUpdated();
  }

  const persistToggle = useCallback(
    async (tableId: string, nextActive: boolean) => {
      const { error } = await supabase
        .from("restaurant_tables")
        .update({ aktiv: nextActive })
        .eq("id", tableId);
      if (error) {
        onToast(error.message ?? "Speichern fehlgeschlagen");
        onTablesUpdated();
        return;
      }
      onTablesUpdated();
    },
    [onToast, onTablesUpdated],
  );

  /** Höchste Tisch-Nummer im Restaurant +1 — UNIQUE-Constraint
   *  `(restaurant_id, tisch_nummer)` gilt restaurant-weit, nicht
   *  pro Bereich. */
  async function nextTischNummer(): Promise<number> {
    const { data, error } = await supabase
      .from("restaurant_tables")
      .select("tisch_nummer")
      .eq("restaurant_id", restaurantId)
      .order("tisch_nummer", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    const cur = typeof data?.tisch_nummer === "number" ? data.tisch_nummer : 0;
    return cur + 1;
  }

  async function handleAddArea() {
    const raw = typeof window !== "undefined" ? window.prompt("Name des neuen Bereichs") : null;
    const name = raw?.trim();
    if (!name) return;
    let nr: number;
    try {
      nr = await nextTischNummer();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Bereich konnte nicht angelegt werden");
      return;
    }
    const { error } = await supabase.from("restaurant_tables").insert({
      restaurant_id: restaurantId,
      bereich: name,
      tisch_nummer: nr,
      aktiv: true,
      nfc_programmiert: false,
      sticker_angebracht: false,
      qr_url: buildTableQrUrl(slug, nr),
    });
    if (error) {
      onToast(error.message ?? "Bereich konnte nicht angelegt werden");
      return;
    }
    onToast(`✓ Bereich mit Tisch ${nr} angelegt`);
    onTablesUpdated();
  }

  async function handleAddTable(areaLabel: string) {
    let nr: number;
    try {
      nr = await nextTischNummer();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Tisch konnte nicht angelegt werden");
      return;
    }
    const { error } = await supabase.from("restaurant_tables").insert({
      restaurant_id: restaurantId,
      bereich: areaLabel,
      tisch_nummer: nr,
      aktiv: true,
      nfc_programmiert: false,
      sticker_angebracht: false,
      qr_url: buildTableQrUrl(slug, nr),
    });
    if (error) {
      onToast(error.message ?? "Tisch konnte nicht angelegt werden");
      return;
    }
    onToast(`✓ Tisch ${nr} hinzugefügt`);
    onTablesUpdated();
  }

  function toggleTableActive(b: Bereich, t: Tisch) {
    const next = !t.active;
    setLocal((prev) =>
      prev.map((bb) =>
        bb.key !== b.key
          ? bb
          : {
              ...bb,
              tische: bb.tische.map((tt) => (tt.id === t.id ? { ...tt, active: next } : tt)),
            },
      ),
    );
    void persistToggle(t.id, next);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[150] overflow-y-auto transition-transform duration-300"
      style={{
        backgroundColor: dash.bg,
        transform: open ? "translateX(0)" : "translateX(110%)",
      }}
    >
      <div className="dashboard-bg-blobs" aria-hidden>
        <div className="dashboard-blob dashboard-blob--1" />
        <div className="dashboard-blob dashboard-blob--2" />
        <div className="dashboard-blob dashboard-blob--3" />
      </div>
      <div className="relative z-[1] mx-auto w-full max-w-[480px] md:max-w-[860px]">
      <div
        className="sticky top-0 z-10 flex items-center gap-3.5 border-b px-4 py-3 md:px-6"
        style={{
          borderColor: dash.navBorderTop,
          backgroundColor: dash.navBg,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] border"
          style={{ backgroundColor: dash.s1, borderColor: dash.bo }}
          aria-label="Zurück"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="text-lg font-bold">Tische konfigurieren</div>
      </div>

      <div className="px-4 pb-28 pt-4 md:px-6">
        <div
          className="mb-3 flex items-center justify-between rounded-2xl border px-4 py-4"
          style={{ backgroundColor: dash.s1, borderColor: dash.bo }}
        >
          <div>
            <div
              className="mb-1 text-[11px] font-medium uppercase tracking-wider"
              style={{ color: dash.mu }}
            >
              Gesamt aktive Tische
            </div>
            <div className="text-[28px] font-black tracking-tight">{totalActive}</div>
          </div>
          <div className="text-right text-[11px]" style={{ color: dash.gr }}>
            ● {local.length} Bereiche
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleAddArea()}
          className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-[13px] border border-dashed py-3 text-[13px] font-semibold"
          style={{
            borderColor: "rgba(0,200,160,0.35)",
            backgroundColor: dash.s1,
            color: dash.teal,
          }}
        >
          + Neuen Bereich hinzufügen
        </button>
        <p
          className="mb-4 rounded-xl border px-3 py-2 text-[11px] leading-relaxed"
          style={{
            borderColor: "rgba(255,255,255,0.06)",
            backgroundColor: "rgba(255,255,255,0.02)",
            color: dash.mu,
          }}
        >
          QR-Codes und Sticker-Export werden zentral im Founder-Dashboard verwaltet.
        </p>

        {local.length === 0 && (
          <p className="mb-4 text-center text-sm" style={{ color: dash.mu }}>
            Noch keine Tische. Lege einen Bereich mit dem Button oben an.
          </p>
        )}

        {local.map((b) => (
          <div
            key={b.key}
            className="mb-4 overflow-hidden rounded-2xl border"
            style={{ borderColor: dash.bo, backgroundColor: dash.s1 }}
          >
            <div
              className="flex items-center justify-between gap-2 border-b px-4 py-3"
              style={{ borderColor: dash.bo }}
            >
              {renamingBereich === b.label ? (
                <input
                  autoFocus
                  value={renamingValue}
                  onChange={(e) => setRenamingValue(e.target.value)}
                  onBlur={() => void commitBereichRename(b.label, renamingValue)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setRenamingBereich(null);
                  }}
                  className="flex-1 rounded-md border px-2 py-1 text-sm font-bold outline-none"
                  style={{ backgroundColor: dash.s2, borderColor: dash.bo, color: dash.tx }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setRenamingBereich(b.label);
                    setRenamingValue(b.label);
                  }}
                  className="flex flex-1 items-center gap-2 text-left"
                >
                  <span className="text-lg">{b.emoji}</span>
                  <span className="font-bold">{b.label}</span>
                  <span
                    className="ml-1 rounded-md px-2 py-0.5 text-[11px]"
                    style={{ backgroundColor: dash.s2, color: dash.mu }}
                  >
                    {b.tische.length} Tische
                  </span>
                  <span style={{ color: dash.mu, fontSize: 11 }}>✏️</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => void deleteBereich(b.label)}
                className="rounded-md border px-2 py-1 text-[11px] font-bold"
                style={{
                  backgroundColor: "rgba(255,75,110,0.1)",
                  borderColor: "rgba(255,75,110,0.25)",
                  color: dash.re,
                }}
              >
                Bereich löschen
              </button>
            </div>
            <div className="p-3">
              <div className="grid grid-cols-4 gap-2.5">
                {b.tische.map((t) => {
                  const active = t.active;
                  return (
                    <div
                      key={t.id}
                      className="relative flex aspect-square flex-col items-center justify-center rounded-[11px] border text-[11px] font-bold"
                      style={
                        active
                          ? {
                              backgroundColor: dash.ord,
                              borderColor: dash.orm,
                              color: dash.or,
                            }
                          : {
                              backgroundColor: "rgba(255,75,110,0.12)",
                              borderColor: "rgba(255,75,110,0.22)",
                              color: dash.re,
                            }
                      }
                    >
                      <button
                        type="button"
                        onClick={() => toggleTableActive(b, t)}
                        className="flex h-full w-full flex-col items-center justify-center"
                        aria-label={`Tisch ${t.nr} ${active ? "deaktivieren" : "aktivieren"}`}
                      >
                        T{t.nr}
                        <span className="mt-0.5 text-[9px] font-semibold opacity-80">
                          {active ? "aktiv" : "inaktiv"}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteTable(t.id, t.nr)}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                        style={{
                          backgroundColor: "rgba(255,75,110,0.85)",
                          color: "#fff",
                        }}
                        aria-label={`Tisch ${t.nr} löschen`}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => void handleAddTable(b.label)}
                className="mt-3 w-full rounded-lg border py-2 text-[12px] font-semibold"
                style={{ borderColor: dash.bo, color: dash.mi }}
              >
                + Tisch hinzufügen
              </button>
            </div>
          </div>
        ))}
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 z-20 border-t p-4"
        style={{
          borderColor: dash.navBorderTop,
          backgroundColor: dash.navBg,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-[10px] py-3.5 text-[15px] font-bold"
          style={{ ...dashPrimaryButtonStyle, borderRadius: 10 }}
        >
          Fertig
        </button>
      </div>
      </div>
    </div>
  );
}
