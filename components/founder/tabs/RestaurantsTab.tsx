"use client";

import { Inter } from "next/font/google";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabase";
import type {
  FounderRestaurantExtRow,
  FounderRestaurantRow,
  FounderRestaurantTableRow,
  FounderScanEventRow,
} from "@/lib/founder-types";
import { berlinYmd, lastNCalendarDaysBerlin } from "@/lib/berlin-time";

const inter = Inter({ subsets: ["latin"], display: "swap" });

const ORANGE = "#FF5C1A";

type UiStatus = "live" | "setup" | "pause";

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

type SortMode = "scans" | "az";

type SubView = { kind: "tables" | "analytics"; restaurantId: string } | null;

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

function statusLabel(st: UiStatus): string {
  if (st === "live") return "Live";
  if (st === "setup") return "Setup";
  return "Pause";
}

function statusPillStyle(status: UiStatus): CSSProperties {
  if (status === "live")
    return { background: "rgba(52,232,158,0.14)", color: "#34e89e", border: "1px solid rgba(52,232,158,0.35)" };
  if (status === "setup")
    return { background: "rgba(255,92,26,0.12)", color: ORANGE, border: "1px solid rgba(255,92,26,0.35)" };
  return { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.12)" };
}

function sessionKey(e: FounderScanEventRow): string {
  const sidRaw = e.session_id?.trim() ? e.session_id : e.id;
  if (sidRaw != null && String(sidRaw).length > 0) return String(sidRaw);
  return `row:${e.created_at}:${e.event_type}:${e.restaurant_id ?? ""}`;
}

function consentForRestaurant(
  events: FounderScanEventRow[],
  restaurantId: string,
): { total: number; withConsent: number; withoutConsent: number; pct: number } {
  const restEvents = events.filter((e) => e.restaurant_id === restaurantId);
  const sessions = new Map<string, number>();
  restEvents.forEach((e) => {
    const sid = sessionKey(e);
    const tier = e.tier ?? 0;
    const cur = sessions.get(sid) ?? 0;
    if (tier > cur) sessions.set(sid, tier);
  });
  const total = sessions.size;
  const withConsent = [...sessions.values()].filter((t) => t >= 1).length;
  const withoutConsent = total - withConsent;
  const pct = total > 0 ? Math.round((withConsent / total) * 100) : 0;
  return { total, withConsent, withoutConsent, pct };
}

function uniqueSessionsCountForRestaurant(events: FounderScanEventRow[], restaurantId: string): number {
  const set = new Set<string>();
  for (const e of events) {
    if (e.restaurant_id !== restaurantId) continue;
    set.add(sessionKey(e));
  }
  return set.size;
}

function tableHasScanInEvents(
  events: FounderScanEventRow[],
  restaurantId: string,
  tischNummer: number,
): boolean {
  return events.some(
    (e) =>
      e.restaurant_id === restaurantId &&
      e.tisch_nummer != null &&
      e.tisch_nummer === tischNummer,
  );
}

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

function bereichEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("terrasse") || n.includes("außen")) return "☀️";
  if (n.includes("bar")) return "🍸";
  if (n.includes("innen") || n.includes("saal")) return "🪑";
  if (n.includes("garten")) return "🌿";
  return "📍";
}

function formatVisitDate(raw: string | null): string {
  if (!raw?.trim()) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" });
}

function stickerTierDisplay(tier: string | null | undefined): string {
  const t = (tier ?? "").toLowerCase();
  const hit = STICKER_TIERS.find((x) => x.key === t);
  return hit?.label ?? (t ? tier! : "—");
}

const cardBase: CSSProperties = {
  background: "linear-gradient(145deg, #17171f, #141420)",
  borderRadius: 20,
  border: "0.5px solid rgba(255,255,255,0.09)",
  boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
};

const glassBtn: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "12px 10px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.06)",
  color: "rgba(255,255,255,0.88)",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
  backdropFilter: "blur(8px)",
};

