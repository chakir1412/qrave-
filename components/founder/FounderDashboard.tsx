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
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { OverviewTab } from "./tabs/OverviewTab";
import { RestaurantsTab } from "./tabs/RestaurantsTab";
import { KontakteTab } from "./tabs/KontakteTab";
import { TodoTab } from "./tabs/TodoTab";

type Props = {
  data: FounderDashboardData;
  initialLoadError?: string | null;
};

const PHASE_LIVE_TARGET = 50;

const tabs: {
  id: FounderMainTab;
  label: string;
  navMobile: string;
  Icon: (p: { active: boolean; size?: number }) => ReactElement;
}[] = [
  { id: "overview", label: "Übersicht", navMobile: "Übersicht", Icon: IconOverview },
  { id: "restaurants", label: "Restaurants", navMobile: "Restaurants", Icon: IconRestaurants },
  { id: "kontakte", label: "Kontakte", navMobile: "Kontakte", Icon: IconKontakte },
  { id: "todo", label: "To-Do", navMobile: "To-Do", Icon: IconTodo },
  { id: "settings", label: "Einstellungen", navMobile: "⋯", Icon: IconSettings },
];

const MOBILE_TAB_IDS: FounderMainTab[] = ["overview", "restaurants", "kontakte", "todo"];

function greetingDE(): string {
  const h = new Date().getHours();
  if (h < 11) return "Guten Morgen";
  if (h < 18) return "Guten Tag";
  return "Guten Abend";
}

