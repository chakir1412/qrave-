"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  supabase,
  type OpeningHours,
  type OpeningHoursDay,
  parseOpeningHours,
} from "@/lib/supabase";
import { dash, dashPrimaryButtonStyle } from "../constants";

type Props = {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
  /** Roh aus DB; null/undefined → Defaults */
  openingHoursFromDb: unknown;
  onOpeningHoursSaved: (hours: OpeningHours) => void;
  onToast: (msg: string) => void;
};

export function OeffnungszeitenOverlay({
  open,
  onClose,
  restaurantId,
  openingHoursFromDb,
  onOpeningHoursSaved,
  onToast,
}: Props) {
  const [rows, setRows] = useState<OpeningHours>(() => parseOpeningHours(openingHoursFromDb));
  const lastSavedJson = useRef<string>(JSON.stringify(parseOpeningHours(openingHoursFromDb)));
  const hoursPropRef = useRef(openingHoursFromDb);
  hoursPropRef.current = openingHoursFromDb;

  useEffect(() => {
    if (!open) return;
    const parsed = parseOpeningHours(hoursPropRef.current);
    setRows(parsed);
    lastSavedJson.current = JSON.stringify(parsed);
  }, [open]);

  const persist = useCallback(
    async (next: OpeningHours) => {
      const key = JSON.stringify(next);
      if (key === lastSavedJson.current) return;
      const { error } = await supabase
        .from("restaurants")
        .update({ opening_hours: next })
        .eq("id", restaurantId);
      if (error) {
        onToast(error.message ?? "Speichern fehlgeschlagen");
        return;
      }
      lastSavedJson.current = key;
      onOpeningHoursSaved(next);
    },
    [restaurantId, onOpeningHoursSaved, onToast],
  );

  useEffect(() => {
    if (!open) return;
    const key = JSON.stringify(rows);
    if (key === lastSavedJson.current) return;
    const t = window.setTimeout(() => {
      void persist(rows);
    }, 400);
    return () => window.clearTimeout(t);
  }, [rows, open, persist]);

  function updateRow(i: number, patch: Partial<OpeningHoursDay>) {
    setRows((prev) => {
      const n = [...prev];
      const cur = n[i];
      if (!cur) return prev;
      n[i] = { ...cur, ...patch };
      return n;
    });
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center backdrop-blur-sm"
      style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="oz-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Schließen"
        onClick={onClose}
      />
      <div
        className="relative z-10 max-h-[92vh] w-full max-w-[480px] overflow-y-auto rounded-t-[24px] border-t px-5 pb-10 pt-4 md:max-w-[860px]"
        style={{ backgroundColor: dash.s1, borderColor: dash.bo }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mx-auto mb-4 h-1 w-9 rounded-full"
          style={{ backgroundColor: dash.s3 }}
        />
        <h2 id="oz-title" className="mb-4 text-xl font-extrabold tracking-tight">
          Öffnungszeiten
        </h2>
        <p className="mb-4 text-xs" style={{ color: dash.mu }}>
          Änderungen werden automatisch gespeichert.
        </p>
        <div className="flex flex-col gap-2">
          {rows.map((row, i) => (
            <div
              key={row.day}
              className="flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5"
              style={{ backgroundColor: dash.s2, borderColor: dash.bo }}
            >
              <span className="w-[34px] shrink-0 text-[13px] font-semibold">{row.day}</span>
              <div className="flex flex-1 items-center gap-1.5">
                <input
                  className="w-14 rounded-md border px-1.5 py-1 text-center text-xs outline-none"
                  style={{
                    backgroundColor: dash.s3,
                    borderColor: dash.bo,
                    color: dash.tx,
                  }}
                  value={row.open}
                  disabled={row.closed}
                  onChange={(e) => updateRow(i, { open: e.target.value })}
                  inputMode="numeric"
                  aria-label={`Öffnung ${row.day}`}
                />
                <span className="text-[11px]" style={{ color: dash.mu }}>
                  –
                </span>
                <input
                  className="w-14 rounded-md border px-1.5 py-1 text-center text-xs outline-none"
                  style={{
                    backgroundColor: dash.s3,
                    borderColor: dash.bo,
                    color: dash.tx,
                  }}
                  value={row.close}
                  disabled={row.closed}
                  onChange={(e) => updateRow(i, { close: e.target.value })}
                  inputMode="numeric"
                  aria-label={`Schließung ${row.day}`}
                />
              </div>
              <button
                type="button"
                onClick={() => updateRow(i, { closed: !row.closed })}
                className="relative h-[22px] w-9 shrink-0 rounded-full transition-colors"
                style={{
                  backgroundColor: !row.closed ? dash.teal : dash.s3,
                }}
                aria-label={row.closed ? `${row.day} geöffnet` : `${row.day} geschlossen`}
              >
                <span
                  className="absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-all"
                  style={{
                    left: !row.closed ? "calc(100% - 19px)" : "3px",
                  }}
                />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-[10px] py-3.5 text-[15px] font-bold"
          style={{ ...dashPrimaryButtonStyle, borderRadius: 10 }}
        >
          Fertig
        </button>
      </div>
    </div>
  );
}
