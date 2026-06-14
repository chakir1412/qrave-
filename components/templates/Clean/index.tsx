"use client";
import { tCategory } from "@/lib/i18n-menu";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import type { SpeisekarteProps } from "@/components/speisekarte";
import type { MenuItem } from "@/lib/supabase";
import { useWishlist } from "@/components/shared/useWishlist";
import { useAnalytics } from "@/components/shared/useAnalytics";
import ConsentBanner from "@/components/ConsentBanner";
import Wishlist from "@/components/speisekarte/Wishlist";
import { AllergenSheet } from "@/components/speisekarte/FilterBar";
import LunchSection from "@/components/speisekarte/LunchSection";
import GuestNoteBanner from "@/components/speisekarte/GuestNoteBanner";
import { dailyPushToMenuItem } from "@/components/speisekarte/DailyPush";
import {
  deriveCategoryTabsFromItems,
  buildSectionsForCategoryTab,
  categoryTabLabel,
  CATEGORY_TAB_ALLE_KEY,
} from "@/components/speisekarte/menu-layout";
import { activeLunchOffers } from "@/lib/lunch";
import { useSpeisekarteTier1Tracking } from "@/components/speisekarte/useSpeisekarteTier1Tracking";
import { type FilterKey, IMG_BLUR_DATA_URL } from "@/components/speisekarte/constants";
import { getDisplayPrice } from "@/components/speisekarte/utils";
import HeritageItemModal from "@/components/templates/Heritage/HeritageItemModal";
import { resolveBackground, type BackgroundMode } from "@/lib/template-background";

const COL_DEFAULT = {
  bg: "#f0eeea",
  white: "#ffffff",
  text: "#1a1a1a",
  muted: "#999999",
  border: "#e4e1db",
  accent: "#2d6a4f",
  accentLight: "rgba(45,106,79,0.09)",
  accentSoft: "rgba(45,106,79,0.18)",
};

const SERIF = `'Playfair Display', Georgia, ui-serif, serif`;
const LUNCH_TAB_KEY = "__clean_lunch__";

const FILTER_OPTIONS: ReadonlyArray<{ key: FilterKey; label: string }> = [
  { key: "all", label: "Alle" },
  { key: "vegan", label: "Vegan" },
  { key: "veg", label: "Vegetarisch" },
  { key: "gf", label: "Glutenfrei" },
];

const FILTER_TAG_ALIASES: Record<FilterKey, ReadonlyArray<string>> = {
  all: [],
  vegan: ["vegan"],
  veg: ["vegetarisch", "veg", "vegetarian"],
  gf: ["glutenfrei", "gf", "gluten-free", "glutenfree"],
  spicy: ["scharf", "spicy", "hot"],
};

