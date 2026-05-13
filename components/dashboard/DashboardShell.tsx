"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { DashboardTab } from "./types";
import { KiInfoPanel } from "./ki/KiInfoPanel";

/** Eintrag in der Sidebar / im Drawer. Hat entweder eine Route (`href`)
 *  oder einen Tab-Key — nicht beides. */
type NavItem =
  | { kind: "tab"; key: DashboardTab; label: string; icon: string }
  | { kind: "link"; href: string; label: string; icon: string };

const TAB_NAV: NavItem[] = [
  { kind: "tab", key: "home", label: "Dashboard", icon: "fa-solid fa-house" },
  { kind: "tab", key: "karte", label: "Speisekarte", icon: "fa-solid fa-utensils" },
  { kind: "tab", key: "tische", label: "Tische", icon: "fa-solid fa-table-cells" },
];

export type QuickActionKey = "daily" | "notiz" | "soldout" | "translate";

type QuickAction = {
  key: QuickActionKey;
  icon: string;
  label: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  { key: "daily", icon: "fa-solid fa-star", label: "Tages-Special" },
  { key: "notiz", icon: "fa-solid fa-pen-to-square", label: "Gäste-Notiz" },
  { key: "soldout", icon: "fa-solid fa-ban", label: "Ausverkauft" },
  { key: "translate", icon: "fa-solid fa-language", label: "Übersetzen" },
];

type Props = {
  /** Wirt- oder Founder-Theme (lila vs. blau). */
  variant?: "wirt" | "founder";
  /** Aktiver Tab — nur relevant, wenn die Page Tabs hat (DashboardApp). */
  activeTab?: DashboardTab;
  onTabChange?: (next: DashboardTab) => void;
  /** Topbar-Titel. */
  title: string;
  /** "Karte live" Badge im Topbar. */
  liveBadge?: boolean;
  /** Avatar-Buchstabe oben rechts. */
  avatarLabel?: string;
  /** Öffentliche Speisekarten-URL. */
  previewUrl?: string;
  /** Quick-Actions in der Sidebar (Wirt-Dashboard). */
  onQuickAction?: (action: QuickActionKey) => void;
  children: ReactNode;
};

