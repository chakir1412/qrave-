"use client";

import { Roboto } from "next/font/google";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FOUNDER_DESKTOP_MEDIA, useMediaQuery } from "@/hooks/useMediaQuery";
import { supabase } from "@/lib/supabase";
import type { FounderDashboardData } from "@/lib/founder-types";
import type { FounderMainTab } from "./constants";
import { founderDash, founderGlassCard } from "./constants";
import { OverviewTab } from "./tabs/OverviewTab";
import { RestaurantsTab } from "./tabs/RestaurantsTab";
import { KontakteTab } from "./tabs/KontakteTab";
import { TodoTab } from "./tabs/TodoTab";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
});

type Props = {
  data: FounderDashboardData;
};

const tabs: { id: FounderMainTab; label: string; icon: string }[] = [
  { id: "overview", label: "Übersicht", icon: "📊" },
  { id: "restaurants", label: "Restaurants", icon: "🏪" },
  { id: "kontakte", label: "Kontakte", icon: "🤝" },
  { id: "todo", label: "To-Do", icon: "✅" },
];

export function FounderDashboard({ data: initialData }: Props) {
  const router = useRouter();
  const isDesktop = useMediaQuery(FOUNDER_DESKTOP_MEDIA);
  const [tab, setTab] = useState<FounderMainTab>("overview");
  const [data, setData] = useState<FounderDashboardData>(initialData);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => {
    const stored = window.localStorage.getItem("founder-dashboard-tab");
    if (stored === "overview" || stored === "restaurants" || stored === "kontakte" || stored === "todo") {
      setTab(stored);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("founder-dashboard-tab", tab);
  }, [tab]);

  useEffect(() => {
    if (!navOpen) return;
    function onDoc(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setNavOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [navOpen]);

  async function loadData() {
    setLoadError(null);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [restaurantsRes, scansRes, pipelineRes, todosRes, extRes] = await Promise.all([
      supabase.from("restaurants").select("*").order("created_at", { ascending: false }),
      supabase
        .from("scan_events")
        .select(
          "event_type, stunde, wochentag, monat, tisch_nummer, item_name, kategorie, main_tab, duration_seconds, tier, created_at, restaurant_id",
        )
        .gt("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("founder_pipeline").select("*").order("added_at", { ascending: false }),
      supabase.from("founder_todos").select("*").order("created_at", { ascending: false }),
      supabase.from("founder_restaurants").select("*"),
    ]);
    const errors = [restaurantsRes.error, scansRes.error, pipelineRes.error, todosRes.error, extRes.error]
      .filter((x) => x)
      .map((x) => x?.message ?? "");
    if (errors.length > 0) {
      setLoadError(errors.join(" · "));
    }
    setData({
      restaurants: (restaurantsRes.data ?? []) as FounderDashboardData["restaurants"],
      scanEvents: (scansRes.data ?? []) as FounderDashboardData["scanEvents"],
      pipeline: (pipelineRes.data ?? []) as FounderDashboardData["pipeline"],
      todos: (todosRes.data ?? []) as FounderDashboardData["todos"],
      restaurantExtras: (extRes.data ?? []) as FounderDashboardData["restaurantExtras"],
    });
  }

  async function saveRestaurantExt(
    restaurantId: string,
    patch: {
      next_visit: string;
      last_visit: string;
      note: string;
      sticker_tier: string;
      sticker_paid: boolean;
      sticker_count: number;
    },
  ) {
    setBusy(true);
    try {
      const row = {
        restaurant_id: restaurantId,
        next_visit: patch.next_visit.trim() || null,
        last_visit: patch.last_visit.trim() || null,
        note: patch.note.trim() || null,
        sticker_tier: patch.sticker_tier.trim() || null,
        sticker_paid: patch.sticker_paid,
        sticker_count: patch.sticker_count,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("founder_restaurants").upsert(row, {
        onConflict: "restaurant_id",
      });
      if (error) {
        setLoadError(error.message);
        return;
      }
      await loadData();
    } finally {
      setBusy(false);
    }
  }

  async function addPipeline(entry: {
    name: string;
    contact: string;
    phone: string;
    area: string;
    heat: string;
    stage: string;
  }) {
    setBusy(true);
    try {
      const { error } = await supabase.from("founder_pipeline").insert({
        name: entry.name,
        contact: entry.contact || null,
        phone: entry.phone || null,
        area: entry.area || null,
        heat: entry.heat,
        stage: entry.stage,
      });
      if (error) {
        setLoadError(error.message);
        return;
      }
      await loadData();
    } finally {
      setBusy(false);
    }
  }

  async function addWerbepartner(entry: {
    name: string;
    company: string;
    contact: string;
    phone: string;
    mrr_monthly: number;
  }) {
    void entry;
  }

  async function toggleTodo(id: string, done: boolean) {
    setBusy(true);
    try {
      const { error } = await supabase.from("founder_todos").update({ done }).eq("id", id);
      if (error) {
        setLoadError(error.message);
        return;
      }
      await loadData();
    } finally {
      setBusy(false);
    }
  }

  async function setTodoPrio(id: string, prio: "h" | "m" | "l") {
    setBusy(true);
    try {
      const { error } = await supabase.from("founder_todos").update({ prio }).eq("id", id);
      if (error) {
        setLoadError(error.message);
        return;
      }
      await loadData();
    } finally {
      setBusy(false);
    }
  }

  async function addTodo(text: string, sub: string, prio: "h" | "m" | "l") {
    setBusy(true);
    try {
      const { error } = await supabase.from("founder_todos").insert({
        text,
        sub: sub || null,
        prio,
      });
      if (error) {
        setLoadError(error.message);
        return;
      }
      await loadData();
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/founder/login");
  }

  function selectTab(id: FounderMainTab) {
    setTab(id);
    setNavOpen(false);
  }

  const tabContent = (
    <>
      {loadError ? (
        <div
          className="mb-4 px-4 py-3 text-xs leading-relaxed"
          style={{
            ...founderGlassCard,
            borderColor: "rgba(255,75,110,0.35)",
            background: "rgba(255,75,110,0.08)",
            color: founderDash.re,
          }}
        >
          {loadError}
          <div className="mt-2" style={{ color: founderDash.mu }}>
            Hast du die Founder-Migration in Supabase ausgeführt?
          </div>
        </div>
      ) : null}

      {tab === "overview" ? <OverviewTab data={data} /> : null}
      {tab === "restaurants" ? (
        <RestaurantsTab
          restaurants={data.restaurants}
          scanEvents={data.scanEvents}
          restaurantExtras={data.restaurantExtras}
          saving={busy}
          onSaveExt={(id, p) => saveRestaurantExt(id, p)}
        />
      ) : null}
      {tab === "kontakte" ? (
        <KontakteTab
          pipeline={data.pipeline}
          werbepartner={[]}
          busy={busy}
          onAddPipeline={(row) => addPipeline(row)}
          onAddWerbepartner={(row) => addWerbepartner(row)}
        />
      ) : null}
      {tab === "todo" ? (
        <TodoTab
          todos={data.todos}
          busy={busy}
          onToggle={(id, done) => toggleTodo(id, done)}
          onPrio={(id, prio) => setTodoPrio(id, prio)}
          onAdd={(text, sub, prio) => addTodo(text, sub, prio)}
        />
      ) : null}
    </>
  );

  const refreshBtn = (
    <button
      type="button"
      onClick={() => void loadData()}
      className="shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition active:scale-[0.98]"
      style={{
        ...founderGlassCard,
        borderRadius: 14,
        color: founderDash.or,
      }}
    >
      Aktualisieren
    </button>
  );

  return (
    <div
      className={`${roboto.className} relative min-h-screen`}
      style={{ backgroundColor: founderDash.bg, color: founderDash.tx }}
    >
      <div className="founder-dash-aurora" aria-hidden>
        <div className="founder-dash-al founder-dash-al1" />
        <div className="founder-dash-al founder-dash-al2" />
        <div className="founder-dash-al founder-dash-al3" />
        <div className="founder-dash-al founder-dash-al4" />
      </div>

      {isDesktop ? (
        <div className="flex min-h-screen">
          <aside
            className="fixed left-0 top-0 z-40 flex h-screen w-[220px] flex-col border-r px-3 py-5"
            style={{
              ...founderGlassCard,
              borderRadius: 0,
              borderTop: "none",
              borderBottom: "none",
              borderLeft: "none",
              background: "rgba(7,8,24,0.65)",
              borderColor: "rgba(255,255,255,0.11)",
            }}
          >
            <div className="mb-8 flex justify-center px-2">
              <Image
                src="/qrave-logo.png"
                alt="Qrave"
                width={120}
                height={36}
                className="h-8 w-auto brightness-0 invert"
                priority
              />
            </div>
            <nav className="flex flex-col gap-1">
              {tabs.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => selectTab(t.id)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition"
                    style={{
                      backgroundColor: active ? founderDash.ord : "transparent",
                      color: active ? founderDash.or : founderDash.mi,
                      border: active ? `1px solid ${founderDash.orm}` : "1px solid transparent",
                    }}
                  >
                    <span aria-hidden>{t.icon}</span>
                    {t.label}
                  </button>
                );
              })}
            </nav>
            <div className="flex-1" />
            <div
              className="mt-4 space-y-2 border-t pt-4"
              style={{ borderColor: "rgba(255,255,255,0.11)" }}
            >
              <div className="px-2 text-xs font-semibold" style={{ color: founderDash.mi }}>
                Chakir Q
              </div>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="w-full rounded-xl py-2.5 text-xs font-bold"
                style={{
                  border: `1px solid ${founderDash.bo}`,
                  color: founderDash.re,
                  background: "rgba(255,75,110,0.08)",
                }}
              >
                Abmelden
              </button>
            </div>
          </aside>
          <main
            className="min-h-screen flex-1"
            style={{
              paddingTop: "1.5rem",
              paddingRight: "1.5rem",
              paddingBottom: "2rem",
              paddingLeft: "calc(220px + 1.5rem)",
            }}
          >
            <div className="mx-auto w-full max-w-[1200px]">{tabContent}</div>
          </main>
        </div>
      ) : (
        <>
          <div className="relative z-10 mx-auto max-w-[430px] px-4 pb-28 pt-4">
            <header ref={navRef} className="relative mb-3 flex items-center justify-between gap-2">
              <div className="relative min-w-0">
                <button
                  type="button"
                  onClick={() => setNavOpen((o) => !o)}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left"
                  style={{ ...founderGlassCard, borderRadius: 16 }}
                  aria-expanded={navOpen}
                  aria-haspopup="true"
                >
                  <span className="truncate text-sm font-black" style={{ color: founderDash.tx }}>
                    Chakir Q
                  </span>
                  <span className="ml-auto text-[10px] font-bold" style={{ color: founderDash.or }}>
                    {navOpen ? "▲" : "▼"}
                  </span>
                </button>
                {navOpen ? (
                  <div
                    className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden py-1"
                    style={{ ...founderGlassCard, borderRadius: 16, padding: 6 }}
                  >
                    {tabs.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => selectTab(t.id)}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-bold"
                        style={{
                          backgroundColor: tab === t.id ? founderDash.ord : "transparent",
                          color: tab === t.id ? founderDash.or : founderDash.mi,
                        }}
                      >
                        <span aria-hidden>{t.icon}</span>
                        {t.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              {refreshBtn}
            </header>

            <div
              className="mb-4 flex items-center justify-center px-3 py-2 text-center text-[11px] font-bold tracking-wide"
              style={{ ...founderGlassCard, borderRadius: 14, color: founderDash.ye }}
            >
              Phase 1 — Frankfurt
            </div>

            {tabContent}
          </div>

          <nav
            className="fixed bottom-0 left-0 right-0 z-[100] border-t px-2 pt-2"
            style={{
              backgroundColor: "rgba(7,8,24,0.82)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderColor: "rgba(255,255,255,0.11)",
              paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
            }}
          >
            <div className="mx-auto flex max-w-[430px] items-stretch justify-between gap-1">
              {tabs.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] font-bold transition active:scale-[0.98]"
                    style={{
                      backgroundColor: active ? founderDash.ord : "transparent",
                      color: active ? founderDash.or : founderDash.mu,
                      border: active ? `1px solid ${founderDash.orm}` : "1px solid transparent",
                    }}
                  >
                    <span className="text-base leading-none" aria-hidden>
                      {t.icon}
                    </span>
                    <span className="truncate px-0.5">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        </>
      )}

      <style jsx global>{`
        .founder-dash-aurora {
          position: fixed;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          overflow: hidden;
          background: #070818;
        }
        .founder-dash-al {
          position: absolute;
          inset: 0;
          will-change: transform;
        }
        .founder-dash-al1 {
          background: radial-gradient(
            ellipse 120% 40% at 60% 20%,
            rgba(255, 92, 26, 0.12) 0%,
            transparent 70%
          );
          animation: founderDashAurora1 14s ease-in-out infinite alternate;
        }
        .founder-dash-al2 {
          background: radial-gradient(
            ellipse 100% 35% at 30% 50%,
            rgba(91, 155, 255, 0.1) 0%,
            transparent 68%
          );
          animation: founderDashAurora2 18s ease-in-out infinite alternate;
        }
        .founder-dash-al3 {
          background: radial-gradient(
            ellipse 90% 30% at 70% 70%,
            rgba(52, 232, 158, 0.08) 0%,
            transparent 65%
          );
          animation: founderDashAurora3 12s ease-in-out infinite alternate;
        }
        .founder-dash-al4 {
          background: radial-gradient(
            ellipse 80% 25% at 20% 80%,
            rgba(255, 75, 110, 0.07) 0%,
            transparent 62%
          );
          animation: founderDashAurora4 20s ease-in-out infinite alternate;
        }
        @keyframes founderDashAurora1 {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          100% {
            transform: translate3d(4%, 5%, 0) scale(1.08);
          }
        }
        @keyframes founderDashAurora2 {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          100% {
            transform: translate3d(6%, -4%, 0) scale(1.06);
          }
        }
        @keyframes founderDashAurora3 {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          100% {
            transform: translate3d(-5%, 3%, 0) scale(1.1);
          }
        }
        @keyframes founderDashAurora4 {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          100% {
            transform: translate3d(5%, -6%, 0) scale(1.07);
          }
        }
      `}</style>
    </div>
  );
}
