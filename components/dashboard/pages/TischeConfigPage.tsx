"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buildTableQrUrl } from "@/lib/table-links";
import {
  downloadQrPng,
  generateQrPngDataUrl,
} from "@/lib/generate-qr-canvas";
import { downloadStickerSheetHtml } from "@/lib/qr-sticker-sheet";
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
  restaurantName: string;
  logoUrl: string | null;
  bereiche: Bereich[];
  onToast: (msg: string) => void;
  onTablesUpdated: () => void;
};

export function TischeConfigPage({
  open,
  onClose,
  restaurantId,
  slug,
  restaurantName,
  logoUrl,
  bereiche,
  onToast,
  onTablesUpdated,
}: Props) {
  const [local, setLocal] = useState<Bereich[]>([]);
  /** dataURL je Tischnummer — clientseitig generiert, ein einziger Cache pro Mount. */
  const [qrCache, setQrCache] = useState<Record<number, string>>({});
  const [qrModalTisch, setQrModalTisch] = useState<{ tisch: Tisch; bereich: string } | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLocal(cloneBereiche(bereiche));
  }, [open, bereiche]);

  /** Pre-generiere Thumbnails für alle aktuell sichtbaren Tische — schnell genug
   *  für realistische Restaurant-Größen (≤ 50 Tische ≈ 500 ms). */
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const todo: Array<{ nr: number; url: string }> = [];
      for (const b of local) {
        for (const t of b.tische) {
          if (qrCache[t.nr] !== undefined) continue;
          todo.push({ nr: t.nr, url: buildTableQrUrl(slug, t.nr) });
        }
      }
      if (todo.length === 0) return;
      const next: Record<number, string> = {};
      for (const it of todo) {
        if (cancelled) return;
        try {
          next[it.nr] = await generateQrPngDataUrl(it.url, logoUrl, 160);
        } catch {
          next[it.nr] = "";
        }
      }
      if (cancelled) return;
      setQrCache((prev) => ({ ...prev, ...next }));
    })();
    return () => {
      cancelled = true;
    };
  }, [open, local, slug, logoUrl, qrCache]);

  const totalActive = useMemo(
    () => local.reduce((s, b) => s + b.tische.filter((t) => t.active).length, 0),
    [local],
  );
  const totalAllTables = useMemo(
    () => local.reduce((s, b) => s + b.tische.length, 0),
    [local],
  );

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

        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void handleAddArea()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-[13px] border border-dashed py-3 text-[13px] font-semibold"
            style={{
              borderColor: "rgba(0,200,160,0.35)",
              backgroundColor: dash.s1,
              color: dash.teal,
            }}
          >
            + Neuen Bereich hinzufügen
          </button>
          <button
            type="button"
            onClick={() => {
              if (totalAllTables === 0) {
                onToast("Noch keine Tische — erst Bereich anlegen.");
                return;
              }
              setExporting(true);
              void downloadStickerSheetHtml(
                restaurantName,
                slug,
                local.flatMap((b) =>
                  b.tische.map((t) => ({
                    tisch_nummer: t.nr,
                    qr_url: buildTableQrUrl(slug, t.nr),
                  })),
                ),
                logoUrl,
              )
                .catch((e: unknown) =>
                  onToast(e instanceof Error ? e.message : "Export fehlgeschlagen"),
                )
                .finally(() => setExporting(false));
            }}
            disabled={exporting}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-[13px] border py-3 text-[13px] font-semibold disabled:opacity-50"
            style={{
              borderColor: dash.bo,
              backgroundColor: dash.s1,
              color: dash.tx,
            }}
          >
            {exporting ? "Erzeuge Bogen …" : "📄 Alle QR Codes exportieren"}
          </button>
        </div>

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
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                {b.tische.map((t) => {
                  const active = t.active;
                  const qr = qrCache[t.nr];
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setQrModalTisch({ tisch: t, bereich: b.label })}
                      className="flex aspect-square flex-col items-center justify-between rounded-[11px] border p-1.5 transition active:scale-95"
                      style={
                        active
                          ? {
                              backgroundColor: "#ffffff",
                              borderColor: dash.orm,
                            }
                          : {
                              backgroundColor: "rgba(255,255,255,0.6)",
                              borderColor: "rgba(255,75,110,0.4)",
                              opacity: 0.6,
                            }
                      }
                      aria-label={`Tisch ${t.nr} QR-Code`}
                    >
                      <div
                        className="flex flex-1 w-full items-center justify-center"
                        style={{ minHeight: 0 }}
                      >
                        {qr ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={qr}
                            alt=""
                            style={{
                              width: "100%",
                              height: "100%",
                              maxWidth: 80,
                              maxHeight: 80,
                              objectFit: "contain",
                            }}
                          />
                        ) : (
                          <span style={{ color: "#999", fontSize: 10 }}>QR …</span>
                        )}
                      </div>
                      <div
                        className="flex w-full items-center justify-between"
                        style={{ fontSize: 10, color: "#1a1916", fontWeight: 700 }}
                      >
                        <span>T{t.nr}</span>
                        <span
                          style={{
                            color: active ? "#16a34a" : "#dc2626",
                            fontSize: 8,
                            fontWeight: 600,
                          }}
                        >
                          {active ? "●" : "○"}
                        </span>
                      </div>
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

      {/* QR-Modal */}
      {qrModalTisch ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ backgroundColor: "rgba(8,8,16,0.7)", backdropFilter: "blur(6px)" }}
          onClick={() => setQrModalTisch(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-[400px] rounded-[24px] border p-5"
            style={{
              backgroundColor: "#ffffff",
              borderColor: dash.bo,
              color: "#1a1916",
              margin: "0 16px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#888" }}>
                  Tisch
                </div>
                <div className="text-2xl font-extrabold">
                  T{qrModalTisch.tisch.nr}
                </div>
                <div className="text-[12px]" style={{ color: "#666" }}>
                  {qrModalTisch.bereich}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQrModalTisch(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: "#f3f3f3", color: "#1a1916" }}
                aria-label="Schließen"
              >
                ×
              </button>
            </div>
            <div
              className="mx-auto mb-3 flex aspect-square w-full items-center justify-center rounded-xl"
              style={{
                maxWidth: 280,
                background: "#fff",
                border: "1px solid #eee",
                padding: 8,
              }}
            >
              {qrCache[qrModalTisch.tisch.nr] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrCache[qrModalTisch.tisch.nr]}
                  alt={`Tisch ${qrModalTisch.tisch.nr} QR-Code`}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              ) : (
                <span style={{ color: "#999", fontSize: 12 }}>Wird geladen …</span>
              )}
            </div>
            <div
              className="mb-3 break-all rounded-md px-2 py-1.5 font-mono text-[11px]"
              style={{ backgroundColor: "#f7f7f7", color: "#444" }}
            >
              {buildTableQrUrl(slug, qrModalTisch.tisch.nr)}
            </div>
            <div className="mb-3 flex items-center justify-between rounded-lg border px-3 py-2" style={{ borderColor: "#eee" }}>
              <span className="text-[12px] font-semibold" style={{ color: "#1a1916" }}>
                Im Betrieb
              </span>
              <button
                type="button"
                onClick={() => {
                  const t = qrModalTisch.tisch;
                  const next = !t.active;
                  setQrModalTisch({ ...qrModalTisch, tisch: { ...t, active: next } });
                  // Trigger den existierenden Toggle (Optimistic + Persist).
                  const block = local.find((bb) => bb.label === qrModalTisch.bereich);
                  if (block) toggleTableActive(block, t);
                }}
                className="relative h-6 w-10 rounded-full transition-colors"
                style={{
                  backgroundColor: qrModalTisch.tisch.active ? "#16a34a" : "#cbd5e1",
                }}
                aria-label={qrModalTisch.tisch.active ? "Deaktivieren" : "Aktivieren"}
              >
                <span
                  className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow"
                  style={{ left: qrModalTisch.tisch.active ? 18 : 2, transition: "left 150ms ease" }}
                />
              </button>
            </div>
            <div className="flex gap-2">
              <a
                href={buildTableQrUrl(slug, qrModalTisch.tisch.nr)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-lg border py-2.5 text-center text-[12px] font-semibold"
                style={{ borderColor: "#ddd", color: "#1a1916" }}
              >
                ↗ Öffnen
              </a>
              <button
                type="button"
                onClick={() => {
                  const url = qrCache[qrModalTisch.tisch.nr];
                  if (!url) return;
                  downloadQrPng(`qrave-${slug}-tisch-${qrModalTisch.tisch.nr}`, url);
                }}
                disabled={!qrCache[qrModalTisch.tisch.nr]}
                className="flex-1 rounded-lg py-2.5 text-center text-[12px] font-bold disabled:opacity-50"
                style={{ backgroundColor: "#1a1916", color: "#fff" }}
              >
                ⬇ PNG
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
