"use client";

import { Inter } from "next/font/google";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabase";
import type {
  FounderRestaurantExtRow,
  FounderRestaurantRow,
  FounderRestaurantTableRow,
  FounderScanEventRow,
} from "@/lib/founder-types";
import { defaultLast7Ymd } from "@/lib/restaurant-analytics-presets";
import { slugifyRestaurantName } from "@/lib/slugify-restaurant";
const inter = Inter({ subsets: ["latin"], display: "swap" });

const ORANGE = "#9333ea";

type UiStatus = "live" | "setup" | "pause";

type Props = {
  restaurants: FounderRestaurantRow[];
  scanEvents: FounderScanEventRow[];
  restaurantExtras: FounderRestaurantExtRow[];
  restaurantTables: FounderRestaurantTableRow[];
  isMobile: boolean;
  onRefresh: () => Promise<void>;
  /** Optional: pre-aggregierte Sessions/Woche pro Restaurant (aus
   *  restaurant_analytics_daily, letzte 7 Tage). Wenn gesetzt, hat
   *  Priorität vor dem `scanEvents`-Window — verlässlicher bei viel
   *  Traffic, da das Daily-Aggregat nicht gedeckelt ist. */
  sessionsWeekOverride?: Map<string, number>;
  /** Onboarding-Tracking: letzter Dashboard-Login pro auth_user_id.
   *  Aus Supabase Auth Admin API. */
  lastLoginByUserId?: Record<string, string | null>;
  /** Onboarding-Tracking: MAX(menu_items.updated_at) pro restaurant_id. */
  lastMenuUpdateByRestaurantId?: Record<string, string | null>;
};

const STICKER_TIERS = [
  { key: "starter", label: "Starter" },
  { key: "studio", label: "Studio" },
  { key: "pro", label: "Pro" },
] as const;

type SortMode = "scans" | "az";

function extForRestaurant(
  extras: FounderRestaurantExtRow[],
  restaurantId: string,
): FounderRestaurantExtRow | undefined {
  return extras.find((e) => e.restaurant_id === restaurantId);
}

/** "vor 3 Tagen" / "heute" / "—" für Onboarding-Tracking-Spalten. */
function formatRelativeDe(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const diffMs = Date.now() - t;
  if (diffMs < 0) return "soeben";
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "soeben";
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "gestern";
  if (days < 30) return `vor ${days} Tagen`;
  const months = Math.floor(days / 30);
  if (months < 12) return `vor ${months} Mon.`;
  const years = Math.floor(days / 365);
  return `vor ${years} J.`;
}

/** Frische-Indikator: grün <= threshold/2, gelb <= threshold, rot drüber.
 *  threshold = Tage. null → neutral grau. */
