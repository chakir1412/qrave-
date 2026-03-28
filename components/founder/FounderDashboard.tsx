"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import { supabase } from "@/lib/supabase";
import type { FounderDashboardData } from "@/lib/founder-types";
import type { FounderMainTab } from "./constants";
import { fp } from "./founder-palette";
import {
  IconKontakte,
  IconLogout,
  IconOverview,
  IconRestaurants,
  IconSettings,
  IconTodo,
} from "./founder-sidebar-icons";
import { OverviewTab } from "./tabs/OverviewTab";
import { RestaurantsTab } from "./tabs/RestaurantsTab";
import { KontakteTab } from "./tabs/KontakteTab";
import { TodoTab } from "./tabs/TodoTab";

type Props = {
  data: FounderDashboardData;
};

const SIDEBAR_W = 64;

const tabs: {
  id: FounderMainTab;
  label: string;
  Icon: (p: { active: boolean }) => ReactElement;
}[] = [
  { id: "overview", label: "Übersicht", Icon: IconOverview },
  { id: "restaurants", label: "Restaurants", Icon: IconRestaurants },
  { id: "kontakte", label: "Kontakte", Icon: IconKontakte },
  { id: "todo", label: "To-Do", Icon: IconTodo },
  { id: "settings", label: "Einstellungen", Icon: IconSettings },
];

function formatFounderDate(): string {
  return new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const sidebarStyle: CSSProperties = {
  position: "fixed",
  left: 0,
  top: 0,
  zIndex: 50,
  width: SIDEBAR_W,
  height: "100vh",
  background: fp.sidebar,
  borderRight: `1px solid ${fp.line}`,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  paddingTop: 16,
  paddingBottom: 16,
  boxShadow: "4px 0 24px rgba(0,0,0,0.25)",
};

export function FounderDashboard({ data: initialData }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<FounderMainTab>("overview");
  const [data, setData] = useState<FounderDashboardData>(initialData);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data: u }) => {
      setUserEmail(u.user?.email ?? null);
    });
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem("founder-dashboard-tab");
    if (
      stored === "overview" ||
      stored === "restaurants" ||
      stored === "kontakte" ||
      stored === "todo" ||
      stored === "settings"
    ) {
      setTab(stored);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("founder-dashboard-tab", tab);
  }, [tab]);

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

  const currentLabel = tabs.find((t) => t.id === tab)?.label ?? "Übersicht";

  const mainInner = (
    <>
      {loadError ? (
        <div
          style={{
            marginBottom: 20,
            padding: "14px 18px",
            borderRadius: 14,
            border: `1px solid ${fp.red}55`,
            background: "rgba(255,75,110,0.1)",
            color: fp.red,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {loadError}
          <div style={{ marginTop: 8, color: fp.mu, fontSize: 12 }}>
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
      {tab === "settings" ? (
        <div
          style={{
            background: fp.card,
            borderRadius: 16,
            border: `1px solid ${fp.line}`,
            boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
            padding: 28,
            maxWidth: 560,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: fp.tx }}>Einstellungen</h2>
          <p style={{ margin: "12px 0 0", fontSize: 14, color: fp.mu, lineHeight: 1.55 }}>
            Platzhalter für künftige Founder-Einstellungen (Benachrichtigungen, Exporte, API-Keys).
          </p>
          <p style={{ margin: "16px 0 0", fontSize: 13, color: fp.mi }}>
            Angemeldet als <strong style={{ color: fp.tx }}>{userEmail ?? "—"}</strong>
          </p>
        </div>
      ) : null}
    </>
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        fontFamily: "inherit",
        color: fp.tx,
        background: "transparent",
      }}
    >
      <aside style={sidebarStyle} aria-label="Hauptnavigation">
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            marginBottom: 20,
            background: `linear-gradient(135deg, ${fp.or}, #ff8c4a)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: 16,
            color: "#fff",
            boxShadow: `0 6px 20px ${fp.or}55`,
          }}
        >
          Q
        </div>
        <nav className="flex flex-1 flex-col items-center gap-1" style={{ flex: 1 }}>
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                title={t.label}
                aria-label={t.label}
                aria-current={active ? "page" : undefined}
                onClick={() => setTab(t.id)}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: active ? "rgba(255,92,26,0.15)" : "transparent",
                  boxShadow: active ? `inset 0 0 0 1px ${fp.or}44` : "none",
                }}
              >
                <t.Icon active={active} />
              </button>
            );
          })}
        </nav>
        <button
          type="button"
          title="Abmelden"
          aria-label="Abmelden"
          onClick={() => void handleLogout()}
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,75,110,0.08)",
            marginTop: 8,
          }}
        >
          <IconLogout />
        </button>
      </aside>

      <div style={{ marginLeft: SIDEBAR_W, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 40,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "18px 28px",
            borderBottom: `1px solid ${fp.line}`,
            background: "rgba(12,12,15,0.85)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: fp.tx, letterSpacing: "-0.02em" }}>
              {currentLabel}
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: fp.mu }}>{formatFounderDate()}</p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="hidden sm:inline"
              style={{ fontSize: 12, color: fp.mu, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}
            >
              {userEmail ?? ""}
            </span>
            <button
              type="button"
              onClick={() => void loadData()}
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                border: `1px solid ${fp.line}`,
                background: "rgba(255,255,255,0.04)",
                color: fp.mi,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Aktualisieren
            </button>
          </div>
        </header>

        <main
          style={{
            flex: 1,
            overflow: "auto",
            padding: "24px 28px 40px",
          }}
        >
          {mainInner}
        </main>
      </div>
    </div>
  );
}
