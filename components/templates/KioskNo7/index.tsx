"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SpeisekarteProps } from "@/components/speisekarte";
import { useWishlist } from "@/components/shared/useWishlist";
import { useDailyPush } from "@/components/shared/useDailyPush";
import { useAnalytics } from "@/components/shared/useAnalytics";
import ConsentBanner from "@/components/ConsentBanner";
import ItemModal from "@/components/speisekarte/ItemModal";
import Wishlist from "@/components/speisekarte/Wishlist";
import { DailyPushBanner, DailyPushPopup } from "@/components/speisekarte/DailyPush";
import type { MenuItem } from "@/lib/supabase";
import { getItemEmoji, getDisplayPrice } from "@/components/speisekarte/utils";
import { BADGE_LABELS, BADGE_STYLES, type FilterKey } from "@/components/speisekarte/constants";
import { useSpeisekarteTier1Tracking } from "@/components/speisekarte/useSpeisekarteTier1Tracking";
import {
  buildSectionsForCategoryTab,
  categoryTabLabel,
  CATEGORY_TAB_ALLE_KEY,
  deriveCategoryTabsFromItems,
  type MainTabDef,
} from "@/components/speisekarte/menu-layout";

const KIOSK_TRACK_FILTER: FilterKey = "all";

type Section = { kategorie: string; subtitle: string | null; items: MenuItem[] };

const KIOSK_ORDER = "__kiosk_order__";
const KIOSK_INFO = "__kiosk_info__";

function kioskTabTrackingLabel(tab: string): string {
  if (tab === KIOSK_ORDER) return "Bestellung";
  if (tab === KIOSK_INFO) return "Info";
  return categoryTabLabel(tab);
}

const KIOSK_COLORS = {
  bg: "#0A0A0A",
  yellow: "#FFD600",
  red: "#FF3B30",
  green: "#00C853",
  blue: "#2979FF",
  pink: "#FF4081",
  orange: "#FF6D00",
  white: "#FFFFFF",
  card: "#161616",
  card2: "#1E1E1E",
  border: "rgba(255,255,255,0.08)",
  text: "#FFFFFF",
  muted: "#888888",
  dim: "#444444",
};

function splitNameForHero(name: string): { main: string; accent: string } {
  const parts = name.trim().split(" ");
  if (parts.length < 2) return { main: name, accent: "" };
  const accent = parts.pop() as string;
  return { main: parts.join(" "), accent };
}