function formatFounderDate(): string {
  return new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function FounderDashboard({ data: initialData, initialLoadError = null }: Props) {
  const router = useRouter();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const isTablet = useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const [tab, setTab] = useState<FounderMainTab>("overview");
  const [data, setData] = useState<FounderDashboardData>(initialData);
  const [loadError, setLoadError] = useState<string | null>(initialLoadError);
  const [refreshing, setRefreshing] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const sidebarW = isMobile ? 0 : isTablet ? 56 : 64;
  const aktivLive = data.restaurants.filter((r) => r.aktiv).length;

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

  useEffect(() => {
    if (isMobile && tab === "settings") {
      setTab("overview");
    }
  }, [isMobile, tab]);

  async function loadData() {
    setRefreshing(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/founder/refresh", { credentials: "same-origin" });
      if (!res.ok) {
        setLoadError("Fehler beim Laden");
        return;
      }
      const newData = (await res.json()) as FounderDashboardData;
      setData((prev) => ({ ...prev, ...newData }));
    } catch {
      setLoadError("Netzwerkfehler");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/founder/login");
  }

  const currentLabel = tabs.find((t) => t.id === tab)?.label ?? "Übersicht";

  const sidebarStyle: CSSProperties = {
    position: "fixed",
    left: 0,
    top: 0,
    zIndex: 50,
    width: sidebarW,
    height: "100vh",
    background: fp.sidebar,
    borderRight: `1px solid ${fp.line}`,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    paddingTop: isTablet ? 12 : 16,
    paddingBottom: isTablet ? 12 : 16,
    boxShadow: "4px 0 24px rgba(0,0,0,0.25)",
  };

  const navBtnSize = isTablet ? 44 : 48;
  const logoBox = isTablet ? 36 : 40;

  const mainInner = (
    <>
      {loadError ? (
        <div
          style={{
            marginBottom: isMobile ? 14 : 20,
            padding: isMobile ? "12px 14px" : "14px 18px",
            borderRadius: 14,
            border: `1px solid ${fp.red}55`,
            background: "rgba(255,75,110,0.1)",
            color: fp.red,
            fontSize: isMobile ? 12 : 13,
            lineHeight: 1.5,
          }}
        >
          {loadError}
          <div style={{ marginTop: 8, color: fp.mu, fontSize: 11 }}>
            Tabelle <code style={{ color: fp.mi }}>restaurant_tables</code> ggf. per Migration anlegen.
          </div>
        </div>
      ) : null}

      {tab === "overview" ? (
        <OverviewTab data={data} isMobile={isMobile} isTablet={isTablet} isDesktop={isDesktop} />
      ) : null}
      {tab === "restaurants" ? (
        <RestaurantsTab
          restaurants={data.restaurants}
          scanEvents={data.scanEvents}
          restaurantExtras={data.restaurantExtras}
          restaurantTables={data.restaurantTables}
          isMobile={isMobile}
          onRefresh={() => loadData()}
        />
      ) : null}
      {tab === "kontakte" ? (
        <KontakteTab pipeline={data.pipeline} isMobile={isMobile} onRefresh={() => loadData()} />
      ) : null}
      {tab === "todo" ? <TodoTab todos={data.todos} isMobile={isMobile} onRefresh={() => loadData()} /> : null}
      {tab === "settings" && !isMobile ? (
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
            Platzhalter für künftige Founder-Einstellungen.
          </p>
          <p style={{ margin: "16px 0 0", fontSize: 13, color: fp.mi }}>
            Angemeldet als <strong style={{ color: fp.tx }}>{userEmail ?? "—"}</strong>
          </p>
        </div>
      ) : null}
    </>
  );

  const phasePill = (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        borderRadius: 9999,
        border: `1px solid ${fp.or}44`,
        background: "rgba(255,92,26,0.1)",
        marginTop: isMobile ? 8 : 10,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 9999, background: fp.or, boxShadow: `0 0 8px ${fp.or}` }} />
      <span style={{ fontSize: 11, fontWeight: 800, color: fp.tx }}>Phase 1 — Frankfurt</span>
      <span style={{ fontSize: 11, fontWeight: 800, color: fp.or, fontVariantNumeric: "tabular-nums" }}>
        {aktivLive} / {PHASE_LIVE_TARGET}
      </span>
    </div>
  );

  const topbar = (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: isMobile ? "14px 16px" : isTablet ? "16px 20px" : "18px 28px",
        borderBottom: `1px solid ${fp.line}`,
        background: "rgba(12,12,15,0.9)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {isMobile ? (
        <>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                flexShrink: 0,
                background: `linear-gradient(135deg, ${fp.or}, #ff8c4a)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: 15,
                color: "#fff",
              }}
            >
              Q
            </div>
            <div className="min-w-0">
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: fp.mu, textTransform: "uppercase" }}>
                {greetingDE()}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 800, color: fp.tx, lineHeight: 1.2 }}>
                Founder
              </p>
              {phasePill}
            </div>
          </div>
          <button
            type="button"
            disabled={refreshing}
            onClick={() => void loadData()}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: `1px solid ${fp.line}`,
              background: "rgba(255,255,255,0.04)",
              color: fp.mi,
              fontSize: 12,
              fontWeight: 700,
              cursor: refreshing ? "not-allowed" : "pointer",
              flexShrink: 0,
              opacity: refreshing ? 0.7 : 1,
            }}
          >
            {refreshing ? "Lädt…" : "Aktualisieren"}
          </button>
        </>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: fp.mu, textTransform: "uppercase" }}>
              {greetingDE()}
            </p>
            <h1
              style={{
                margin: "4px 0 0",
                fontSize: isTablet ? 18 : 20,
                fontWeight: 800,
                color: fp.tx,
                letterSpacing: "-0.02em",
              }}
            >
              {currentLabel}
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: fp.mu }}>{formatFounderDate()}</p>
            {phasePill}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <span
              style={{
                fontSize: 12,
                color: fp.mu,
                maxWidth: 200,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                display: isTablet ? "none" : "block",
              }}
            >
              {userEmail ?? ""}
            </span>
            <button
              type="button"
              disabled={refreshing}
              onClick={() => void loadData()}
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                border: `1px solid ${fp.line}`,
                background: "rgba(255,255,255,0.04)",
                color: fp.mi,
                fontSize: 13,
                fontWeight: 700,
                cursor: refreshing ? "not-allowed" : "pointer",
                opacity: refreshing ? 0.7 : 1,
              }}
            >
              {refreshing ? "Lädt…" : "Aktualisieren"}
            </button>
          </div>
        </>
      )}
    </header>
  );

  const bottomNav = isMobile ? (
    <nav
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 60,
        display: "flex",
        justifyContent: "space-around",
        alignItems: "stretch",
        padding: "8px 6px calc(8px + env(safe-area-inset-bottom, 0px))",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(12,12,15,0.9)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.35)",
      }}
      aria-label="Hauptnavigation"
    >
      {MOBILE_TAB_IDS.map((id) => {
        const t = tabs.find((x) => x.id === id)!;
        const active = tab === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              padding: "6px 4px",
              border: "none",
              borderRadius: 12,
              cursor: "pointer",
              background: active ? "rgba(255,92,26,0.12)" : "transparent",
              color: active ? fp.or : fp.mu,
            }}
            aria-current={active ? "page" : undefined}
          >
            <t.Icon active={active} size={20} />
            <span style={{ fontSize: 9, fontWeight: 800, textAlign: "center", lineHeight: 1.15, maxWidth: 72 }}>
              {t.navMobile}
            </span>
          </button>
        );
      })}
    </nav>
  ) : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        fontFamily: "inherit",
        color: fp.tx,
        background: "transparent",
        paddingBottom: isMobile ? "calc(72px + env(safe-area-inset-bottom, 0px))" : 0,
      }}
    >
      {!isMobile ? (
        <aside style={sidebarStyle} aria-label="Hauptnavigation">
          <div
            style={{
              width: logoBox,
              height: logoBox,
              borderRadius: 12,
              marginBottom: isTablet ? 14 : 20,
              background: `linear-gradient(135deg, ${fp.or}, #ff8c4a)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: isTablet ? 14 : 16,
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
                    width: navBtnSize,
                    height: navBtnSize,
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
                  <t.Icon active={active} size={isTablet ? 20 : 22} />
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
              width: navBtnSize,
              height: navBtnSize,
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
            <IconLogout size={isTablet ? 20 : 22} />
          </button>
        </aside>
      ) : null}

      <div
        style={{
          marginLeft: isMobile ? 0 : sidebarW,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {topbar}
        <main
          style={{
            flex: 1,
            overflow: "auto",
            padding: isMobile ? "16px 14px 24px" : isTablet ? "20px 20px 32px" : "24px 28px 40px",
          }}
        >
          {mainInner}
        </main>
      </div>

      {bottomNav}
    </div>
  );
}
