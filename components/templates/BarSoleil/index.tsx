"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SpeisekarteProps } from "@/components/speisekarte";
import { useWishlist } from "@/components/shared/useWishlist";
import { useDailyPush } from "@/components/shared/useDailyPush";
import { useAnalytics } from "@/components/shared/useAnalytics";
import ConsentBanner from "@/components/ConsentBanner";
import FilterBar, { AllergenSheet, type MainTabItem } from "@/components/speisekarte/FilterBar";
import MenuGrid, { type Section } from "@/components/speisekarte/MenuGrid";
import ItemModal from "@/components/speisekarte/ItemModal";
import Wishlist from "@/components/speisekarte/Wishlist";
import { DailyPushBanner, DailyPushPopup } from "@/components/speisekarte/DailyPush";
import { type FilterKey } from "@/components/speisekarte/constants";
import { useSpeisekarteTier1Tracking } from "@/components/speisekarte/useSpeisekarteTier1Tracking";
import {
  deriveMainTabsFromItems,
  buildSectionsByMainTab,
  UNIFIED_MAIN_TAB_KEY,
} from "@/components/speisekarte/menu-layout";
import type { MenuItem } from "@/lib/supabase";

function splitRestaurantName(name: string): { main: string; accent: string | null } {
  const parts = name.trim().split(" ");
  if (parts.length <= 1) {
    return { main: name, accent: null };
  }
  const accent = parts.pop() as string;
  return { main: parts.join(" "), accent };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.trim().replace("#", "");
  const normalized =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw.length === 6
        ? raw
        : null;
  if (!normalized) return null;
  const num = Number.parseInt(normalized, 16);
  if (Number.isNaN(num)) return null;
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbaFromHex(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(200,137,78,${alpha})`;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

export default function BarSoleilTemplate(props: SpeisekarteProps) {
  const {
    categories,
    menuItems,
    restaurantName,
    accentColor,
    logoUrl,
    highlights = [],
    dailyPush = null,
    restaurantId,
    tischNummer,
  } = props;

  const [lang, setLang] = useState<"de" | "en">("de");
  const [pickedMainTab, setPickedMainTab] = useState<string | null>(null);
  const [subCategory, setSubCategory] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [activeAllergens, setActiveAllergens] = useState<Set<string>>(new Set());
  const [modalItem, setModalItem] = useState<MenuItem | null>(null);
  const [allergenOpen, setAllergenOpen] = useState(false);
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
      categoriesCount: categories.length,
      template: "bar-soleil",
    });
    return undefined;
  }, [track, restaurantName, dailyPush, menuItems.length, categories.length]);

  const { tabs: mainTabsRaw, unified } = useMemo(
    () => deriveMainTabsFromItems(menuItems),
    [menuItems],
  );
  const mainTabs: MainTabItem[] = mainTabsRaw;

  const sectionsByMain = useMemo(
    () => buildSectionsByMainTab(menuItems, unified),
    [menuItems, unified],
  );

  const mainTab = useMemo(() => {
    if (pickedMainTab && mainTabs.some((t) => t.key === pickedMainTab)) return pickedMainTab;
    return mainTabs[0]?.key ?? UNIFIED_MAIN_TAB_KEY;
  }, [pickedMainTab, mainTabs]);

  const effectiveMainTab = useMemo(() => {
    const firstKey = mainTabs[0]?.key ?? UNIFIED_MAIN_TAB_KEY;
    if ((sectionsByMain.get(mainTab)?.length ?? 0) > 0) return mainTab;
    return firstKey;
  }, [mainTab, mainTabs, sectionsByMain]);

  const currentSections = useMemo(
    () => sectionsByMain.get(effectiveMainTab) ?? [],
    [sectionsByMain, effectiveMainTab],
  );

  const subCategories = useMemo(() => {
    if (currentSections.length <= 1) return [];
    return currentSections.map((s) => s.kategorie);
  }, [currentSections]);

  const visibleSections = useMemo(() => {
    if (subCategory) return currentSections.filter((s) => s.kategorie === subCategory);
    return currentSections;
  }, [currentSections, subCategory]);

  const { onCategorySectionRef, trackWishlistAdd, trackWishlistRemove } =
    useSpeisekarteTier1Tracking({
      restaurantId,
      tischNummer,
      effectiveMainTab,
      filter,
      modalItem,
    });

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
        const tags = (item: MenuItem) => (item.tags ?? []).map((t) => t.toLowerCase());
        list = list.filter((item) => tags(item).includes(filter));
      }
      if (activeAllergens.size > 0) {
        list = list.filter((item) => {
          const ids = (item.allergen_ids ?? []) as string[];
          return !ids.some((a) => activeAllergens.has(a));
        });
      }
      return list;
    },
    [filter, activeAllergens],
  );

  const handleAddToWishlist = useCallback(
    (item: MenuItem, qty?: number) => {
      addToWishlist(item, qty);
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

  const showHighlightSlider =
    effectiveMainTab === "speisen" && highlights.length > 0 && !subCategory;

  const { main: nameMain, accent: nameAccent } = splitRestaurantName(restaurantName);
  const ACCENT = (accentColor ?? "#C8894E").trim() || "#C8894E";

  return (
    <div
      className="min-h-screen text-[#F0EBE3] speisekarte-template"
      style={{ backgroundColor: "#0F0D0A" }}
    >
      {!consentGiven && (
        <ConsentBanner
          onConsent={() => {
            setConsentGiven(true);
          }}
        />
      )}
      {/* Hero – Referenz: speisekarte-v4.html (--bg #0F0D0A, Kupfer #C8894E / #E8A96E) */}
      <header
        className="relative overflow-hidden pt-10 pb-8 px-6 max-w-[880px] mx-auto"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${rgbaFromHex(
            ACCENT,
            0.35,
          )} 0%, transparent 60%), linear-gradient(180deg, #1a1208 0%, #0F0D0A 100%)`,
        }}
      >
        <div className="absolute inset-0 pointer-events-none opacity-[0.4]" style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,.022) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,.012) 40px)" }} />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="mb-4">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt={`${restaurantName} Logo`}
                  style={{
                    width: 160,
                    height: 56,
                    maxWidth: 160,
                    maxHeight: 56,
                    objectFit: "contain",
                    backgroundColor: "transparent",
                    display: "block",
                  }}
                />
              ) : (
                <div
                  className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-[0.62rem] font-medium tracking-[0.22em] uppercase"
                  style={{
                    borderColor: rgbaFromHex(ACCENT, 0.3),
                    backgroundColor: rgbaFromHex(ACCENT, 0.08),
                    color: ACCENT,
                  }}
                >
                  {restaurantName}
                </div>
              )}
            </div>
            <div className="font-[var(--font-playfair,ui-serif)] text-[clamp(2.6rem,7vw,3.6rem)] leading-none tracking-[-0.04em] text-[#F0EBE3]">
              {nameMain}{" "}
                {nameAccent && (
                  <span className="italic" style={{ color: ACCENT }}>
                    {nameAccent}
                  </span>
                )}
            </div>
            <div className="mt-3 text-[0.72rem] uppercase tracking-[0.16em]" style={{ color: "#8A7E70" }}>
              Getränke · Weine · Bites
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="inline-flex items-center gap-2 text-[0.72rem] text-[#7a9e6e]">
              <span className="inline-block w-2 h-2 rounded-full bg-[#7a9e6e] shadow-[0_0_10px_rgba(122,158,110,0.9)]" />
              Jetzt geöffnet
            </div>
            <button
              type="button"
              onClick={() => setLang((prev) => (prev === "de" ? "en" : "de"))}
              className="mt-2 rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(21,18,14,0.9)] px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#b0a392] hover:text-[#f0ebe3]"
              style={{ borderColor: rgbaFromHex(ACCENT, 0.3), transition: "border-color 200ms ease, color 200ms ease" }}
            >
              {lang === "de" ? "DE" : "EN"}
            </button>
          </div>
        </div>
      </header>

      {/* Special bar / Daily Push – unterhalb des Headers mit Abstand, nicht abgeschnitten */}
      {dailyPush && (
        <div className="max-w-[880px] mx-auto px-4 mt-4 mb-3">
          <DailyPushBanner dailyPush={dailyPush} onOpenPopup={openDailyPopup} />
        </div>
      )}

      {/* Tabs / Filter (sticky) – Hintergrund wie speisekarte-v4 .tabs-wrap */}
      <div className="sticky top-0 z-[120] border-b backdrop-blur-xl" style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "#0F0D0A" }}>
        <div className="max-w-[880px] mx-auto px-4">
          <FilterBar
            theme="bar-soleil"
            mainTabs={mainTabs}
            mainTab={effectiveMainTab}
            onMainTabChange={(key) => {
              setPickedMainTab(key);
              setSubCategory(null);
              setFilter("all");
            }}
            subCategories={subCategories}
            subCategory={subCategory}
            onSubCategoryChange={setSubCategory}
            filter={filter}
            onFilterChange={setFilter}
            activeAllergenCount={activeAllergens.size}
            onAllergenOpen={() => setAllergenOpen(true)}
          />
        </div>
      </div>

      {/* Content – MenuGrid mit Bar-Soleil-Farben (--text, --copper, --card) */}
      <main className="max-w-[880px] mx-auto px-4 pt-6 pb-28" style={{ backgroundColor: "#0F0D0A" }}>
        <MenuGrid
          theme="bar-soleil"
          showHighlightSlider={showHighlightSlider}
          highlights={highlights}
          onAddToCart={handleAddToWishlist}
          visibleSections={visibleSections}
          filterItems={filterItems}
          onItemClick={setModalItem}
          activeAllergens={activeAllergens}
          bannerSlot={null}
          isInWishlist={isInWishlist}
          onCategorySectionRef={onCategorySectionRef}
        />
      </main>

      {/* Item Modal */}
      {modalItem && (
        <ItemModal
          item={modalItem}
          allItems={menuItems}
          onClose={() => setModalItem(null)}
          onAddToCart={handleAddToWishlist}
          isInWishlist={isInWishlist}
          theme="bar-soleil"
        />
      )}

      {/* Wishlist – hoher z-index damit Drawer über Bottom-Nav (z-140) erscheint */}
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

      {/* Daily Push Popup — dailyPush und handleAddToWishlist werden durchgereicht */}
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

      {/* Allergens */}
      <AllergenSheet
        open={allergenOpen}
        onClose={() => setAllergenOpen(false)}
        activeAllergens={activeAllergens}
        onToggleAllergen={toggleAllergen}
        onApply={() => setAllergenOpen(false)}
        onClearAll={() => setActiveAllergens(new Set())}
      />

      {/* Bottom Nav – wie speisekarte-v4 .bottom-nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-[140] border-t backdrop-blur-2xl" style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(15,13,10,0.95)" }}>
        <div className="max-w-[880px] mx-auto px-5 py-3 flex items-center gap-3">
          <button
            type="button"
            className="flex-1 flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-[0.72rem] font-medium tracking-[0.12em] uppercase"
            style={{
              color: ACCENT,
              backgroundColor: rgbaFromHex(ACCENT, 0.08),
              border: `1px solid ${rgbaFromHex(ACCENT, 0.22)}`,
            }}
          >
            <span className="text-[1.1rem]">🍸</span>
            Karte
          </button>
          <button
            type="button"
            onClick={() => openWishlist()}
            className="flex-1 relative flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-[0.72rem] font-medium tracking-[0.12em] uppercase border"
            style={{
              color: "#F0EBE3",
              backgroundColor: "rgba(255,255,255,0.03)",
              borderColor: "rgba(255,255,255,0.12)",
            }}
          >
            <span className="text-[1.1rem]">🔖</span>
            Merkliste
            <span
              className={`absolute -top-1.5 right-3 min-w-[18px] h-[18px] rounded-full text-[0.62rem] font-bold flex items-center justify-center transition-all duration-200 ${
                wishlistCount > 0 ? "opacity-100 scale-100" : "opacity-0 scale-75"
              }`}
              style={{ backgroundColor: ACCENT, color: "#0F0D0A" }}
            >
              {wishlistCount}
            </span>
          </button>
        </div>
      </nav>
    </div>
  );
}