function stalenessColor(iso: string | null, threshold: number): string {
  if (!iso) return "rgba(255,255,255,0.4)";
  const days = (Date.now() - Date.parse(iso)) / 86400000;
  if (!Number.isFinite(days)) return "rgba(255,255,255,0.4)";
  if (days < 0) return "#7be38b";
  if (days <= threshold / 2) return "#7be38b";
  if (days <= threshold) return "#ffd166";
  return "#ff8a8a";
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
    return { background: "rgba(147,51,234,0.12)", color: ORANGE, border: "1px solid rgba(147,51,234,0.35)" };
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

const ERR_RED = "#FF4B6E";

type AddFieldKey = "name" | "stadt" | "slug" | "_";

const RESTAURANT_STATUS_OPTIONS = [
  { value: "in_einrichtung", label: "In Einrichtung" },
  { value: "live", label: "Live" },
  { value: "offline", label: "Offline" },
] as const;

function AddRestaurantModal({
  isMobile,
  onClose,
  onSaved,
}: {
  isMobile: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [stadt, setStadt] = useState("Frankfurt");
  const [adresse, setAdresse] = useState("");
  const [telefon, setTelefon] = useState("");
  const [ansprechpartner, setAnsprechpartner] = useState("");
  const [status, setStatus] = useState<(typeof RESTAURANT_STATUS_OPTIONS)[number]["value"]>("in_einrichtung");
  const [naechsterBesuch, setNaechsterBesuch] = useState("");
  const [notiz, setNotiz] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<AddFieldKey, string>>>({});
  const [saving, setSaving] = useState(false);

  function onNameInput(v: string) {
    setName(v);
    if (!slugManual) setSlug(slugifyRestaurantName(v));
  }

  async function handleSubmit() {
    const next: Partial<Record<AddFieldKey, string>> = {};
    if (!name.trim()) next.name = "Bitte einen Namen eingeben.";
    if (!stadt.trim()) next.stadt = "Bitte eine Stadt eingeben.";
    if (!slug.trim()) next.slug = "Bitte einen Slug eingeben.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    setErrors({});
    try {
      const res = await fetch("/api/founder/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          name: name.trim(),
          stadt: stadt.trim(),
          adresse: adresse.trim() || undefined,
          telefon: telefon.trim() || undefined,
          slug: slug.trim().toLowerCase(),
          ansprechpartner: ansprechpartner.trim() || undefined,
          status,
          naechster_besuch: naechsterBesuch.trim() || undefined,
          notiz: notiz.trim() || undefined,
        }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        if (res.status === 409) {
          setErrors({ slug: j.error ?? "Dieser Slug ist bereits vergeben." });
        } else {
          setErrors({ _: j.error ?? `Fehler ${res.status}` });
        }
        return;
      }
      await onSaved();
      onClose();
    } catch {
      setErrors({ _: "Netzwerkfehler" });
    } finally {
      setSaving(false);
    }
  }

  const pad = isMobile ? 16 : 22;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center p-4 sm:items-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
      role="presentation"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby="add-restaurant-title"
        className="w-full max-w-md"
        style={{ ...cardBase, padding: pad, maxHeight: "90vh", overflow: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="add-restaurant-title" style={{ margin: 0, fontSize: isMobile ? 18 : 20, fontWeight: 800, color: "#fff" }}>
          Neues Restaurant
        </h2>

        <div className="mt-5 flex flex-col gap-4">
          <label className="block text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>
            Name *
            <input
              value={name}
              onChange={(e) => onNameInput(e.target.value)}
              placeholder="z. B. Café Sonne"
              style={{ ...inputBase, marginTop: 6 }}
              autoComplete="organization"
            />
            {errors.name ? (
              <p style={{ margin: "6px 0 0", fontSize: 11, fontWeight: 600, color: ERR_RED }}>{errors.name}</p>
            ) : null}
          </label>

          <label className="block text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>
            Stadt *
            <input
              value={stadt}
              onChange={(e) => setStadt(e.target.value)}
              placeholder="Frankfurt"
              style={{ ...inputBase, marginTop: 6 }}
            />
            {errors.stadt ? (
              <p style={{ margin: "6px 0 0", fontSize: 11, fontWeight: 600, color: ERR_RED }}>{errors.stadt}</p>
            ) : null}
          </label>

          <label className="block text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>
            Adresse
            <input
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              placeholder="Optional"
              style={{ ...inputBase, marginTop: 6 }}
            />
          </label>

          <label className="block text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>
            Telefon
            <input
              value={telefon}
              onChange={(e) => setTelefon(e.target.value)}
              placeholder="Optional"
              type="tel"
              style={{ ...inputBase, marginTop: 6 }}
            />
          </label>

          <label className="block text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>
            Ansprechpartner
            <input
              value={ansprechpartner}
              onChange={(e) => setAnsprechpartner(e.target.value)}
              placeholder="Optional — Name des Wirtes"
              style={{ ...inputBase, marginTop: 6 }}
            />
          </label>

          <label className="block text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>
            Status
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as (typeof RESTAURANT_STATUS_OPTIONS)[number]["value"])
              }
              style={{ ...inputBase, marginTop: 6, cursor: "pointer" }}
            >
              {RESTAURANT_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>
            Nächster Besuch
            <input
              type="date"
              value={naechsterBesuch}
              onChange={(e) => setNaechsterBesuch(e.target.value)}
              style={{ ...inputBase, marginTop: 6 }}
            />
          </label>

          <label className="block text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>
            Notiz
            <textarea
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              placeholder="Optional"
              rows={3}
              style={{ ...inputBase, marginTop: 6, resize: "vertical", minHeight: 72 }}
            />
          </label>

          <label className="block text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>
            Slug *
            <input
              value={slug}
              onChange={(e) => {
                setSlugManual(true);
                setSlug(e.target.value);
              }}
              placeholder="cafe-sonne"
              style={{
                ...inputBase,
                marginTop: 6,
                background: "rgba(255,255,255,0.06)",
                fontFamily: "ui-monospace, monospace",
              }}
            />
            <p style={{ margin: "6px 0 0", fontSize: 10, color: "rgba(255,255,255,0.38)", fontWeight: 600 }}>
              qrave.menu/{slug.trim() || "…"}
            </p>
            {errors.slug ? (
              <p style={{ margin: "6px 0 0", fontSize: 11, fontWeight: 600, color: ERR_RED }}>{errors.slug}</p>
            ) : null}
          </label>
        </div>

        {errors._ ? (
          <p style={{ margin: "14px 0 0", fontSize: 12, fontWeight: 600, color: ERR_RED }}>{errors._}</p>
        ) : null}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="flex-1 rounded-xl py-3 text-sm font-bold"
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.75)",
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            Abbrechen
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSubmit()}
            className="flex-1 rounded-xl py-3 text-sm font-extrabold"
            style={{
              border: "none",
              background: ORANGE,
              color: "#fff",
              cursor: saving ? "wait" : "pointer",
              opacity: saving ? 0.75 : 1,
            }}
          >
            {saving ? "Speichert…" : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function RestaurantsTab({
  restaurants,
  scanEvents,
  restaurantExtras,
  restaurantTables,
  isMobile,
  onRefresh,
  sessionsWeekOverride,
  lastLoginByUserId,
  lastMenuUpdateByRestaurantId,
}: Props) {
  const router = useRouter();
  const [restaurantItems, setRestaurantItems] = useState<FounderRestaurantRow[]>(restaurants);
  const [search, setSearch] = useState("");
  const [filterBezirk, setFilterBezirk] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("scans");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [stickerModalFor, setStickerModalFor] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);

  const [modalTier, setModalTier] = useState<string>("starter");
  const [modalCount, setModalCount] = useState(0);
  const [modalPaid, setModalPaid] = useState(false);
  const [addRestaurantOpen, setAddRestaurantOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FounderRestaurantRow | null>(null);
  const [deleteCountdown, setDeleteCountdown] = useState(2);

  useEffect(() => {
    setRestaurantItems(restaurants);
  }, [restaurants]);

  useEffect(() => {
    if (!deleteTarget) return;
    setDeleteCountdown(2);
    const t1 = window.setTimeout(() => setDeleteCountdown(1), 1000);
    const t2 = window.setTimeout(() => setDeleteCountdown(0), 2000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [deleteTarget]);

  const bezirke = useMemo(() => {
    const s = new Set<string>();
    for (const r of restaurantItems) {
      if (r.stadt?.trim()) s.add(r.stadt.trim());
    }
    return [...s].sort((a, b) => a.localeCompare(b, "de"));
  }, [restaurantItems]);

  const sessionsByRestaurant = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of restaurantItems) {
      if (sessionsWeekOverride) {
        m.set(r.id, sessionsWeekOverride.get(r.id) ?? 0);
      } else {
        m.set(r.id, uniqueSessionsCountForRestaurant(scanEvents, r.id));
      }
    }
    return m;
  }, [restaurantItems, scanEvents, sessionsWeekOverride]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return restaurantItems.filter((r) => {
      if (filterBezirk && (r.stadt?.trim() ?? "") !== filterBezirk) return false;
      if (!q) return true;
      const name = r.name.toLowerCase();
      const stadt = (r.stadt ?? "").toLowerCase();
      return name.includes(q) || stadt.includes(q);
    });
  }, [restaurantItems, search, filterBezirk]);

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
      setSupabaseError(null);
      setPending(true);
      try {
        const { error } = await Promise.resolve(op);
        if (error) {
          setSupabaseError(error.message);
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
  }, [stickerModalFor, restaurantExtras, restaurantItems]);

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
        <div className="flex flex-wrap items-center justify-end gap-2">
          <SortChip active={sortMode === "scans"} label="Scans ↓" onClick={() => setSortMode("scans")} />
          <SortChip active={sortMode === "az"} label="A-Z" onClick={() => setSortMode("az")} />
          <button
            type="button"
            onClick={() => setAddRestaurantOpen(true)}
            className="shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold"
            style={{
              border: `1px solid ${ORANGE}`,
              background: "transparent",
              color: ORANGE,
              cursor: "pointer",
            }}
          >
            + Restaurant hinzufügen
          </button>
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
          lastLogin={(() => {
            const authId = (r as unknown as { auth_user_id?: string | null }).auth_user_id;
            if (!authId) return null;
            return lastLoginByUserId?.[authId] ?? null;
          })()}
          lastMenuUpdate={lastMenuUpdateByRestaurantId?.[r.id] ?? null}
          onToggleExpand={() => setExpandedId((cur) => (cur === r.id ? null : r.id))}
          onOpenAnalytics={() => {
            const { fromYmd, toYmd } = defaultLast7Ymd();
            router.push(`/founder/restaurants/${r.id}/analytics?from=${fromYmd}&to=${toYmd}`);
          }}
          onOpenStickerModal={() => setStickerModalFor(r.id)}
          onDeleteRestaurant={() => setDeleteTarget(r)}
          onLogoUpload={async (file) => {
            setPending(true);
            setSupabaseError(null);
            const path = `${r.id}/logo.png`;
            const { error } = await supabase.storage
              .from("restaurant-assets")
              .upload(path, file, { upsert: true, contentType: file.type || undefined });
            if (error) {
              console.error("Logo Upload Fehler:", error);
              setSupabaseError(error.message);
              setPending(false);
              return null;
            }
            const { data } = supabase.storage.from("restaurant-assets").getPublicUrl(path);
            const publicUrl = data?.publicUrl ?? null;
            setRestaurantItems((prev) =>
              prev.map((x) => (x.id === r.id ? { ...x, logo_url: publicUrl ?? x.logo_url } : x)),
            );
            setPending(false);
            return publicUrl;
          }}
        />
      ))}

      {addRestaurantOpen ? (
        <AddRestaurantModal
          isMobile={isMobile}
          onClose={() => setAddRestaurantOpen(false)}
          onSaved={onRefresh}
        />
      ) : null}

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
      {deleteTarget ? (
        <DeleteRestaurantModal
          restaurant={deleteTarget}
          pending={pending}
          countdown={deleteCountdown}
          onClose={() => setDeleteTarget(null)}
          onDelete={() => {
            if (deleteCountdown > 0) return;
            void (async () => {
              setPending(true);
              setSupabaseError(null);
              const { error } = await supabase.from("restaurants").delete().eq("id", deleteTarget.id);
              if (error) {
                console.error("Restaurant DELETE Fehler:", error);
                window.alert(`Löschen fehlgeschlagen: ${error.message}`);
                setSupabaseError(`Fehler: ${error.message}`);
                setPending(false);
                return;
              }
              setRestaurantItems((prev) => prev.filter((x) => x.id !== deleteTarget.id));
              setDeleteTarget(null);
              setPending(false);
              void onRefresh();
            })();
          }}
        />
      ) : null}
    </div>
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