export default function CleanTemplate(props: SpeisekarteProps) {
  const {
    menuItems,
    restaurantName,
    dailyPushes = [],
    restaurantId,
    tischNummer,
    sponsoredItems = [],
    guestNote = null,
    lunchOffers = [],
    backgroundMode = null,
    customBgColor = null,
    customTextColor = null,
    locale = "de",
  } = props;
  const bgTheme = resolveBackground("clean", backgroundMode as BackgroundMode | null, customBgColor, customTextColor);
  const COL = { ...COL_DEFAULT, bg: bgTheme.bg, text: bgTheme.text, muted: bgTheme.textMuted, card: bgTheme.card, accent: props.accentColor || COL_DEFAULT.accent };

  /** Splash-Flow: initial true → Kategorie-Grid sichtbar. Klick auf eine
   *  Kategorie setzt sie + verlässt Splash. Back-Button kehrt zurück. */
  const [splashOpen, setSplashOpen] = useState(true);
  const [pickedMainTab, setPickedMainTab] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [activeAllergens, setActiveAllergens] = useState<Set<string>>(new Set());
  const [allergenOpen, setAllergenOpen] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [modalStack, setModalStack] = useState<MenuItem[]>([]);
  const modalItem = modalStack[modalStack.length - 1] ?? null;
  const pushModal = useCallback((it: MenuItem) => {
    setModalStack((prev) => [...prev, it]);
  }, []);
  const popModal = useCallback(() => {
    setModalStack((prev) => prev.slice(0, -1));
  }, []);

  const {
    entries,
    open: wishlistOpen,
    itemCount: cartCount,
    totalPrice: cartTotal,
    addToWishlist,
    updateQty,
    removeFromWishlist,
    clearWishlist,
    openWishlist,
    closeWishlist,
    isInWishlist,
  } = useWishlist();

  const { track } = useAnalytics();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = window.localStorage.getItem("qrave_consent");
    if (v) setConsentGiven(true);
  }, []);

  const [hasActiveLunch, setHasActiveLunch] = useState(false);
  useEffect(() => {
    const update = () => setHasActiveLunch(activeLunchOffers(lunchOffers).length > 0);
    update();
    const t = window.setInterval(update, 60_000);
    return () => window.clearInterval(t);
  }, [lunchOffers]);

  useMemo(() => {
    track("view_menu", {
      restaurantName,
      hasDailyPush: dailyPushes.length > 0,
      itemCount: menuItems.length,
      template: "clean",
    });
    return undefined;
  }, [track, restaurantName, dailyPushes.length, menuItems.length]);/** Sichtbare Diät-Filter-Pills: nur die mit mindestens einem matching-Tag. */
  const visibleFilterKeys = useMemo<ReadonlyArray<FilterKey>>(() => {
    const has = (aliases: ReadonlyArray<string>) =>
      menuItems.some((it) =>
        (it.tags ?? []).some((tag) => aliases.includes(tag.trim().toLowerCase())),
      );
    const out: FilterKey[] = ["all"];
    if (has(["vegan", "v"])) out.push("vegan");
    if (has(["vegetarisch", "veg", "vegetarian"])) out.push("veg");
    if (has(["glutenfrei", "gf", "gluten-free"])) out.push("gf");
    if (has(["scharf", "spicy"])) out.push("spicy");
    return out;
  }, [menuItems]);


  const derivedTabs = useMemo(() => deriveCategoryTabsFromItems(menuItems), [menuItems]);

  /** Splash zeigt nur reale Kategorien (kein Lunch-Tab). Im Items-View
   *  wird Lunch optional als erster Tab eingeblendet. */
  const splashCategories = derivedTabs;

  const mainTabs = useMemo(() => {
    if (hasActiveLunch) {
      return [{ key: LUNCH_TAB_KEY, label: "Mittagsangebot" }, ...derivedTabs];
    }
    return derivedTabs;
  }, [derivedTabs, hasActiveLunch]);

  const mainTab = useMemo(() => {
    if (pickedMainTab && mainTabs.some((t) => t.key === pickedMainTab)) return pickedMainTab;
    return mainTabs[0]?.key ?? CATEGORY_TAB_ALLE_KEY;
  }, [pickedMainTab, mainTabs]);

  const effectiveMainTab = useMemo(() => {
    if (mainTab === LUNCH_TAB_KEY && hasActiveLunch) return LUNCH_TAB_KEY;
    const firstKey = mainTabs[0]?.key ?? CATEGORY_TAB_ALLE_KEY;
    const sections = buildSectionsForCategoryTab(mainTab, menuItems);
    if (sections.length > 0) return mainTab;
    return firstKey;
  }, [mainTab, mainTabs, menuItems, hasActiveLunch]);

  const sections = useMemo(
    () =>
      effectiveMainTab === LUNCH_TAB_KEY
        ? []
        : buildSectionsForCategoryTab(effectiveMainTab, menuItems),
    [menuItems, effectiveMainTab],
  );

  const activeCategoryLabel = useMemo(
    () =>
      effectiveMainTab === LUNCH_TAB_KEY
        ? "Mittagsangebot"
        : categoryTabLabel(effectiveMainTab),
    [effectiveMainTab],
  );

  const { onCategorySectionRef, onItemCardRef, trackWishlistAdd, trackWishlistRemove, trackCategoryTabSelect } =
    useSpeisekarteTier1Tracking({
      restaurantId,
      tischNummer,
      effectiveMainTab: activeCategoryLabel,
      filter,
      modalItem,
    });

  const handleAddToWishlist = useCallback(
    (item: MenuItem, qty?: number) => {
      addToWishlist(item, qty);
      try { trackWishlistAdd(item); } catch { /* ignore */ }
    },
    [addToWishlist, trackWishlistAdd],
  );

  const handleRemoveFromWishlist = useCallback(
    (itemId: string) => {
      removeFromWishlist(itemId);
      try { trackWishlistRemove(itemId); } catch { /* ignore */ }
    },
    [removeFromWishlist, trackWishlistRemove],
  );

  const handleToggleWishlist = useCallback(
    (wishItem: MenuItem) => {
      if (isInWishlist(wishItem.id)) handleRemoveFromWishlist(wishItem.id);
      else handleAddToWishlist(wishItem);
    },
    [isInWishlist, handleAddToWishlist, handleRemoveFromWishlist],
  );

  const toggleAllergen = useCallback((id: string) => {
    setActiveAllergens((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const filterItems = useCallback(
    (items: MenuItem[]) => {
      let list = items;
      if (filter !== "all") {
        const aliases = FILTER_TAG_ALIASES[filter];
        list = list.filter((item) => {
          const tags = (item.tags ?? []).map((t) => t.trim().toLowerCase());
          return aliases.some((a) => tags.includes(a));
        });
        if (filter === "vegan" || filter === "veg") {
          list = list.filter((item) => (item.main_tab ?? "").toLowerCase() !== "getraenke");
        }
      }
      return list;
    },
    [filter],
  );

  const handleDailyPushClick = useCallback(
    (dpId: string) => {
      const dp = dailyPushes.find((p) => p.id === dpId);
      if (!dp) return;
      const matched =
        menuItems.find((m) => m.name.trim().toLowerCase() === dp.item_name.trim().toLowerCase()) ??
        menuItems.find((m) => m.name.trim().toLowerCase().includes(dp.item_name.trim().toLowerCase()));
      pushModal(matched ?? dailyPushToMenuItem(dp));
    },
    [dailyPushes, menuItems, pushModal],
  );

  function openCategory(tabKey: string) {
    setPickedMainTab(tabKey);
    setFilter("all");
    setSplashOpen(false);
    if (tabKey !== LUNCH_TAB_KEY) trackCategoryTabSelect(categoryTabLabel(tabKey));
  }

  /** Splash auto-skip wenn nur eine Kategorie existiert. */
  useEffect(() => {
    if (splashOpen && splashCategories.length <= 1 && splashCategories[0]) {
      setSplashOpen(false);
      setPickedMainTab(splashCategories[0].key);
    }
  }, [splashOpen, splashCategories]);

  const filterPillStyle = (active: boolean): CSSProperties => ({
    flexShrink: 0,
    fontSize: 11,
    fontWeight: 500,
    color: active ? COL.accent : COL.muted,
    padding: "5px 14px",
    border: `1px solid ${active ? COL.accent : COL.border}`,
    borderRadius: 999,
    background: active ? COL.accentLight : "transparent",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all 0.18s",
  });

  const featuredDailyPush = dailyPushes[0] ?? null;

  // Splash-Card emoji: erstes Item dieser Kategorie hat emoji?
  function categoryEmoji(tabKey: string): string {
    const sections = buildSectionsForCategoryTab(tabKey, menuItems);
    for (const sec of sections) {
      for (const item of sec.items) {
        if (item.emoji) return item.emoji;
      }
    }
    return "🍽";
  }

  return (
    <div
      className="speisekarte-template"
      style={{
        background: bgTheme.bg,
        color: bgTheme.text,
        minHeight: "100dvh",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600&family=Inter:wght@300;400;500&display=swap');
        .clean-template { font-family: 'Inter', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
        .clean-template .clean-scrollbar-hide::-webkit-scrollbar { display: none; }
        .clean-template .clean-scrollbar-hide { scrollbar-width: none; -ms-overflow-style: none; }
        .clean-template .clean-item { animation: cleanFadeUp 0.35s ease both; }
        .clean-template .clean-item:nth-child(1) { animation-delay: 0.04s; }
        .clean-template .clean-item:nth-child(2) { animation-delay: 0.09s; }
        .clean-template .clean-item:nth-child(3) { animation-delay: 0.14s; }
        .clean-template .clean-item:nth-child(4) { animation-delay: 0.19s; }
        .clean-template .clean-item:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.09) !important; transform: translateY(-1px); }
        .clean-template .clean-cat-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.12) !important; }
        @keyframes cleanFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {!consentGiven && (
        <ConsentBanner locale={locale} theme="warm" onConsent={() => setConsentGiven(true)} />
      )}

      <div
        className="clean-template"
        style={{ maxWidth: 430, margin: "0 auto", width: "100%", paddingBottom: 90 }}
      >
        {/* Header */}
        <header
          style={{
            background: COL.white,
            padding: "20px 20px 14px",
            borderBottom: `1px solid ${COL.border}`,
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          {splashOpen ? null : (
            <button
              type="button"
              onClick={() => setSplashOpen(true)}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                fontSize: 20,
                color: COL.muted,
                cursor: "pointer",
                marginBottom: 8,
                lineHeight: 1,
              }}
              aria-label="Zurück zur Kategorie-Übersicht"
            >
              ←
            </button>
          )}
          <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 600, color: COL.text }}>
            {splashOpen ? restaurantName : activeCategoryLabel}
          </div>
          {splashOpen ? (
            <div style={{ fontSize: 11, color: COL.muted, marginTop: 2 }}>
              Speisekarte
            </div>
          ) : null}
        </header>

        {guestNote && guestNote.trim() ? (
          <div style={{ padding: "0 16px", marginTop: 12 }}>
            <GuestNoteBanner note={guestNote} />
          </div>
        ) : null}

        {splashOpen ? (
          <CategorySplash
            categories={splashCategories}
            emoji={categoryEmoji}
            onPick={openCategory}
            COL={COL}
          />
        ) : (
          <>
            {/* Kategorie-Tabs (horizontal scroll, aktiver unterstrichen) */}
            <nav
              className="clean-scrollbar-hide tab-bar-fade"
              style={{
                display: "flex",
                overflowX: "auto",
                padding: "0 12px",
                background: COL.white,
                borderBottom: `1px solid ${COL.border}`,
                position: "sticky",
                top: 0,
                zIndex: 10,
              }}
            >
              {mainTabs.map((tab) => {
                const active = effectiveMainTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={(e) => {
                      setPickedMainTab(tab.key);
                      setFilter("all");
                      if (tab.key !== LUNCH_TAB_KEY) trackCategoryTabSelect(categoryTabLabel(tab.key));
                      (e.currentTarget as HTMLButtonElement).scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                    }}
                    style={{
                      flexShrink: 0,
                      padding: "10px 4px",
                      margin: "0 8px",
                      fontSize: 12,
                      fontWeight: active ? 600 : 500,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: active ? COL.accent : COL.muted,
                      background: "transparent",
                      border: "none",
                      borderBottomWidth: 2,
                      borderBottomStyle: "solid",
                      borderBottomColor: active ? COL.accent : "transparent",
                      cursor: "pointer",
                      transition: "color 200ms ease, border-color 200ms ease",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {tab.key === LUNCH_TAB_KEY ? tab.label : tCategory(tab.label, locale)}
                  </button>
                );
              })}
            </nav>

            {/* Filter-Row */}
            {visibleFilterKeys.length > 1 ? (
              <div
                className="clean-scrollbar-hide"
                style={{
                  display: "flex",
                  gap: 8,
                  padding: "12px 16px",
                  overflowX: "auto",
                  background: COL.white,
                  borderBottom: `1px solid ${COL.border}`,
                }}
              >
                {FILTER_OPTIONS.filter((f) => visibleFilterKeys.includes(f.key)).map((f) => (
                  <button key={f.key} type="button" onClick={() => setFilter(f.key)} style={filterPillStyle(filter === f.key)}>
                    {f.label}
                  </button>
                ))}
              </div>
            ) : null}

            {/* Special Banner */}
            {featuredDailyPush ? (
              <button
                type="button"
                onClick={() => handleDailyPushClick(featuredDailyPush.id)}
                style={{
                  margin: "16px 16px 4px",
                  background: COL.accentLight,
                  border: `1px solid ${COL.accentSoft}`,
                  borderRadius: 12,
                  padding: "14px 16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                  width: "calc(100% - 32px)",
                  textAlign: "left",
                  color: COL.text,
                }}
              >
                <div>
                  <div style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: COL.accent, fontWeight: 600, marginBottom: 3 }}>
                    ✦ Tages-Special
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>{featuredDailyPush.item_name}</div>
                </div>
                {(() => {
                  const matched = menuItems.find(
                    (m) => m.name.trim().toLowerCase() === featuredDailyPush.item_name.trim().toLowerCase(),
                  );
                  const price = matched ? getDisplayPrice(matched) : null;
                  return price ? (
                    <div style={{ fontSize: 16, fontWeight: 600, color: COL.accent }}>{price}</div>
                  ) : null;
                })()}
              </button>
            ) : null}

            {/* Inhalt */}
            <main>
              {effectiveMainTab === LUNCH_TAB_KEY ? (
                <div style={{ padding: "12px 16px 16px" }}>
                  <LunchSection offers={lunchOffers} menuItems={menuItems} onItemClick={pushModal} />
                </div>
              ) : (
                <CleanItemList
                  sections={sections}
                  filterItems={filterItems}
                  onItemClick={pushModal}
                  onCategorySectionRef={onCategorySectionRef}
                  onItemCardRef={onItemCardRef}
                  COL={COL}
                />
              )}
            </main>
          </>
        )}

        {/* Footer */}
        <footer style={{ borderTop: `1px solid ${COL.border}`, padding: "16px 20px", textAlign: "center", background: COL.white, marginTop: 24 }}>
          <p style={{ fontSize: 10, color: COL.muted, margin: 0, letterSpacing: "0.06em" }}>
            <a href="/impressum" style={{ color: COL.muted, textDecoration: "none" }}>Impressum</a>
            {" · "}
            <a href="/datenschutz" style={{ color: COL.muted, textDecoration: "none" }}>Datenschutz</a>
          </p>
        </footer>
      </div>

      {/* Bottom Nav */}
      <nav
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 430,
          background: COL.white,
          borderTop: `1px solid ${COL.border}`,
          padding: "10px 0 20px",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)",
          display: "flex",
          justifyContent: "space-around",
          zIndex: 140,
          boxShadow: "0 -4px 20px rgba(0,0,0,0.06)",
        }}
      >
        <button
          type="button"
          onClick={() => { if (wishlistOpen) closeWishlist(); }}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
            cursor: "pointer",
            opacity: !wishlistOpen ? 1 : 0.3,
            background: "transparent",
            border: "none",
            transition: "opacity 0.2s",
          }}
        >
          <span style={{ fontSize: 20 }} aria-hidden>◈</span>
          <span style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: COL.accent, fontWeight: 500 }}>Karte</span>
        </button>
        <button
          type="button"
          onClick={openWishlist}
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
            cursor: "pointer",
            opacity: wishlistOpen ? 1 : 0.3,
            background: "transparent",
            border: "none",
            transition: "opacity 0.2s",
          }}
        >
          <span style={{ fontSize: 20 }} aria-hidden>♡</span>
          <span style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: wishlistOpen ? COL.accent : COL.muted, fontWeight: 500 }}>Merkliste</span>
          {cartCount > 0 ? (
            <span
              style={{
                position: "absolute",
                top: -4,
                right: 8,
                minWidth: 18,
                height: 18,
                padding: "0 5px",
                borderRadius: 999,
                background: COL.accent,
                color: COL.white,
                fontSize: 10,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {cartCount}
            </span>
          ) : null}
        </button>
      </nav>

      {/* Item Modal — reuse Heritage's Modal */}
      {modalItem && (() => {
        const modalThemeProps = customBgColor && customTextColor
          ? { theme: "custom" as const, customBg: customBgColor, customText: customTextColor, customAccent: props.accentColor ?? COL.accent }
          : {};
        return (
          <HeritageItemModal
            item={modalItem}
            menuItems={menuItems}
            sponsoredItems={sponsoredItems}
            restaurantId={restaurantId}
            onClose={popModal}
            onSelectItem={pushModal}
            onAddToWishlist={handleAddToWishlist}
            isInWishlist={isInWishlist}
            onToggleWishlist={handleToggleWishlist}
            {...modalThemeProps}
          />
        );
      })()}

      <Wishlist
        open={wishlistOpen}
        onClose={closeWishlist}
        overlayZIndex={999}
        cart={entries}
        onUpdateQty={updateQty}
        onRemove={handleRemoveFromWishlist}
        cartTotal={cartTotal}
        onClear={clearWishlist}
        restaurantName={restaurantName}
        locale={locale}
      />    </div>
  );
}

