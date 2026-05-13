"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { DashboardTab } from "./types";

/** Eintrag in der Sidebar / im Drawer. */
type NavItem = {
  key: DashboardTab;
  label: string;
  icon: string; // Font-Awesome-Klasse, z. B. "fa-solid fa-house"
};

const NAV_ITEMS: NavItem[] = [
  { key: "home", label: "Dashboard", icon: "fa-solid fa-house" },
  { key: "karte", label: "Speisekarte", icon: "fa-solid fa-utensils" },
  { key: "tische", label: "Tische", icon: "fa-solid fa-table-cells" },
];

type Props = {
  /** Wirt- oder Founder-Theme (lila vs. blau). */
  variant?: "wirt" | "founder";
  /** Aktiver Tab in der Sidebar. */
  activeTab: DashboardTab;
  onTabChange: (next: DashboardTab) => void;
  /** Topbar-Titel (z. B. "Dashboard"). */
  title: string;
  /** Live-Badge "Karte live" einblenden, wenn die Karte für Gäste freigegeben ist. */
  liveBadge?: boolean;
  /** Avatar-Buchstabe oben rechts (z. B. Initial). */
  avatarLabel?: string;
  /** Klick aufs Settings-Icon (nur in Sidebar/Drawer, nicht mehr Topbar). */
  onOpenSettings?: () => void;
  /** Klick auf die KI-Features-CTA in der Sidebar. */
  onOpenAiFeatures?: () => void;
  /** Öffentliche Speisekarten-URL (öffnet "Speisekarte ansehen"-Button im Topbar). */
  previewUrl?: string;
  children: ReactNode;
};

export function DashboardShell({
  variant = "wirt",
  activeTab,
  onTabChange,
  title,
  liveBadge,
  avatarLabel,
  onOpenSettings,
  onOpenAiFeatures,
  previewUrl,
  children,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Drawer schließt automatisch beim Tab-Wechsel.
  useEffect(() => {
    if (drawerOpen) setDrawerOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Body-Scroll lock solange Drawer offen.
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
        {/* Sidebar — nur Desktop */}
        <DashboardSidebar
          activeTab={activeTab}
          onTabChange={onTabChange}
          onOpenSettings={onOpenSettings}
          onOpenAiFeatures={onOpenAiFeatures}
          className="hidden md:flex"
          fixed
        />

        {/* Drawer — nur Mobile, gerendert wenn offen */}
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
              onOpenSettings={onOpenSettings}
              onOpenAiFeatures={onOpenAiFeatures}
              className="qrave-drawer-in fixed inset-y-0 left-0 z-[101] flex md:hidden"
            />
          </>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col md:ml-[252px]">
          {/* Topbar */}
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
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-2 rounded-[9px] border px-3 text-[12px] font-semibold transition"
                style={{
                  borderColor: "color-mix(in srgb, var(--qrave-accent) 30%, transparent)",
                  background: "color-mix(in srgb, var(--qrave-accent) 12%, transparent)",
                  color: "var(--qrave-accent-soft)",
                }}
              >
                <i className="fa-solid fa-arrow-up-right-from-square text-[11px]" />
                <span className="hidden sm:inline">Speisekarte ansehen</span>
              </a>
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
  onOpenSettings,
  onOpenAiFeatures,
  className = "",
  fixed = false,
}: {
  activeTab: DashboardTab;
  onTabChange: (next: DashboardTab) => void;
  onOpenSettings?: () => void;
  onOpenAiFeatures?: () => void;
  className?: string;
  fixed?: boolean;
}) {
  return (
    <aside
      className={`qrave-sidebar w-[252px] flex-shrink-0 flex-col px-4 py-6 ${fixed ? "fixed inset-y-0 left-0" : ""} ${className}`}
    >
      <div className="qrave-font-display mb-9 flex items-center gap-2 px-2 text-[20px] font-black">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{
            background: "var(--qrave-accent)",
            boxShadow: "0 0 10px var(--qrave-accent)",
          }}
        />
        qrave
      </div>

      <div className="qrave-nav-section">Menu</div>
      {NAV_ITEMS.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onTabChange(item.key)}
          className={`qrave-nav-item${activeTab === item.key ? " active" : ""}`}
        >
          <span className="qrave-nav-icon">
            <i className={item.icon} />
          </span>
          {item.label}
        </button>
      ))}

      <div className="qrave-nav-section">Verwalten</div>
      <button
        type="button"
        onClick={onOpenSettings}
        className="qrave-nav-item"
      >
        <span className="qrave-nav-icon">
          <i className="fa-solid fa-gear" />
        </span>
        Einstellungen
      </button>
      <a
        className="qrave-nav-item"
        href="mailto:info@qrave.menu"
      >
        <span className="qrave-nav-icon">
          <i className="fa-solid fa-circle-question" />
        </span>
        Support
      </a>

      <div className="mt-auto">
        <div className="qrave-cta-card">
          <div className="mb-[10px] flex h-[30px] w-[30px] items-center justify-center rounded-[8px] bg-white/15">
            <i className="fa-solid fa-wand-magic-sparkles text-[13px] text-white" />
          </div>
          <div className="qrave-font-display mb-1 truncate text-[13px] font-bold">
            KI-Features nutzen
          </div>
          <div className="mb-3 text-[11px] leading-snug text-white/60">
            Beschreibungen generieren und Karte übersetzen
          </div>
          <button
            type="button"
            onClick={onOpenAiFeatures}
            className="w-full rounded-[8px] border border-white/20 bg-white/15 py-[9px] text-[12px] font-semibold text-white transition hover:bg-white/25"
          >
            + Jetzt nutzen
          </button>
        </div>
      </div>
    </aside>
  );
}