function IconTrash() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <g stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M6 6l1 14h10l1-14" />
        <path d="M10 10v6M14 10v6" />
      </g>
    </svg>
  );
}

function IconUpload() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <g stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 16V4" />
        <path d="M8 8l4-4 4 4" />
        <path d="M4 20h16" />
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
        background: active ? "rgba(147,51,234,0.15)" : "rgba(255,255,255,0.05)",
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
        background: active ? "rgba(147,51,234,0.12)" : "transparent",
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
  onOpenAnalytics,
  onOpenStickerModal,
  onDeleteRestaurant,
  onLogoUpload,
  lastLogin,
  lastMenuUpdate,
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
  onOpenAnalytics: () => void;
  onOpenStickerModal: () => void;
  onDeleteRestaurant: () => void;
  onLogoUpload: (file: File) => Promise<string | null>;
  lastLogin: string | null;
  lastMenuUpdate: string | null;
}) {
  const st = restaurantUiStatus(r);
  const pill = statusPillStyle(st);
  const consent = consentForRestaurant(scanEvents, r.id);
  const byBereich = useMemo(() => groupTablesByBereich(tables), [tables]);
  const [hasLogo, setHasLogo] = useState(false);
  const [logoChecking, setLogoChecking] = useState(true);
  const [logoUploading, setLogoUploading] = useState(false);
  const [localLogoPreview, setLocalLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLogoChecking(true);
    const explicit = r.logo_url?.trim() || null;
    const candidate =
      explicit ??
      supabase.storage.from("restaurant-assets").getPublicUrl(`${r.id}/logo.png`).data?.publicUrl ??
      null;
    if (!candidate) {
      setHasLogo(false);
      setLogoChecking(false);
      return;
    }
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setHasLogo(true);
      setLogoChecking(false);
    };
    img.onerror = () => {
      if (cancelled) return;
      setHasLogo(false);
      setLogoChecking(false);
    };
    img.src = candidate;
    return () => {
      cancelled = true;
    };
  }, [r.id, r.logo_url]);

  useEffect(() => {
    return () => {
      if (localLogoPreview?.startsWith("blob:")) URL.revokeObjectURL(localLogoPreview);
    };
  }, [localLogoPreview]);

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

        <div
          className="mb-3 flex flex-col gap-1 rounded-xl px-3 py-2 text-[12px]"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.65)" }}
        >
          <div className="flex items-center justify-between gap-2">
            <span style={{ color: "rgba(255,255,255,0.45)" }}>Letzter Login</span>
            <span style={{ color: stalenessColor(lastLogin, 14), fontVariantNumeric: "tabular-nums" }}>
              {formatRelativeDe(lastLogin)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span style={{ color: "rgba(255,255,255,0.45)" }}>Karte aktualisiert</span>
            <span style={{ color: stalenessColor(lastMenuUpdate, 30), fontVariantNumeric: "tabular-nums" }}>
              {formatRelativeDe(lastMenuUpdate)}
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

          {Array.isArray(r.tisch_bereiche) && r.tisch_bereiche.length > 0 ? (
            <div className="mb-5">
              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.1em",
                  color: "rgba(255,255,255,0.4)",
                }}
              >
                BEREICHE (vom Wirt gepflegt)
              </p>
              <div className="flex flex-wrap gap-2">
                {r.tisch_bereiche.map((b, idx) => (
                  <span
                    key={`${b.name}-${idx}`}
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "0.5px solid rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.85)",
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>{b.name}</span>
                    <span style={{ color: "rgba(255,255,255,0.5)" }}>·</span>
                    <span style={{ color: "rgba(255,255,255,0.65)" }}>
                      {b.count} {b.count === 1 ? "Tisch" : "Tische"}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}

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
              background: "rgba(147,51,234,0.06)",
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
            <NoteEditor restaurantId={r.id} ext={ext ?? null} pending={pending} />
          </div>

          <div className="flex flex-wrap gap-2" style={{ gap: 8 }}>
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
            <label
              className="cursor-pointer"
              style={{
                ...glassActionBtn,
                border: hasLogo
                  ? "1px solid rgba(52,232,158,0.45)"
                  : "1px solid rgba(255,255,255,0.12)",
                background: hasLogo ? "rgba(52,232,158,0.15)" : "rgba(255,255,255,0.06)",
                color: hasLogo ? "#34e89e" : "rgba(255,255,255,0.88)",
                opacity: logoUploading ? 0.8 : 1,
              }}
            >
              <span style={{ ...actionIconWrap, color: hasLogo ? "#34e89e" : actionIconWrap.color }}>
                <IconUpload />
              </span>
              <span>
                {logoUploading
                  ? "Wird hochgeladen..."
                  : logoChecking
                    ? "Logo prüfen..."
                    : hasLogo
                      ? "Logo hochgeladen ✓"
                      : "Logo hochladen"}
              </span>
              {hasLogo ? (
                // eslint-disable-next-line @next/next/no-img-element -- local blob/public preview
                <img
                  src={localLogoPreview ?? r.logo_url ?? ""}
                  alt=""
                  width={40}
                  height={40}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    objectFit: "cover",
                    border: "1px solid rgba(255,255,255,0.2)",
                    marginTop: 2,
                  }}
                />
              ) : null}
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const blobUrl = URL.createObjectURL(file);
                  setLocalLogoPreview((prev) => {
                    if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
                    return blobUrl;
                  });
                  setLogoUploading(true);
                  void onLogoUpload(file)
                    .then((publicUrl) => {
                      if (publicUrl) setLocalLogoPreview(publicUrl);
                      setHasLogo(true);
                    })
                    .finally(() => {
                      setLogoUploading(false);
                    });
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <button
              type="button"
              disabled={pending}
              onClick={onDeleteRestaurant}
              style={{
                ...glassActionBtn,
                border: "1px solid rgba(255,75,110,0.4)",
                background: "rgba(255,75,110,0.14)",
                color: "#ff4b6e",
              }}
            >
              <span style={{ ...actionIconWrap, color: "#ff4b6e" }}>
                <IconTrash />
              </span>
              <span>Restaurant löschen</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NoteEditor({
  restaurantId,
  ext,
  pending,
}: {
  restaurantId: string;
  ext: FounderRestaurantExtRow | null;
  pending: boolean;
}) {
  const [draft, setDraft] = useState(ext?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSavedRef = useRef<string>(ext?.note ?? "");

  // Sync, falls ext.note von außen ändert (z. B. nach Refresh).
  useEffect(() => {
    const next = ext?.note ?? "";
    setDraft(next);
    lastSavedRef.current = next;
  }, [ext?.note]);

  async function commit(value: string) {
    if (value === lastSavedRef.current) return;
    setSaving(true);
    setError(null);
    const { error: dbErr } = await supabase
      .from("founder_restaurants")
      .upsert(
        {
          restaurant_id: restaurantId,
          next_visit: ext?.next_visit ?? null,
          last_visit: ext?.last_visit ?? null,
          note: value.trim() || null,
          sticker_tier: ext?.sticker_tier ?? null,
          sticker_count: ext?.sticker_count ?? 0,
          sticker_paid: ext?.sticker_paid ?? false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "restaurant_id" },
      );
    setSaving(false);
    if (dbErr) {
      setError(dbErr.message);
      return;
    }
    lastSavedRef.current = value;
  }

  return (
    <>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit(draft)}
        onKeyDown={(e) => {
          if ((e.key === "Enter" && (e.metaKey || e.ctrlKey)) || (e.key === "Enter" && !e.shiftKey)) {
            e.preventDefault();
            (e.target as HTMLTextAreaElement).blur();
          }
        }}
        placeholder="Notiz hinzufügen … (Enter speichert, Shift+Enter = Zeilenumbruch)"
        rows={3}
        disabled={pending || saving}
        style={{
          width: "100%",
          background: "rgba(255,255,255,0.04)",
          border: "0.5px solid rgba(255,255,255,0.12)",
          borderRadius: 10,
          padding: "10px 12px",
          color: "rgba(255,255,255,0.92)",
          fontSize: 14,
          lineHeight: 1.5,
          fontFamily: "inherit",
          resize: "vertical",
          outline: "none",
          opacity: pending || saving ? 0.7 : 1,
        }}
      />
      <div className="mt-1 flex items-center justify-between" style={{ fontSize: 11 }}>
        <span style={{ color: "rgba(255,255,255,0.35)" }}>
          {saving
            ? "Speichert …"
            : draft === lastSavedRef.current
              ? "Gespeichert"
              : "Ungespeicherte Änderungen"}
        </span>
        {error ? <span style={{ color: ERR_RED }}>{error}</span> : null}
      </div>
    </>
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

function DeleteRestaurantModal({
  restaurant,
  pending,
  countdown,
  onClose,
  onDelete,
}: {
  restaurant: FounderRestaurantRow;
  pending: boolean;
  countdown: number;
  onClose: () => void;
  onDelete: () => void;
}) {
  const deleteLabel =
    countdown > 0 ? `Löschen (${countdown})...` : pending ? "Löscht..." : "Endgültig löschen";
  return (
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center p-4 sm:items-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby="delete-restaurant-title"
        className="w-full"
        style={{
          maxWidth: 420,
          background: "#0f0f1a",
          border: "1px solid rgba(255,75,110,0.3)",
          borderRadius: 16,
          padding: 24,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 26, marginBottom: 8 }}>⚠️</div>
        <h3 id="delete-restaurant-title" style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#fff" }}>
          Restaurant löschen?
        </h3>
        <p style={{ margin: "10px 0 0", color: "rgba(255,255,255,0.72)", fontSize: 14, lineHeight: 1.5 }}>
          Bist du sicher, dass du <strong style={{ color: "#fff" }}>{restaurant.name}</strong> löschen möchtest?
          Diese Aktion kann nicht rückgängig gemacht werden.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            style={{
              flex: 1,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.8)",
              borderRadius: 12,
              padding: "11px 12px",
              fontWeight: 700,
              cursor: pending ? "not-allowed" : "pointer",
            }}
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={pending || countdown > 0}
            style={{
              flex: 1,
              border: "none",
              background: "#ff4b6e",
              color: "#fff",
              borderRadius: 12,
              padding: "11px 12px",
              fontWeight: 800,
              cursor: pending || countdown > 0 ? "not-allowed" : "pointer",
              opacity: pending || countdown > 0 ? 0.7 : 1,
            }}
          >
            {deleteLabel}
          </button>
        </div>
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
                background: tier === t.key ? "rgba(147,51,234,0.15)" : "rgba(255,255,255,0.05)",
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