export default function KioskNo7Template(props: SpeisekarteProps) {
  const {
    menuItems,
    restaurantName,
    dailyPush = null,
    accentColor,
    logoUrl,
    restaurantId,
    tischNummer,
    sponsoredItems = [],
  } = props;

  const ACCENT = (accentColor ?? "#FFD600").trim() || "#FFD600";

  const [activeTab, setActiveTab] = useState<string>(CATEGORY_TAB_ALLE_KEY);
  const [modalItem, setModalItem] = useState<MenuItem | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);

  const {
    entries,
    open: wishlistOpen,
    itemCount: wishlistCount,
    totalPrice: wishlistTotal,
    addToWishlist,
    updateQty,
    removeFromWishlist,
    clearWishlist,
    openWishlist,
    closeWishlist,
    isInWishlist,
  } = useWishlist();

  const {
    open: dailyPopupOpen,
    openPopup: openDailyPopup,
    closePopup: closeDailyPopup,
  } = useDailyPush(dailyPush ?? null, consentGiven);

  const { track } = useAnalytics();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = window.localStorage.getItem("qrave_consent");
    if (v) setConsentGiven(true);
  }, []);

  useMemo(() => {
    track("view_menu", {
      restaurantName,
      hasDailyPush: Boolean(dailyPush),
      itemCount: menuItems.length,
      template: "kiosk-no7",
    });
    return undefined;
  }, [track, restaurantName, dailyPush, menuItems.length]);

  const allTabs: MainTabDef[] = useMemo(() => {
    const cats = deriveCategoryTabsFromItems(menuItems);
    return [
      ...cats,
      { key: KIOSK_ORDER, label: "🛒 Bestellung" },
      { key: KIOSK_INFO, label: "📍 Info" },
    ];
  }, [menuItems]);

  const currentSections: Section[] = useMemo(() => {
    if (activeTab === KIOSK_ORDER || activeTab === KIOSK_INFO) return [];
    return buildSectionsForCategoryTab(activeTab, menuItems);
  }, [activeTab, menuItems]);

  const { onCategorySectionRef, trackWishlistAdd, trackWishlistRemove, trackCategoryTabSelect } =
    useSpeisekarteTier1Tracking({
      restaurantId,
      tischNummer,
      effectiveMainTab: kioskTabTrackingLabel(activeTab),
      filter: KIOSK_TRACK_FILTER,
      modalItem,
    });

  const selectTab = useCallback(
    (key: string) => {
      setActiveTab(key);
      trackCategoryTabSelect(kioskTabTrackingLabel(key));
    },
    [trackCategoryTabSelect],
  );

  const handleAddToWishlist = useCallback(
    (item: MenuItem) => {
      addToWishlist(item, 1);
      try {
        trackWishlistAdd(item);
      } catch {
        /* ignore */
      }
    },
    [addToWishlist, trackWishlistAdd],
  );

  const handleRemoveFromWishlist = useCallback(
    (itemId: string) => {
      removeFromWishlist(itemId);
      try {
        trackWishlistRemove(itemId);
      } catch {
        /* ignore */
      }
    },
    [removeFromWishlist, trackWishlistRemove],
  );

  const handleToggleWishlist = useCallback(
    (wishItem: MenuItem) => {
      if (isInWishlist(wishItem.id)) {
        handleRemoveFromWishlist(wishItem.id);
      } else {
        handleAddToWishlist(wishItem);
      }
    },
    [isInWishlist, handleAddToWishlist, handleRemoveFromWishlist],
  );

  const { main: heroMain, accent: heroAccent } = splitNameForHero(restaurantName || "KIOSK No. 7");

  const showMenu = activeTab !== KIOSK_ORDER && activeTab !== KIOSK_INFO;
  const showOrder = activeTab === KIOSK_ORDER;
  const showInfo = activeTab === KIOSK_INFO;

  return (
    <div
      className="min-h-screen speisekarte-template"
      style={{ backgroundColor: KIOSK_COLORS.bg, color: KIOSK_COLORS.text, fontFamily: "'Nunito', system-ui, sans-serif" }}
    >
      {!consentGiven && (
        <ConsentBanner
          onConsent={() => {
            setConsentGiven(true);
          }}
        />
      )}
      {/* Hero */}
      <div className="relative overflow-hidden flex flex-col">
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background:
              `repeating-linear-gradient(90deg,${ACCENT} 0,${ACCENT} 40px,#FF3B30 40px,#FF3B30 80px,#00C853 80px,#00C853 120px,#2979FF 120px,#2979FF 160px,#FF4081 160px,#FF4081 200px)`,
          }}
        />
        <div
          className="px-4 pt-3 pb-2"
          style={{
            background: "linear-gradient(160deg,#1a0a00 0%,#0A0A0A 60%)",
          }}
        >
          {/* Zeile 1: Logo links, HOT SPOT rechts */}
          <div className="flex items-center justify-between mb-1.5">
            <div
              style={{
                width: 140,
                height: 44,
                overflow: "hidden",
              }}
            >
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt={`${restaurantName} Logo`}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    objectPosition: "left center",
                    display: "block",
                  }}
                />
              ) : (
                <div
                  style={{
                    fontFamily: "'Bebas Neue', system-ui, sans-serif",
                    fontSize: 24,
                    letterSpacing: ".08em",
                  }}
                >
                  {heroMain || "KIOSK"}
                  <span style={{ color: ACCENT, display: "block" }}>
                    {heroAccent || "No. 7"}
                  </span>
                </div>
              )}
            </div>
            <div
              style={{
                backgroundColor: KIOSK_COLORS.red,
                color: "#fff",
                fontFamily: "'Bebas Neue', system-ui, sans-serif",
                fontSize: 13,
                letterSpacing: ".08em",
                padding: "6px 12px",
                borderRadius: 6,
                transform: "rotate(2deg)",
              }}
            >
              🔥 HOT SPOT
            </div>
          </div>

          {/* Zeile 2: Tagline */}
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: KIOSK_COLORS.muted,
              letterSpacing: ".12em",
              textTransform: "uppercase",
            }}
          >
            Eats · Drinks · Vibes
          </div>

          {/* Zeile 3: Jetzt offen */}
          <div
            className="inline-flex items-center gap-[6px] mt-1"
            style={{
              backgroundColor: ACCENT,
              color: "#000",
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: ".18em",
              textTransform: "uppercase",
              padding: "4px 10px",
              borderRadius: 4,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "999px",
                backgroundColor: "#000",
              }}
            />
            Jetzt offen
          </div>
        </div>
      </div>

      {/* Special bar – Daily Push */}
      {dailyPush && (
        <div className="px-4 mt-2">
          <DailyPushBanner dailyPush={dailyPush} onOpenPopup={openDailyPopup} />
        </div>
      )}

      {/* Tabs */}
      <div
        className="sticky z-[110]"
        style={{
          top: 0,
          backgroundColor: KIOSK_COLORS.bg,
          borderBottom: `1px solid ${KIOSK_COLORS.border}`,
          padding: "0 16px",
        }}
      >
        <div className="flex gap-1 py-1 overflow-x-auto scrollbar-hide">
          {allTabs.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => selectTab(key)}
              className="pb-2.5 pt-3 px-2 text-[10px] font-extrabold uppercase tracking-[0.08em] flex-shrink-0 whitespace-nowrap"
              style={{
                borderBottom: `3px solid ${activeTab === key ? ACCENT : "transparent"}`,
                color: activeTab === key ? ACCENT : KIOSK_COLORS.dim,
                textAlign: "center",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="px-4 pt-2 pb-28">
        {showMenu && (
          <div>
            {currentSections.map((sec) => (
              <section
                key={sec.kategorie}
                ref={(el) => onCategorySectionRef(sec.kategorie, el)}
              >
                <div className="flex items-center justify-between py-4">
                  <div
                    style={{
                      fontFamily: "'Bebas Neue', system-ui, sans-serif",
                      fontSize: 32,
                      letterSpacing: ".04em",
                    }}
                  >
                    {sec.kategorie.toUpperCase()}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: KIOSK_COLORS.muted,
                      letterSpacing: ".12em",
                      textTransform: "uppercase",
                      backgroundColor: KIOSK_COLORS.card2,
                      padding: "4px 10px",
                      borderRadius: 999,
                    }}
                  >
                    {sec.items.length} Items
                  </div>
                </div>
                <div className="flex flex-col gap-4 py-4">
                {sec.items.map((item) => {
                  const emoji = getItemEmoji(item, sec.kategorie);
                  const tags = (item.tags ?? []).map((t) => String(t).toLowerCase());
                  const useBigCard = Boolean(item.bild_url);
                  if (useBigCard) {
                    return (
                      <div
                        key={item.id}
                        onClick={() => setModalItem(item)}
                        style={{
                          backgroundColor: KIOSK_COLORS.card,
                          borderRadius: 16,
                          overflow: "hidden",
                          cursor: "pointer",
                          border: `1px solid ${KIOSK_COLORS.border}`,
                        }}
                      >
                        <div className="relative overflow-hidden">
                          {item.bild_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.bild_url}
                              alt={item.name}
                              style={{
                                width: "100%",
                                height: 180,
                                objectFit: "cover",
                                display: "block",
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: "100%",
                                height: 180,
                                backgroundColor: KIOSK_COLORS.card2,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 56,
                              }}
                            >
                              {emoji}
                            </div>
                          )}
                        </div>
                        <div className="px-4 pt-3 pb-4">
                          <div className="mb-2 flex flex-wrap items-center gap-1.5">
                            <div
                              style={{
                                fontFamily: "'Bebas Neue', system-ui, sans-serif",
                                fontSize: 24,
                                letterSpacing: ".04em",
                                lineHeight: 1,
                              }}
                            >
                              {item.name.toUpperCase()}
                            </div>
                            {tags.map(
                              (t) =>
                                BADGE_LABELS[t as keyof typeof BADGE_LABELS] && (
                                  <span
                                    key={t}
                                    className={`text-[0.52rem] font-semibold px-1.5 py-0.5 rounded-full uppercase ${BADGE_STYLES[t as keyof typeof BADGE_STYLES]}`}
                                  >
                                    {BADGE_LABELS[t as keyof typeof BADGE_LABELS]}
                                  </span>
                                ),
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <div
                              style={{
                                fontFamily: "'Bebas Neue', system-ui, sans-serif",
                                fontSize: 28,
                                color: ACCENT,
                              }}
                            >
                              {getDisplayPrice(item)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-4 py-3"
                      style={{
                        backgroundColor: KIOSK_COLORS.card,
                        borderRadius: 14,
                        border: `1px solid ${KIOSK_COLORS.border}`,
                        cursor: "pointer",
                      }}
                      onClick={() => setModalItem(item)}
                    >
                      <div
                        style={{ fontSize: 26, width: 36, textAlign: "center", flexShrink: 0 }}
                      >
                        {emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <div
                            style={{ fontSize: 15, fontWeight: 800, color: KIOSK_COLORS.text }}
                          >
                            {item.name}
                          </div>
                          {tags.map(
                            (t) =>
                              BADGE_LABELS[t as keyof typeof BADGE_LABELS] && (
                                <span
                                  key={t}
                                  className={`text-[0.52rem] font-semibold px-1.5 py-0.5 rounded-full uppercase ${BADGE_STYLES[t as keyof typeof BADGE_STYLES]}`}
                                >
                                  {BADGE_LABELS[t as keyof typeof BADGE_LABELS]}
                                </span>
                              ),
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div
                          style={{
                            fontFamily: "'Bebas Neue', system-ui, sans-serif",
                            fontSize: 22,
                            color: ACCENT,
                          }}
                        >
                          {getDisplayPrice(item)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                </div>
              </section>
            ))}
          </div>
        )}

        {showOrder && (
          <section>
            <div className="flex items-center justify-between py-4">
              <div
                style={{
                  fontFamily: "'Bebas Neue', system-ui, sans-serif",
                  fontSize: 32,
                  letterSpacing: ".04em",
                }}
              >
                DEINE <span style={{ color: ACCENT }}>ORDER</span>
              </div>
            </div>
            {entries.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center gap-3 py-14 px-6 text-center"
                style={{ color: KIOSK_COLORS.muted }}
              >
                <div className="text-[3rem] opacity-30">🛒</div>
                <div
                  style={{
                    fontFamily: "'Bebas Neue', system-ui, sans-serif",
                    fontSize: 28,
                    letterSpacing: ".04em",
                  }}
                >
                  NOCH LEER
                </div>
                <div
                  className="text-[13px] font-semibold leading-relaxed"
                  style={{ color: KIOSK_COLORS.dim }}
                >
                  Tippe auf ein Item und drücke „Zur Merkliste“ um es zu merken.
                </div>
              </div>
            ) : (
              <div>
                {entries.map(({ item, qty }) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 mb-2 px-3 py-3 rounded-xl"
                    style={{
                      backgroundColor: KIOSK_COLORS.card,
                      borderRadius: 12,
                      border: `1px solid ${KIOSK_COLORS.border}`,
                    }}
                  >
                    <div
                      className="flex items-center justify-center"
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 8,
                        backgroundColor: KIOSK_COLORS.card2,
                        flexShrink: 0,
                        fontSize: 22,
                      }}
                    >
                      {getItemEmoji(item)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className="mb-[2px]"
                        style={{
                          fontSize: 14,
                          fontWeight: 800,
                          color: KIOSK_COLORS.text,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {item.name}
                      </div>
                    </div>
                    <div
                      style={{
                        fontFamily: "'Bebas Neue', system-ui, sans-serif",
                        fontSize: 18,
                        color: ACCENT,
                        minWidth: 52,
                        textAlign: "right",
                      }}
                    >
                      {getDisplayPrice(item)}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        color: KIOSK_COLORS.text,
                        minWidth: 22,
                        textAlign: "center",
                      }}
                    >
                      ×{qty}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {showInfo && (
          <section>
            <div className="flex items-center justify-between py-4">
              <div
                style={{
                  fontFamily: "'Bebas Neue', system-ui, sans-serif",
                  fontSize: 32,
                  letterSpacing: ".04em",
                }}
              >
                KIOSK <span style={{ color: ACCENT }}>No. 7</span>
              </div>
            </div>
            <div
              style={{
                backgroundColor: KIOSK_COLORS.card,
                borderRadius: 14,
                padding: 18,
                border: `1px solid ${KIOSK_COLORS.border}`,
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 900,
                  letterSpacing: ".2em",
                  textTransform: "uppercase",
                  color: ACCENT,
                  marginBottom: 8,
                }}
              >
                ℹ️ Hinweise
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: KIOSK_COLORS.muted,
                  lineHeight: 1.7,
                }}
              >
                Alle Preise inkl. MwSt. · Allergene auf Anfrage · Änderungen vorbehalten.
              </div>
            </div>
          </section>
        )}
      </main>

      {modalItem && (
        <ItemModal
          item={modalItem}
          menuItems={menuItems}
          sponsoredItems={sponsoredItems}
          restaurantId={restaurantId}
          onClose={() => setModalItem(null)}
          onSelectItem={setModalItem}
          isInWishlist={isInWishlist}
          onToggleWishlist={handleToggleWishlist}
          theme="bar-soleil"
        />
      )}

      <Wishlist
        open={wishlistOpen}
        onClose={closeWishlist}
        overlayZIndex={999}
        cart={entries}
        onUpdateQty={updateQty}
        onRemove={handleRemoveFromWishlist}
        cartTotal={wishlistTotal}
        onClear={clearWishlist}
        restaurantName={restaurantName}
        theme="bar-soleil"
      />

      {dailyPush && (
        <DailyPushPopup
          dailyPush={dailyPush}
          menuItems={menuItems}
          open={dailyPopupOpen}
          onClose={closeDailyPopup}
          onAddToCart={handleAddToWishlist}
          theme="bar-soleil"
        />
      )}

      <nav
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "rgba(10,10,10,.96)",
          backdropFilter: "blur(20px)",
          borderTop: `1px solid ${KIOSK_COLORS.border}`,
          padding: "10px 24px max(16px,env(safe-area-inset-bottom))",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          gap: 12,
          zIndex: 400,
        }}
      >
        <button
          type="button"
          onClick={() => selectTab(CATEGORY_TAB_ALLE_KEY)}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            padding: 7,
            borderRadius: 10,
            cursor: "pointer",
            color: showMenu ? ACCENT : KIOSK_COLORS.dim,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: ".06em",
            textTransform: "uppercase",
            border: "none",
            background: "none",
          }}
        >
          <span style={{ fontSize: 20, lineHeight: 1 }}>🍔</span>
          Karte
        </button>
        <button
          type="button"
          onClick={() => {
            selectTab(KIOSK_ORDER);
            openWishlist();
          }}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            padding: 7,
            borderRadius: 10,
            cursor: "pointer",
            color: activeTab === KIOSK_ORDER ? ACCENT : KIOSK_COLORS.dim,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: ".06em",
            textTransform: "uppercase",
            border: "none",
            background: "none",
            position: "relative",
          }}
        >
          <span style={{ fontSize: 20, lineHeight: 1 }}>🛒</span>
          Order
          <span
            style={{
              position: "absolute",
              top: 1,
              right: 8,
              minWidth: 16,
              height: 16,
              borderRadius: 5,
              backgroundColor: KIOSK_COLORS.red,
              color: "#fff",
              fontSize: 9,
              fontWeight: 900,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
              transform: wishlistCount > 0 ? "scale(1)" : "scale(0)",
              transition: "transform .2s",
            }}
          >
            {wishlistCount}
          </span>
        </button>
      </nav>
    </div>
  );
}
