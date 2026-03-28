"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buildTableQrUrl } from "@/lib/table-links";
import type { Bereich, Tisch } from "../types";
import { dash } from "../constants";

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

  useEffect(() => {
    if (!open) return;
    setLocal(cloneBereiche(bereiche));
  }, [open, bereiche]);

  const totalActive = useMemo(
    () => local.reduce((s, b) => s + b.tische.filter((t) => t.active).length, 0),
    [local],
  );

  const persistToggle = useCallback(
    async (tableId: string, nextActive: boolean) => {
      const { error } = await supabase.from("tables").update({ aktiv: nextActive }).eq("id", tableId);
      if (error) {
        onToast(error.message ?? "Speichern fehlgeschlagen");
        onTablesUpdated();
        return;
      }
      onTablesUpdated();
    },
    [onToast, onTablesUpdated],
  );

  async function handleAddArea() {
    const raw = typeof window !== "undefined" ? window.prompt("Name des neuen Bereichs") : null;
    const name = raw?.trim();
    if (!name) return;
    const { error } = await supabase.from("tables").insert({
      restaurant_id: restaurantId,
      zone: name,
      tisch_nummer: 1,
      aktiv: true,
      nfc_aktiv: false,
      qr_code_url: buildTableQrUrl(slug, 1),
    });
    if (error) {
      onToast(error.message ?? "Bereich konnte nicht angelegt werden");
      return;
    }
    onToast("✓ Bereich mit Tisch 1 angelegt");
    onTablesUpdated();
  }

  async function handleAddTable(areaLabel: string) {
    const block = local.find((b) => b.label === areaLabel);
    const maxNr = block ? Math.max(0, ...block.tische.map((t) => t.nr)) : 0;
    const nextNr = maxNr + 1;
    const { error } = await supabase.from("tables").insert({
      restaurant_id: restaurantId,
      zone: areaLabel,
      tisch_nummer: nextNr,
      aktiv: true,
      nfc_aktiv: false,
      qr_code_url: buildTableQrUrl(slug, nextNr),
    });
    if (error) {
      onToast(error.message ?? "Tisch konnte nicht angelegt werden");
      return;
    }
    onToast(`✓ Tisch ${nextNr} hinzugefügt`);
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
      <div
        className="sticky top-0 z-10 flex items-center gap-3.5 border-b px-5 py-3"
        style={{
          borderColor: dash.bo,
          backgroundColor: "rgba(10,10,10,0.97)",
          backdropFilter: "blur(20px)",
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
            stroke="rgba(249,249,249,0.6)"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="text-lg font-bold">Tische konfigurieren</div>
      </div>

      <div className="px-5 pb-28 pt-4">
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
            borderColor: "rgba(232,80,2,0.3)",
            backgroundColor: dash.s1,
            color: dash.or,
          }}
        >
          + Neuen Bereich hinzufügen
        </button>

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
            <div className="border-b px-4 py-3" style={{ borderColor: dash.bo }}>
              <div className="flex items-center gap-2">
                <span className="text-lg">{b.emoji}</span>
                <span className="font-bold">{b.label}</span>
                <span
                  className="ml-1 rounded-md px-2 py-0.5 text-[11px]"
                  style={{ backgroundColor: dash.s2, color: dash.mu }}
                >
                  {b.tische.length} Tische
                </span>
              </div>
            </div>
            <div className="p-3">
              <div className="grid grid-cols-4 gap-2.5">
                {b.tische.map((t) => {
                  const active = t.active;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTableActive(b, t)}
                      className="flex aspect-square flex-col items-center justify-center rounded-[11px] border text-[11px] font-bold transition active:scale-95"
                      style={
                        active
                          ? {
                              backgroundColor: dash.ord,
                              borderColor: dash.orm,
                              color: dash.or,
                            }
                          : {
                              backgroundColor: "rgba(224,92,92,0.07)",
                              borderColor: "rgba(224,92,92,0.15)",
                              color: dash.re,
                            }
                      }
                    >
                      T{t.nr}
                      <span className="mt-0.5 text-[9px] font-semibold opacity-80">
                        {active ? "aktiv" : "inaktiv"}
                      </span>
                    </button>
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
          borderColor: dash.bo,
          backgroundColor: "rgba(10,10,10,0.95)",
          backdropFilter: "blur(12px)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-[13px] py-3.5 text-[15px] font-bold text-white"
          style={{
            background: `linear-gradient(135deg, ${dash.or}, ${dash.or2})`,
            boxShadow: "0 6px 20px rgba(232,80,2,0.3)",
          }}
        >
          Fertig
        </button>
      </div>
    </div>
  );
}
