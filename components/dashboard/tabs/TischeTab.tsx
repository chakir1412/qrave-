"use client";

import { useEffect, useMemo, useState } from "react";
import type { Bereich } from "../types";
import { heatFromScans } from "../types";
import { dash } from "../constants";

type Props = {
  slideClass: string;
  bereiche: Bereich[];
  loading?: boolean;
  loadError?: string | null;
  onOpenConfig: () => void;
  onToast: (msg: string) => void;
};

export function TischeTab({
  slideClass,
  bereiche: initial,
  loading = false,
  loadError = null,
  onOpenConfig,
  onToast,
}: Props) {
  const [bereiche, setBereiche] = useState<Bereich[]>(() =>
    initial.map((b) => ({ ...b, tische: b.tische.map((t) => ({ ...t })) })),
  );

  useEffect(() => {
    setBereiche(initial.map((b) => ({ ...b, tische: b.tische.map((t) => ({ ...t })) })));
  }, [initial]);

  const stats = useMemo(() => {
    let active = 0;
    let dead = 0;
    for (const b of bereiche) {
      for (const t of b.tische) {
        if (t.active) active += 1;
        if (t.scans === 0) dead += 1;
      }
    }
    return { active, areas: bereiche.length, dead };
  }, [bereiche]);

  function toggleBereich(key: string) {
    setBereiche((prev) =>
      prev.map((b) => (b.key === key ? { ...b, open: !b.open } : b)),
    );
  }

  if (loading) {
    return (
      <div className={slideClass}>
        <div
          className="mx-5 mt-10 rounded-[20px] border px-5 py-8 text-center text-sm"
          style={{ backgroundColor: dash.s1, borderColor: dash.bo, color: dash.mu }}
        >
          Tische werden geladen …
        </div>
      </div>
    );
  }

  return (
    <div className={slideClass}>
      {loadError ? (
        <div
          className="mx-5 mt-3.5 rounded-[14px] border px-4 py-3 text-xs leading-relaxed"
          style={{
            backgroundColor: "rgba(224,92,92,0.08)",
            borderColor: "rgba(224,92,92,0.25)",
            color: dash.re,
          }}
        >
          {loadError}
          <p className="mt-2 opacity-80" style={{ color: dash.mu }}>
            Prüfe, ob die Tabelle <code className="text-[10px]">tables</code> existiert und die Migration
            ausgeführt wurde.
          </p>
        </div>
      ) : null}

      {!loadError && initial.length === 0 ? (
        <section
          className="mx-5 mt-6 flex flex-col items-center gap-3 rounded-[20px] border px-5 py-10 text-center"
          style={{ backgroundColor: dash.s1, borderColor: dash.bo }}
        >
          <span className="text-3xl">🪑</span>
          <p className="text-[15px] font-bold" style={{ color: dash.tx }}>
            Noch keine Tische
          </p>
          <p className="max-w-[280px] text-xs leading-relaxed" style={{ color: dash.mu }}>
            Lege Bereiche und Tische an — Scans und NFC-URLs kannst du später ergänzen.
          </p>
          <button
            type="button"
            onClick={onOpenConfig}
            className="mt-1 rounded-[13px] px-5 py-3 text-[13px] font-bold text-white"
            style={{
              background: `linear-gradient(135deg, ${dash.or}, ${dash.or2})`,
              boxShadow: "0 6px 20px rgba(232,80,2,0.25)",
            }}
          >
            Jetzt konfigurieren
          </button>
        </section>
      ) : null}

      {!loadError && initial.length > 0 ? (
        <>
          <section
            className="mx-5 mt-3.5 flex items-center justify-between rounded-[20px] border px-5 py-4"
            style={{ backgroundColor: dash.s1, borderColor: dash.bo }}
          >
            <div>
              <div
                className="mb-1 text-[11px] font-medium uppercase tracking-wider"
                style={{ color: dash.mu }}
              >
                Aktive Tische heute
              </div>
              <div className="text-[36px] font-black tracking-tight">{stats.active}</div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span
                className="rounded-md border px-2 py-0.5 text-[11px]"
                style={{
                  backgroundColor: "rgba(76,175,125,0.12)",
                  borderColor: "rgba(76,175,125,0.2)",
                  color: dash.gr,
                }}
              >
                ● {stats.areas} Bereiche aktiv
              </span>
              <span
                className="rounded-md border px-2 py-0.5 text-[11px]"
                style={{
                  backgroundColor: "rgba(224,92,92,0.1)",
                  borderColor: "rgba(224,92,92,0.2)",
                  color: dash.re,
                }}
              >
                ● {stats.dead} ohne Scan
              </span>
            </div>
          </section>

          {bereiche.map((b) => (
        <section
          key={b.key}
          className="mx-5 mt-3 overflow-hidden rounded-[18px] border"
          style={{ backgroundColor: dash.s1, borderColor: dash.bo }}
        >
          <button
            type="button"
            onClick={() => toggleBereich(b.key)}
            className="flex w-full items-center justify-between px-4 py-3.5"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-xl">{b.emoji}</span>
              <span className="text-[15px] font-bold">{b.label}</span>
              <span
                className="ml-1 rounded-md px-2 py-0.5 text-[11px]"
                style={{ backgroundColor: dash.s2, color: dash.mu }}
              >
                {b.tische.length} Tische
              </span>
            </div>
            <span
              className="text-base transition-transform"
              style={{
                color: dash.mu,
                transform: b.open ? "rotate(90deg)" : "rotate(0deg)",
              }}
            >
              ›
            </span>
          </button>
          {b.open && (
            <div className="border-t px-3.5 pb-3.5 pt-3" style={{ borderColor: dash.bo }}>
              <div className="mb-3 grid grid-cols-4 gap-2.5">
                {b.tische.map((t) => {
                  const h = heatFromScans(t.scans);
                  const base =
                    h === "hot"
                      ? {
                          backgroundColor: "rgba(232,80,2,0.18)",
                          borderColor: "rgba(232,80,2,0.35)",
                          color: dash.or,
                          boxShadow: "0 0 12px rgba(232,80,2,0.2)",
                        }
                      : h === "warm"
                        ? {
                            backgroundColor: "rgba(232,80,2,0.07)",
                            borderColor: "rgba(232,80,2,0.15)",
                            color: "rgba(232,80,2,0.6)",
                            boxShadow: "0 0 8px rgba(232,80,2,0.08)",
                          }
                        : h === "cold"
                          ? {
                              backgroundColor: dash.s2,
                              borderColor: dash.bo,
                              color: dash.mu,
                            }
                          : {
                              backgroundColor: "rgba(224,92,92,0.07)",
                              borderColor: "rgba(224,92,92,0.15)",
                              color: "rgba(224,92,92,0.5)",
                            };
                  return (
                    <div
                      key={t.id}
                      className="flex aspect-square flex-col items-center justify-center rounded-[11px] border text-[11px] font-bold"
                      style={base}
                    >
                      T{t.nr}
                      <span className="mt-0.5 text-[9px] opacity-70">{t.scans}×</span>
                    </div>
                  );
                })}
              </div>
              {b.tische.some((t) => t.scans === 0) && (
                <div
                  className="mb-3 flex items-center justify-between rounded-[10px] border px-3 py-2.5"
                  style={{
                    backgroundColor: "rgba(224,92,92,0.07)",
                    borderColor: "rgba(224,92,92,0.15)",
                  }}
                >
                  <span className="text-xs" style={{ color: dash.re }}>
                    Einige Tische ohne Scan
                  </span>
                  <button
                    type="button"
                    onClick={() => onToast("Anfrage gesendet — neuer Sticker kommt 📦")}
                    className="rounded-lg border px-2.5 py-1 text-[11px] font-bold"
                    style={{
                      backgroundColor: "rgba(224,92,92,0.1)",
                      borderColor: "rgba(224,92,92,0.2)",
                      color: dash.re,
                    }}
                  >
                    Neu anfordern
                  </button>
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <Legend color="rgba(232,80,2,0.5)" label="Aktiv" />
                <Legend color="rgba(232,80,2,0.2)" label="Mittel" />
                <Legend color={dash.s2} border={dash.bo} label="Wenig" />
                <Legend color="rgba(224,92,92,0.3)" label="Kein Scan" />
              </div>
            </div>
          )}
        </section>
          ))}
        </>
      ) : null}

      <button
        type="button"
        onClick={onOpenConfig}
        className="mx-5 mb-4 mt-3 flex w-[calc(100%-2.5rem)] items-center justify-center gap-1.5 rounded-[13px] border py-3 text-[13px] font-semibold transition active:bg-white/5"
        style={{ backgroundColor: dash.s1, borderColor: dash.bo, color: dash.mi }}
      >
        ⚙️ Tische &amp; Bereiche konfigurieren
      </button>

    </div>
  );
}

function Legend({
  color,
  label,
  border,
}: {
  color: string;
  label: string;
  border?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-medium" style={{ color: dash.mu }}>
      <span
        className="h-[7px] w-[7px] shrink-0 rounded-sm"
        style={{ backgroundColor: color, border: border ? `1px solid ${border}` : undefined }}
      />
      {label}
    </div>
  );
}