const glassActionBtn: CSSProperties = {
  ...glassBtn,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
};

const actionIconWrap: CSSProperties = {
  display: "flex",
  color: "rgba(255,255,255,0.6)",
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

export function RestaurantsTab({
  restaurants,
  scanEvents,
  restaurantExtras,
  restaurantTables,
  isMobile,
  onRefresh,
}: Props) {
  const [search, setSearch] = useState("");
  const [filterBezirk, setFilterBezirk] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("scans");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [subView, setSubView] = useState<SubView>(null);
  const [stickerModalFor, setStickerModalFor] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [newTischNr, setNewTischNr] = useState("");
  const [newBereich, setNewBereich] = useState("");

  const [modalTier, setModalTier] = useState<string>("starter");
  const [modalCount, setModalCount] = useState(0);
  const [modalPaid, setModalPaid] = useState(false);

  const bezirke = useMemo(() => {
    const s = new Set<string>();
    for (const r of restaurants) {
      if (r.stadt?.trim()) s.add(r.stadt.trim());
    }
    return [...s].sort((a, b) => a.localeCompare(b, "de"));
  }, [restaurants]);

  const sessionsByRestaurant = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of restaurants) {
      m.set(r.id, uniqueSessionsCountForRestaurant(scanEvents, r.id));
    }
    return m;
  }, [restaurants, scanEvents]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return restaurants.filter((r) => {
      if (filterBezirk && (r.stadt?.trim() ?? "") !== filterBezirk) return false;
      if (!q) return true;
      const name = r.name.toLowerCase();
      const stadt = (r.stadt ?? "").toLowerCase();
      return name.includes(q) || stadt.includes(q);
    });
  }, [restaurants, search, filterBezirk]);

  const sortedList = useMemo(() => {
    const copy = [...filtered];
    if (sortMode === "az") {
      copy.sort((a, b) => a.name.localeCompare(b.name, "de"));
    } else {
      copy.sort(
        (a, b) => (sessionsByRestaurant.get(b.id) ?? 0) - (sessionsByRestaurant.get(a.id) ?? 0),
      );
    }
    return copy;
  }, [filtered, sortMode, sessionsByRestaurant]);

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

  useEffect(() => {
    if (!stickerModalFor) return;
    const ex = extForRestaurant(restaurantExtras, stickerModalFor);
    const r = restaurants.find((x) => x.id === stickerModalFor);
    setModalTier((ex?.sticker_tier ?? "starter").toLowerCase() || "starter");
    setModalCount(ex?.sticker_count ?? r?.sticker_anzahl ?? 0);
    setModalPaid(ex?.sticker_paid ?? false);
  }, [stickerModalFor, restaurantExtras, restaurants]);

  const subRestaurant = subView ? restaurants.find((r) => r.id === subView.restaurantId) : undefined;
  const tablesForSub = useMemo(() => {
    if (!subView || subView.kind !== "tables") return [];
    return restaurantTables
      .filter((t) => t.restaurant_id === subView.restaurantId)
      .sort((a, b) => a.tisch_nummer - b.tisch_nummer);
  }, [restaurantTables, subView]);

  const analyticsSeries = useMemo(() => {
    if (!subView || subView.kind !== "analytics") return { labels: [] as string[], counts: [] as number[] };
    const rid = subView.restaurantId;
    const ymds = lastNCalendarDaysBerlin(7);
    const idx = new Map(ymds.map((y, i) => [y, i]));
    const counts = ymds.map(() => 0);
    for (const e of scanEvents) {
      if (e.restaurant_id !== rid) continue;
      const y = berlinYmd(new Date(e.created_at));
      const i = idx.get(y);
      if (i !== undefined) counts[i]++;
    }
    const labels = ymds.map((y) => {
      const d = new Date(`${y}T12:00:00Z`);
      return d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric" });
    });
    return { labels, counts };
  }, [subView, scanEvents]);

  if (subView && subRestaurant) {
    return (
      <div className={`${inter.className} pb-8`} style={{ fontFamily: "inherit" }}>
        <button
          type="button"
          onClick={() => setSubView(null)}
          className="mb-4 flex items-center gap-2"
          style={{
            background: "transparent",
            border: "none",
            color: "rgba(255,255,255,0.65)",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          ← Restaurants
        </button>
        <h2 style={{ margin: "0 0 16px", fontSize: isMobile ? 20 : 22, fontWeight: 800, color: "#fff" }}>
          {subRestaurant.name}
        </h2>

        {subView.kind === "tables" ? (
          <div style={{ ...cardBase, padding: isMobile ? 16 : 22 }}>
            <p style={{ margin: "0 0 14px", fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: "rgba(255,255,255,0.45)" }}>
              TISCHE · QR & NFC
            </p>
            <div className="grid gap-3" style={{ gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
              <label className="block text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>
                Tisch-Nummer
                <input
                  type="number"
                  min={1}
                  value={newTischNr}
                  onChange={(e) => setNewTischNr(e.target.value)}
                  style={{ ...inputBase, marginTop: 6 }}
                />
              </label>
              <label className="block text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>
                Bereich
                <input
                  value={newBereich}
                  onChange={(e) => setNewBereich(e.target.value)}
                  style={{ ...inputBase, marginTop: 6 }}
                />
              </label>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                const n = Number.parseInt(newTischNr, 10);
                if (!Number.isFinite(n) || n < 1) {
                  window.alert("Bitte gültige Tisch-Nummer eingeben.");
                  return;
                }
                void run(
                  supabase.from("restaurant_tables").insert({
                    restaurant_id: subView.restaurantId,
                    tisch_nummer: n,
                    bereich: newBereich.trim() || null,
                  }),
                ).then(() => {
                  setNewTischNr("");
                  setNewBereich("");
                });
              }}
              className="mt-3 w-full"
              style={{
                padding: "12px 16px",
                borderRadius: 14,
                border: "none",
                fontWeight: 800,
                fontSize: 14,
                color: "#fff",
                cursor: pending ? "not-allowed" : "pointer",
                background: `linear-gradient(135deg, ${ORANGE}, #ff8c4a)`,
              }}
            >
              Tisch hinzufügen
            </button>
            <button
              type="button"
              disabled={pending || tablesForSub.length === 0}
              onClick={() => {
                const lines = tablesForSub.map((t) => t.qr_url ?? "").filter(Boolean);
                void navigator.clipboard.writeText(lines.join("\n"));
              }}
              className="mt-3 w-full"
              style={{
                ...glassBtn,
                marginTop: 12,
                width: "100%",
              }}
            >
              Alle URLs kopieren
            </button>
            <div className="mt-6 flex flex-col gap-3">
              {tablesForSub.length === 0 ? (
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14 }}>Keine Tische angelegt.</p>
              ) : null}
              {tablesForSub.map((tb) => (
                <div
                  key={tb.id}
                  style={{
                    border: "0.5px solid rgba(255,255,255,0.1)",
                    borderRadius: 16,
                    padding: 14,
                  }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div style={{ fontWeight: 800, color: "#fff", fontSize: 15 }}>
                        Tisch {tb.tisch_nummer}
                        {tb.bereich ? (
                          <span style={{ color: "rgba(255,255,255,0.45)", fontWeight: 600 }}> · {tb.bereich}</span>
                        ) : null}
                      </div>
                      <div
                        className="mt-1 break-all text-xs"
                        style={{ color: "rgba(255,255,255,0.35)", maxWidth: "100%" }}
                      >
                        {tb.qr_url ?? "—"}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
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
                            void run(
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
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => void run(supabase.from("restaurant_tables").delete().eq("id", tb.id))}
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
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ ...cardBase, padding: isMobile ? 16 : 22 }}>
            <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: "rgba(255,255,255,0.45)" }}>
              SCANS · LETZTE 7 TAGE (ALLE EVENTS)
            </p>
            <AnalyticsBars labels={analyticsSeries.labels} counts={analyticsSeries.counts} isMobile={isMobile} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`${inter.className} flex flex-col gap-4 pb-8`} style={{ fontFamily: "inherit" }}>
      <input
        type="search"
        placeholder="Restaurant suchen..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={inputBase}
        aria-label="Restaurant suchen"
      />

      <div className="-mx-1 overflow-x-auto pb-1">
        <div className="flex w-max gap-2 px-1">
          <FilterChip active={filterBezirk === null} label="Alle" onClick={() => setFilterBezirk(null)} />
          {bezirke.map((b) => (
            <FilterChip key={b} active={filterBezirk === b} label={b} onClick={() => setFilterBezirk(b)} />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "rgba(255,255,255,0.4)" }}>
          {sortedList.length} RESTAURANTS
        </span>
        <div className="flex gap-2">
          <SortChip active={sortMode === "scans"} label="Scans ↓" onClick={() => setSortMode("scans")} />
          <SortChip active={sortMode === "az"} label="A-Z" onClick={() => setSortMode("az")} />
        </div>
      </div>

      {sortedList.map((r) => (
        <RestaurantCard
          key={r.id}
          restaurant={r}
          ext={extForRestaurant(restaurantExtras, r.id)}
          tables={restaurantTables.filter((t) => t.restaurant_id === r.id)}
          scanEvents={scanEvents}
          sessionsWeek={sessionsByRestaurant.get(r.id) ?? 0}
          expanded={expandedId === r.id}
          isMobile={isMobile}
          pending={pending}
          onToggleExpand={() => setExpandedId((cur) => (cur === r.id ? null : r.id))}
          onOpenTables={() => setSubView({ kind: "tables", restaurantId: r.id })}
          onOpenAnalytics={() => setSubView({ kind: "analytics", restaurantId: r.id })}
          onOpenStickerModal={() => setStickerModalFor(r.id)}
        />
      ))}

      {stickerModalFor ? (
        <StickerModal
          restaurantName={restaurants.find((x) => x.id === stickerModalFor)?.name ?? ""}
          tier={modalTier}
          count={modalCount}
          paid={modalPaid}
          pending={pending}
          onTier={setModalTier}
          onCount={setModalCount}
          onPaid={setModalPaid}
          onClose={() => setStickerModalFor(null)}
          onSave={() => {
            const ex = extForRestaurant(restaurantExtras, stickerModalFor);
            void run(
              supabase.from("founder_restaurants").upsert(
                {
                  restaurant_id: stickerModalFor,
                  next_visit: ex?.next_visit ?? null,
                  last_visit: ex?.last_visit ?? null,
                  note: ex?.note ?? null,
                  sticker_tier: modalTier.trim() || null,
                  sticker_count: modalCount,
                  sticker_paid: modalPaid,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "restaurant_id" },
              ),
            ).then(() => setStickerModalFor(null));
          }}
        />
      ) : null}
    </div>
  );
}

function IconQrCodes() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <g stroke="currentColor" strokeWidth={2} strokeLinecap="round" fill="none">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <path d="M14 14h1v1h-1z M16 14h1v1h-1z M14 16h1v1h-1z M16 16h3v3h-3z" />
      </g>
    </svg>
  );
}