function CategorySplash({
  categories,
  emoji,
  onPick,
  COL,
}: {
  categories: ReadonlyArray<{ key: string; label: string }>;
  emoji: (key: string) => string;
  onPick: (key: string) => void;
  COL: typeof COL_DEFAULT;
}) {
  // Versetzte 2-Spalten-Anordnung — links normal, rechts +60px Versatz.
  const leftCol: Array<{ key: string; label: string }> = [];
  const rightCol: Array<{ key: string; label: string }> = [];
  categories.forEach((c, i) => {
    if (i % 2 === 0) leftCol.push(c);
    else rightCol.push(c);
  });

  return (
    <div style={{ padding: "24px 16px 16px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {leftCol.map((c, i) => (
            <CleanCatCard key={c.key} category={c} emoji={emoji(c.key)} onPick={onPick} firstInColumn={i === 0} COL={COL} />
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 60 }}>
          {rightCol.map((c, i) => (
            <CleanCatCard key={c.key} category={c} emoji={emoji(c.key)} onPick={onPick} firstInColumn={i === 0} COL={COL} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CleanCatCard({
  category,
  emoji,
  onPick,
  firstInColumn,
  COL,
}: {
  category: { key: string; label: string };
  emoji: string;
  onPick: (key: string) => void;
  firstInColumn: boolean;
  COL: typeof COL_DEFAULT;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(category.key)}
      className="clean-cat-card"
      style={{
        position: "relative",
        background: COL.white,
        borderRadius: 18,
        paddingTop: 130,
        paddingBottom: 16,
        cursor: "pointer",
        boxShadow: "0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
        transition: "transform 0.2s, box-shadow 0.2s",
        marginTop: firstInColumn ? 60 : 0,
        border: "none",
        width: "100%",
        textAlign: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -56,
          left: "50%",
          transform: "translateX(-50%)",
          width: "90%",
          aspectRatio: "1 / 1",
          borderRadius: 16,
          background: "linear-gradient(135deg, #f5f2ee, #e8e4dd)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.13)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 56,
          overflow: "hidden",
        }}
        aria-hidden
      >
        {emoji}
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: COL.text, padding: "0 12px" }}>
        {category.label}
      </div>
    </button>
  );
}

type CleanItemListProps = {
  sections: ReturnType<typeof buildSectionsForCategoryTab>;
  filterItems: (items: MenuItem[]) => MenuItem[];
  onItemClick: (item: MenuItem) => void;
  onCategorySectionRef: (kategorie: string, el: HTMLElement | null) => void;
  onItemCardRef?: (item: MenuItem, el: HTMLElement | null) => void;
  COL: typeof COL_DEFAULT;
};

function CleanItemList({
  sections,
  filterItems,
  onItemClick,
  onCategorySectionRef,
  onItemCardRef,
  COL,
}: CleanItemListProps) {
  if (sections.length === 0) {
    return (
      <div style={{ textAlign: "center", color: COL.muted, padding: "60px 16px", fontSize: 13 }}>
        Keine Gerichte in dieser Kategorie.
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 16px 16px", display: "flex", flexDirection: "column", gap: 20 }}>
      {sections.map((sec) => {
        const items = filterItems(sec.items);
        if (items.length === 0) return null;
        return (
          <section
            key={sec.kategorie}
            ref={(el) => onCategorySectionRef(sec.kategorie, el)}
            style={{ display: "flex", flexDirection: "column", gap: 20 }}
          >
            {items.map((item, i) => (
              <CleanItemCard
                key={item.id}
                item={item}
                index={i}
                onClick={() => onItemClick(item)}
                cardRef={(el) => onItemCardRef?.(item, el)}
                COL={COL}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}

function CleanItemCard({
  item,
  index,
  onClick,
  cardRef,
  COL,
}: {
  item: MenuItem;
  index: number;
  onClick: () => void;
  cardRef: (el: HTMLElement | null) => void;
  COL: typeof COL_DEFAULT;
}) {
  const soldOut = item.sold_out === true;
  const hasImage = Boolean(item.bild_url);
  const tags = (item.tags ?? []).map((t) => t.trim().toLowerCase());
  const isVegan = tags.includes("vegan");
  const isVeg = tags.includes("vegetarisch") || tags.includes("veg") || tags.includes("vegetarian");
  const isGf = tags.includes("glutenfrei") || tags.includes("gf") || tags.includes("gluten-free");

  return (
    <button
      type="button"
      ref={cardRef as (el: HTMLButtonElement | null) => void}
      onClick={onClick}
      className="clean-item"
      style={{
        position: "relative",
        background: COL.white,
        borderRadius: 16,
        padding: 16,
        boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
        cursor: "pointer",
        transition: "box-shadow 0.2s, transform 0.2s",
        marginTop: 28,
        border: "none",
        textAlign: "left",
        opacity: soldOut ? 0.55 : 1,
        color: "inherit",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -24,
          left: 16,
          width: 72,
          height: 72,
          borderRadius: 14,
          background: "linear-gradient(135deg, #f5f2ee, #e8e4dd)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 30,
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          overflow: "hidden",
        }}
      >
        {hasImage ? (
          <Image
            src={item.bild_url as string}
            alt={item.name}
            width={72}
            height={72}
            priority={index < 4}
            placeholder="blur"
            blurDataURL={IMG_BLUR_DATA_URL}
            sizes="72px"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: soldOut ? "grayscale(1)" : undefined,
            }}
          />
        ) : (
          <span aria-hidden>{item.emoji || "🍽"}</span>
        )}
      </div>
      <div style={{ paddingLeft: 92, minHeight: 52, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: COL.text,
            lineHeight: 1.35,
            marginBottom: (isVegan || isVeg || isGf) ? 5 : 0,
            textDecoration: soldOut ? "line-through" : undefined,
          }}
        >
          {item.name}
          {soldOut ? (
            <span
              style={{
                display: "inline-block",
                marginLeft: 8,
                padding: "2px 7px",
                borderRadius: 4,
                fontSize: 9,
                fontWeight: 500,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#c84030",
                background: "rgba(200,64,48,0.1)",
                textDecoration: "none",
              }}
            >
              Ausverkauft
            </span>
          ) : null}
        </div>
        {(isVegan || isVeg || isGf) ? (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {isVegan ? (
              <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 4, background: "rgba(45,106,79,0.1)", color: COL.accent }}>
                Vegan
              </span>
            ) : null}
            {!isVegan && isVeg ? (
              <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 4, background: "rgba(45,106,79,0.07)", color: "#4a8c6a" }}>
                Vegetarisch
              </span>
            ) : null}
            {isGf ? (
              <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 4, background: "rgba(230,160,50,0.1)", color: "#b07a20" }}>
                GF
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      {item.beschreibung ? (
        <p style={{ fontSize: 12, color: COL.muted, lineHeight: 1.55, fontWeight: 300, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COL.border}` }}>
          {item.beschreibung}
        </p>
      ) : null}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: COL.text,
            textDecoration: soldOut ? "line-through" : undefined,
          }}
        >
          {getDisplayPrice(item)}
        </div>
      </div>
    </button>
  );
}
