"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { FounderRestaurantTableRow } from "@/lib/founder-types";

const GRAY = "#2a2a35";
const RED = "#FF4B6E";
const YELLOW = "#FFD426";
const GREEN = "#34E89E";

const cardBase: CSSProperties = {
  background: "linear-gradient(145deg, #17171f, #141420)",
  borderRadius: 20,
  border: "0.5px solid rgba(255,255,255,0.09)",
  boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
};

type HeatLevel = "gray" | "red" | "yellow" | "green";

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

function heatLevelForTable(rankAmongPositive: number, positiveCount: number): HeatLevel {
  if (positiveCount <= 1) return "green";
  const maxI = positiveCount - 1;
  const t = rankAmongPositive / maxI;
  if (t < 1 / 3) return "red";
  if (t < 2 / 3) return "yellow";
  return "green";
}

function buildHeatMap(
  tables: FounderRestaurantTableRow[],
  tableScans: Record<string, number>,
): Map<string, HeatLevel> {
  const rows = tables.map((t) => ({
    id: t.id,
    nummer: t.tisch_nummer,
    count: tableScans[String(t.tisch_nummer)] ?? 0,
  }));
  if (rows.length === 0) return new Map();

  if (rows.every((r) => r.count === 0)) {
    return new Map(rows.map((r) => [r.id, "gray" as const]));
  }

  const positiveSorted = [...rows]
    .filter((r) => r.count > 0)
    .sort((a, b) => a.count - b.count || a.nummer - b.nummer);
  const rankById = new Map<string, number>();
  positiveSorted.forEach((r, i) => rankById.set(r.id, i));

  const out = new Map<string, HeatLevel>();
  const pc = positiveSorted.length;
  for (const r of rows) {
    if (r.count === 0) {
      out.set(r.id, "gray");
      continue;
    }
    const rank = rankById.get(r.id) ?? 0;
    out.set(r.id, heatLevelForTable(rank, pc));
  }
  return out;
}

function bgForLevel(level: HeatLevel): string {
  if (level === "gray") return GRAY;
  if (level === "red") return RED;
  if (level === "yellow") return YELLOW;
  return GREEN;
}

type Props = {
  restaurantId: string;
  tables: FounderRestaurantTableRow[];
  isMobile: boolean;
};

export function RestaurantTableHeatmap({ restaurantId, tables, isMobile }: Props) {
  const [tableScans, setTableScans] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetch(`/api/founder/restaurant-heatmap?restaurantId=${encodeURIComponent(restaurantId)}`, {
      credentials: "same-origin",
    })
      .then(async (res) => {
        const j = (await res.json()) as { tableScans?: Record<string, number>; error?: string };
        if (!res.ok) {
          throw new Error(j.error ?? `Fehler ${res.status}`);
        }
        if (!cancelled) {
          setTableScans(j.tableScans ?? {});
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Laden fehlgeschlagen");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  const heatById = useMemo(() => buildHeatMap(tables, tableScans), [tables, tableScans]);
  const byBereich = useMemo(() => groupTablesByBereich(tables), [tables]);

  const cols = isMobile ? 2 : 4;

  const pad = isMobile ? 16 : 22;

  return (
    <div style={{ ...cardBase, padding: pad }}>
      <p
        style={{
          margin: "0 0 12px",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.08em",
          color: "rgba(255,255,255,0.45)",
        }}
      >
        HEATMAP · SCANS (7 TAGE)
      </p>
      {loading ? (
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Lade Scan-Daten…</p>
      ) : null}
      {error ? (
        <p style={{ color: "#fda4af", fontSize: 13, fontWeight: 600 }}>{error}</p>
      ) : null}

      {!loading && !error && tables.length === 0 ? (
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14 }}>Keine Tische angelegt.</p>
      ) : null}

      <div className="flex flex-col gap-8">
        {[...byBereich.entries()].map(([bereichName, tische]) => (
          <section key={bereichName}>
            <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 800, color: "#fff" }}>{bereichName}</h3>
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              }}
            >
              {tische.map((t) => {
                const scans = tableScans[String(t.tisch_nummer)] ?? 0;
                const level = heatById.get(t.id) ?? "gray";
                const bg = bgForLevel(level);
                const title = `Tisch ${t.tisch_nummer} · ${bereichName} · ${scans} Scans (7 Tage)`;
                return (
                  <div
                    key={t.id}
                    title={title}
                    className="flex flex-col items-center justify-center rounded-xl px-2 py-4 text-center"
                    style={{
                      background: bg,
                      color: level === "yellow" ? "#1a1a22" : "#fff",
                      minHeight: 88,
                      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
                    }}
                  >
                    <span className="text-lg font-extrabold tabular-nums" style={{ lineHeight: 1.1 }}>
                      {t.tisch_nummer}
                    </span>
                    <span className="mt-1 text-[10px] font-bold tabular-nums opacity-90">{scans}</span>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div
        className="mt-8 flex flex-wrap gap-3 rounded-xl px-3 py-3"
        style={{ background: "rgba(0,0,0,0.25)", border: "0.5px solid rgba(255,255,255,0.08)" }}
      >
        <span className="w-full text-[10px] font-extrabold tracking-wide" style={{ color: "rgba(255,255,255,0.45)" }}>
          LEGENDE
        </span>
        {[
          { c: GRAY, l: "Keine" },
          { c: RED, l: "Wenig" },
          { c: YELLOW, l: "Mittel" },
          { c: GREEN, l: "Viel" },
        ].map((x) => (
          <div key={x.l} className="flex items-center gap-2 text-xs font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
            <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: x.c }} />
            {x.l}
          </div>
        ))}
      </div>
    </div>
  );
}