function IconAnalytics() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <polyline
        points="22 12 18 12 15 21 9 3 6 12 2 12"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSticker() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <g stroke="currentColor" strokeWidth={2} strokeLinecap="round" fill="none">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
        <circle cx="12" cy="10" r="3" />
      </g>
    </svg>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold"
      style={{
        border: active ? `1px solid ${ORANGE}` : "1px solid rgba(255,255,255,0.12)",
        background: active ? "rgba(255,92,26,0.15)" : "rgba(255,255,255,0.05)",
        color: active ? "#fff" : "rgba(255,255,255,0.55)",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function SortChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-3 py-1.5 text-xs font-bold"
      style={{
        border: active ? `1px solid ${ORANGE}` : "1px solid rgba(255,255,255,0.1)",
        background: active ? "rgba(255,92,26,0.12)" : "transparent",
        color: active ? "#fff" : "rgba(255,255,255,0.45)",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function RestaurantCard({
  restaurant: r,
  ext,
  tables,
  scanEvents,
  sessionsWeek,
  expanded,
  isMobile,
  pending,
  onToggleExpand,
  onOpenTables,
  onOpenAnalytics,
  onOpenStickerModal,
}: {
  restaurant: FounderRestaurantRow;
  ext: FounderRestaurantExtRow | undefined;
  tables: FounderRestaurantTableRow[];
  scanEvents: FounderScanEventRow[];
  sessionsWeek: number;
  expanded: boolean;
  isMobile: boolean;
  pending: boolean;
  onToggleExpand: () => void;
  onOpenTables: () => void;
  onOpenAnalytics: () => void;
  onOpenStickerModal: () => void;
}) {
  const st = restaurantUiStatus(r);
  const pill = statusPillStyle(st);
  const consent = consentForRestaurant(scanEvents, r.id);
  const byBereich = useMemo(() => groupTablesByBereich(tables), [tables]);

  return (
    <div style={{ ...cardBase, overflow: "hidden" }}>
      <div className="flex flex-col gap-3 p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <h3
            className="min-w-0 flex-1 leading-tight"
            style={{ fontSize: isMobile ? 18 : 20, fontWeight: 800, color: "#fff", margin: 0 }}
          >
            {r.name}
          </h3>
          <span
            style={{
              ...pill,
              flexShrink: 0,
              fontSize: 10,
              fontWeight: 800,
              textTransform: "uppercase",
              padding: "5px 12px",
              borderRadius: 9999,
            }}
          >
            {statusLabel(st)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 text-sm" style={{ color: "rgba(255,255,255,0.5)", margin: 0 }}>
            <span aria-hidden>🍴</span>{" "}
            <span style={{ color: "rgba(255,255,255,0.75)" }}>{r.stadt?.trim() || "—"}</span>
            <span style={{ color: "rgba(255,255,255,0.35)" }}> · </span>
            {stickerTierDisplay(ext?.sticker_tier)}
            <span style={{ color: "rgba(255,255,255,0.35)" }}> · </span>
            {ext?.sticker_count ?? r.sticker_anzahl ?? 0} Sticker
          </p>
          <div className="text-right" style={{ flexShrink: 0 }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: "0.06em",
                color: "rgba(255,255,255,0.35)",
              }}
            >
              Scans/Wo
            </div>
            <span
              style={{
                fontSize: isMobile ? 20 : 22,
                fontWeight: 800,
                color: ORANGE,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {sessionsWeek}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleExpand}
          className="w-full rounded-xl py-2 text-sm font-bold"
          style={{
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.04)",
            color: "rgba(255,255,255,0.7)",
            cursor: "pointer",
          }}
        >
          {expanded ? "▲ Weniger" : "▼ Mehr"}
        </button>
      </div>

      {expanded ? (
        <div
          style={{
            borderTop: "0.5px solid rgba(255,255,255,0.08)",
            padding: isMobile ? 16 : 20,
          }}
        >
          {r.telefon?.trim() ? (
            <a
              href={`tel:${r.telefon.replace(/\s/g, "")}`}
              className="mb-5 block text-sm font-semibold"
              style={{ color: ORANGE }}
            >
              {r.telefon}
            </a>
          ) : (
            <p className="mb-5 text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
              Keine Telefonnummer
            </p>
          )}

          <p
            style={{
              margin: "0 0 10px",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.1em",
              color: "rgba(255,255,255,0.4)",
            }}
          >
            TISCHE & BEREICHE
          </p>
          {tables.length === 0 ? (
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 16 }}>Noch keine Tische.</p>
          ) : (
            <div className="mb-5 flex flex-col gap-4">
              {[...byBereich.entries()].map(([bereichName, tische]) => {
                const withScan = tische.filter((t) => tableHasScanInEvents(scanEvents, r.id, t.tisch_nummer)).length;
                return (
                  <div key={bereichName}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.88)" }}>
                        <span aria-hidden>{bereichEmoji(bereichName)}</span> {bereichName}
                      </span>
                      <span className="text-xs font-bold tabular-nums" style={{ color: "rgba(255,255,255,0.45)" }}>
                        {withScan}/{tische.length}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {tische.map((t) => {
                        const hot = tableHasScanInEvents(scanEvents, r.id, t.tisch_nummer);
                        return (
                          <span
                            key={t.id}
                            title={`Tisch ${t.tisch_nummer}`}
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{
                              background: hot ? ORANGE : "rgba(255,255,255,0.15)",
                              boxShadow: hot ? `0 0 4px ${ORANGE}` : "none",
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div
            className="mb-5 rounded-2xl p-4"
            style={{ background: "rgba(0,0,0,0.25)", border: "0.5px solid rgba(255,255,255,0.08)" }}
          >
            <p
              style={{
                margin: "0 0 8px",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.1em",
                color: "rgba(255,255,255,0.4)",
              }}
            >
              CONSENT TIER-1
            </p>
            <div className="flex items-center gap-3">
              <span className="text-lg font-extrabold" style={{ color: "#34e89e" }}>
                ✓ {consent.withConsent}
              </span>
              <div className="min-w-0 flex-1">
                <div
                  className="h-2 overflow-hidden rounded-full"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${consent.pct}%`,
                      background: ORANGE,
                      boxShadow: `0 0 8px ${ORANGE}66`,
                    }}
                  />
                </div>
              </div>
              <span className="text-sm font-extrabold tabular-nums" style={{ color: "#fff" }}>
                {consent.pct}%
              </span>
            </div>
            <p className="mt-2 text-xs font-semibold" style={{ color: "rgba(255,255,255,0.75)" }}>
              {consent.pct}% der Besucher haben zugestimmt.
            </p>
            <p className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
              {consent.withConsent} Besucher Ja · {consent.withoutConsent} Besucher Nein · {consent.total} Sessions (7 Tage)
            </p>
          </div>

          <div className="mb-5 grid gap-3" style={{ gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
            <VisitBlock label="LETZTER BESUCH" value={formatVisitDate(ext?.last_visit ?? null)} />
            <VisitBlock label="NÄCHSTER BESUCH" value={formatVisitDate(ext?.next_visit ?? null)} />
          </div>

          <div
            className="mb-5 rounded-2xl p-4"
            style={{
              borderLeft: `3px solid ${ORANGE}`,
              background: "rgba(255,92,26,0.06)",
              borderTop: "0.5px solid rgba(255,255,255,0.08)",
              borderRight: "0.5px solid rgba(255,255,255,0.08)",
              borderBottom: "0.5px solid rgba(255,255,255,0.08)",
            }}
          >
            <p
              style={{
                margin: "0 0 6px",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.1em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              NOTIZ
            </p>
            <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
              {ext?.note?.trim() || "—"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2" style={{ gap: 8 }}>
            <button type="button" disabled={pending} onClick={onOpenTables} style={glassActionBtn}>
              <span style={actionIconWrap}>
                <IconQrCodes />
              </span>
              <span>QR-Codes</span>
            </button>
            <button type="button" disabled={pending} onClick={onOpenAnalytics} style={glassActionBtn}>
              <span style={actionIconWrap}>
                <IconAnalytics />
              </span>
              <span>Analytics</span>
            </button>
            <button type="button" disabled={pending} onClick={onOpenStickerModal} style={glassActionBtn}>
              <span style={actionIconWrap}>
                <IconSticker />
              </span>
              <span>Sticker</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function VisitBlock({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-2xl p-3"
      style={{ background: "rgba(0,0,0,0.2)", border: "0.5px solid rgba(255,255,255,0.08)" }}
    >
      <p
        style={{
          margin: "0 0 4px",
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: "0.08em",
          color: "rgba(255,255,255,0.4)",
        }}
      >
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fff" }}>{value}</p>
    </div>
  );
}

function AnalyticsBars({
  labels,
  counts,
  isMobile,
}: {
  labels: string[];
  counts: number[];
  isMobile: boolean;
}) {
  const max = Math.max(1, ...counts);
  const h = isMobile ? 140 : 160;
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-end gap-1" style={{ height: h, minWidth: 280 }}>
        {counts.map((c, i) => (
          <div key={labels[i] ?? i} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <div
              className="w-full max-w-[28px] rounded-t-md"
              style={{
                height: `${Math.max(4, (c / max) * (h - 36))}px`,
                background: `linear-gradient(180deg, ${ORANGE}, rgba(255,92,26,0.4))`,
                boxShadow: c > 0 ? `0 0 6px ${ORANGE}55` : "none",
              }}
            />
            <span className="truncate text-center text-[9px] font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>
              {labels[i] ?? ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StickerModal({
  restaurantName,
  tier,
  count,
  paid,
  pending,
  onTier,
  onCount,
  onPaid,
  onClose,
  onSave,
}: {
  restaurantName: string;
  tier: string;
  count: number;
  paid: boolean;
  pending: boolean;
  onTier: (t: string) => void;
  onCount: (n: number) => void;
  onPaid: (v: boolean) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
      style={{ background: "rgba(0,0,0,0.65)" }}
      role="dialog"
      aria-modal
      aria-labelledby="sticker-modal-title"
    >
      <div
        className="w-full max-w-md rounded-3xl p-6"
        style={{ ...cardBase, maxHeight: "90vh", overflow: "auto" }}
      >
        <h2 id="sticker-modal-title" style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: "#fff" }}>
          Sticker
        </h2>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "rgba(255,255,255,0.45)" }}>{restaurantName}</p>

        <p className="mb-2 text-xs font-bold" style={{ color: "rgba(255,255,255,0.45)" }}>
          Tier
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {STICKER_TIERS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => onTier(t.key)}
              style={{
                padding: "10px 16px",
                borderRadius: 12,
                border: tier === t.key ? `1px solid ${ORANGE}` : "1px solid rgba(255,255,255,0.12)",
                background: tier === t.key ? "rgba(255,92,26,0.15)" : "rgba(255,255,255,0.05)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <label className="mb-4 block text-xs font-bold" style={{ color: "rgba(255,255,255,0.45)" }}>
          Anzahl
          <input
            type="number"
            min={0}
            value={count}
            onChange={(e) => onCount(Number.parseInt(e.target.value, 10) || 0)}
            style={{ ...inputBase, marginTop: 6 }}
          />
        </label>

        <label className="mb-6 flex items-center gap-3 text-sm font-semibold" style={{ color: "#fff" }}>
          <input type="checkbox" checked={paid} onChange={(e) => onPaid(e.target.checked)} style={{ accentColor: ORANGE }} />
          Bezahlt
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            style={{ ...glassBtn, flex: 1 }}
          >
            Abbrechen
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onSave}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: 14,
              border: "none",
              fontWeight: 800,
              fontSize: 14,
              color: "#fff",
              cursor: pending ? "not-allowed" : "pointer",
              background: `linear-gradient(135deg, ${ORANGE}, #ff8c4a)`,
            }}
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