export function DashboardShell({
  variant = "wirt",
  activeTab,
  onTabChange,
  title,
  liveBadge,
  avatarLabel,
  previewUrl,
  onQuickAction,
  children,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [kiPanelOpen, setKiPanelOpen] = useState(false);
  const pathname = usePathname();

  // Drawer schließt automatisch bei Tab- oder Routen-Wechsel.
  useEffect(() => {
    if (drawerOpen) setDrawerOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, pathname]);

  // Body-Scroll-Lock solange Drawer offen.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (drawerOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [drawerOpen]);

  const shellClass = `qrave-shell${variant === "founder" ? " qrave-shell--founder" : ""}`;

  return (
    <div className={shellClass}>
      {/* Lila Lichtstrahlen + Vignette + Grid-Overlay */}
      <div className="qrave-bg" aria-hidden>
        <div className="qrave-rays">
          <div className="qrave-ray qrave-ray-1" />
          <div className="qrave-ray qrave-ray-2" />
          <div className="qrave-ray qrave-ray-3" />
          <div className="qrave-ray qrave-ray-4" />
          <div className="qrave-ray qrave-ray-5" />
        </div>
        <div className="qrave-corner-glow" />
        <div className="qrave-grid-overlay" />
      </div>

      <div className="relative z-[1] flex min-h-screen">
        <DashboardSidebar
          activeTab={activeTab}
          onTabChange={onTabChange}
          onQuickAction={onQuickAction}
          onOpenKiPanel={() => setKiPanelOpen(true)}
          pathname={pathname}
          className="hidden md:flex"
          fixed
        />

        {drawerOpen ? (
          <>
            <button
              type="button"
              aria-label="Menü schließen"
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm md:hidden"
            />
            <DashboardSidebar
              activeTab={activeTab}
              onTabChange={onTabChange}
              onQuickAction={onQuickAction}
              onOpenKiPanel={() => {
                setKiPanelOpen(true);
                setDrawerOpen(false);
              }}
              pathname={pathname}
              className="qrave-drawer-in fixed inset-y-0 left-0 z-[101] flex md:hidden"
            />
          </>
        ) : null}

        <KiInfoPanel open={kiPanelOpen} onClose={() => setKiPanelOpen(false)} />

        <div className="flex min-w-0 flex-1 flex-col md:ml-[252px]">
          <div className="qrave-topbar sticky top-0 z-50 flex items-center gap-3 px-5 py-4 md:px-8">
            <button
              type="button"
              aria-label="Menü öffnen"
              onClick={() => setDrawerOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-white/10 bg-white/[0.05] text-white/70 md:hidden"
            >
              <i className="fa-solid fa-bars text-[14px]" />
            </button>
            <h1
              className="qrave-font-display text-[18px] font-black md:text-[20px]"
              style={{ marginRight: "auto" }}
            >
              {title}
            </h1>
            {liveBadge ? (
              <span className="qrave-live-badge">
                <span className="qrave-live-dot" />
                Karte live
              </span>
            ) : null}
            {previewUrl ? (
              <button
                type="button"
                onClick={() => {
                  // Cache-Buster sicherstellen, dass immer die aktuelle eigene
                  // Karte angezeigt wird und nicht eine zwischengespeicherte.
                  if (typeof window !== "undefined") {
                    const sep = previewUrl.includes("?") ? "&" : "?";
                    window.open(`${previewUrl}${sep}_=${Date.now()}`, "_blank", "noopener,noreferrer");
                  }
                }}
                className="inline-flex h-9 items-center gap-2 rounded-[9px] border px-3 text-[12px] font-semibold transition"
                style={{
                  borderColor: "color-mix(in srgb, var(--qrave-accent) 30%, transparent)",
                  background: "color-mix(in srgb, var(--qrave-accent) 12%, transparent)",
                  color: "var(--qrave-accent-soft)",
                }}
              >
                <i className="fa-solid fa-arrow-up-right-from-square text-[11px]" />
                <span className="hidden sm:inline">Speisekarte ansehen</span>
              </button>
            ) : null}
            {avatarLabel ? (
              <div
                className="qrave-font-display flex h-9 w-9 items-center justify-center rounded-full text-[14px] font-black text-white"
                style={{ background: "var(--qrave-accent-gradient)" }}
              >
                {avatarLabel}
              </div>
            ) : null}
          </div>

          <div className="flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
}

function DashboardSidebar({
  activeTab,
  onTabChange,
  onQuickAction,
  onOpenKiPanel,
  pathname,
  className = "",
  fixed = false,
}: {
  activeTab?: DashboardTab;
  onTabChange?: (next: DashboardTab) => void;
  onQuickAction?: (action: QuickActionKey) => void;
  onOpenKiPanel?: () => void;
  pathname: string | null;
  className?: string;
  fixed?: boolean;
}) {
  const router = useRouter();

  // Bei Tab-Klick: wenn wir auf einer Sub-Route (Einstellungen/KI) sind,
  // erst zurück zu /dashboard navigieren — der gewählte Tab wird via
  // sessionStorage gemerkt und beim Mount übernommen.
  function handleTabClick(key: DashboardTab) {
    if (pathname && pathname !== "/dashboard") {
      try {
        sessionStorage.setItem("qrave-dashboard-tab", key);
      } catch {
        // sessionStorage ggf. blockiert — Tab landet im Default.
      }
      router.push("/dashboard");
      return;
    }
    onTabChange?.(key);
  }

  const isOnSettings = pathname === "/dashboard/einstellungen";

  return (
    <aside
      className={`qrave-sidebar w-[252px] flex-shrink-0 flex-col px-4 py-6 ${fixed ? "fixed inset-y-0 left-0" : ""} ${className}`}
    >
      <div className="qrave-font-display mb-9 flex items-center gap-2 px-2 text-[20px] font-black">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: "var(--qrave-accent)", boxShadow: "0 0 10px var(--qrave-accent)" }}
        />
        qrave
      </div>

      <div className="qrave-nav-section">Menu</div>
      {TAB_NAV.map((item) => {
        if (item.kind !== "tab") return null;
        const active = pathname === "/dashboard" && activeTab === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => handleTabClick(item.key)}
            className={`qrave-nav-item${active ? " active" : ""}`}
          >
            <span className="qrave-nav-icon">
              <i className={item.icon} />
            </span>
            {item.label}
          </button>
        );
      })}

      {/* Quick-Actions — kleine Icon-Buttons unter den Nav-Links */}
      {onQuickAction ? (
        <>
          <div className="qrave-nav-section">Schnellzugriff</div>
          <div className="mb-1 flex gap-1.5 px-2">
            {QUICK_ACTIONS.map((q) => (
              <button
                key={q.key}
                type="button"
                onClick={() => onQuickAction(q.key)}
                title={q.label}
                aria-label={q.label}
                className="flex h-9 w-9 items-center justify-center rounded-[9px] border transition hover:bg-white/[0.08]"
                style={{
                  borderColor: "rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.04)",
                  color: "rgba(242,242,242,0.7)",
                }}
              >
                <i className={`${q.icon} text-[12px]`} />
              </button>
            ))}
          </div>
        </>
      ) : null}

      <div className="qrave-nav-section">Verwalten</div>
      <Link
        href="/dashboard/einstellungen"
        className={`qrave-nav-item${isOnSettings ? " active" : ""}`}
      >
        <span className="qrave-nav-icon">
          <i className="fa-solid fa-gear" />
        </span>
        Einstellungen
      </Link>
      <a className="qrave-nav-item" href="mailto:info@qrave.menu">
        <span className="qrave-nav-icon">
          <i className="fa-solid fa-circle-question" />
        </span>
        Support
      </a>

      <div className="mt-auto">
        <button
          type="button"
          onClick={onOpenKiPanel}
          className="qrave-cta-card block w-full text-left"
          style={{ color: "inherit" }}
        >
          <div className="mb-[10px] flex h-[30px] w-[30px] items-center justify-center rounded-[8px] bg-white/15">
            <i className="fa-solid fa-wand-magic-sparkles text-[13px] text-white" />
          </div>
          <div className="qrave-font-display mb-1 truncate text-[13px] font-bold">
            KI-Features
          </div>
          <div className="mb-3 text-[11px] leading-snug text-white/60">
            Was die KI für deine Karte tun kann
          </div>
          <div className="flex w-full items-center justify-center gap-2 rounded-[8px] border border-white/20 bg-white/15 py-[9px] text-center text-[12px] font-semibold text-white">
            <i className="fa-solid fa-circle-info text-[11px]" />
            Mehr erfahren
          </div>
        </button>
      </div>
    </aside>
  );
}
