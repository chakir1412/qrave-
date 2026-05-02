"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  deriveCategoryTabsFromItems,
  buildSectionsForCategoryTab,
  categoryTabLabel,
  CATEGORY_TAB_ALLE_KEY,
} from "./menu-layout";
import type { MenuItem, DailyPush, SponsoredItem } from "@/lib/supabase";
import { useWishlist } from "../shared/useWishlist";
import { useDailyPush } from "../shared/useDailyPush";
import { useAnalytics } from "../shared/useAnalytics";
import ConsentBanner from "@/components/ConsentBanner";
import Header from "./Header";
import FilterBar, { AllergenSheet, type MainTabItem } from "./FilterBar";
import MenuGrid, { type Section } from "./MenuGrid";
import ItemModal from "./ItemModal";
import Wishlist from "./Wishlist";
import { DailyPushBanner, DailyPushPopup } from "./DailyPush";
import type { FilterKey } from "./constants";
import { useSpeisekarteTier1Tracking } from "./useSpeisekarteTier1Tracking";

export type SpeisekarteProps = {
  categories: string[];
  menuItems: MenuItem[];
  restaurantName: string;
  accentColor?: string;
  logoUrl?: string;
  highlights?: MenuItem[];
  dailyPush?: DailyPush | null;
  /** Öffentliche Restaurant-ID für Tier-1-Tracking */
  restaurantId?: string;
  tischNummer?: number;
  /** Gesponserte Partner-Items (lib/speisekarte-logic) */
  sponsoredItems?: SponsoredItem[];
};

export default function Speisekarte({
  categories,
  menuItems,
  restaurantName,
  highlights = [],
  dailyPush = null,
  restaurantId,
  tischNummer,
  sponsoredItems = [],
}: SpeisekarteProps) {
  const [lang, setLang] = useState<"de" | "en">("de");
  const [pickedMainTab, setPickedMainTab] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [activeAllergens, setActiveAllergens] = useState<Set<string>>(new Set());
  const [modalItem, setModalItem] = useState<MenuItem | null>(null);
  const [allergenOpen, setAllergenOpen] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
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

  // Erste einfache Analytics-Ereignisse, aktuell noch ohne echtes Tracking-Backend
  // (siehe `components/shared/useAnalytics.ts`)
  useMemo(() => {
    track("view_menu", {
      restaurantName,
      hasDailyPush: Boolean(dailyPush),
      itemCount: menuItems.length,
    });
    return undefined;
  }, [track, restaurantName, dailyPush, menuItems.length]);

  const mainTabs: MainTabItem[] = useMemo(() => deriveCategoryTabsFromItems(menuItems), [menuItems]);

  const mainTab = useMemo(() => {
    if (pickedMainTab && mainTabs.some((t) => t.key === pickedMainTab)) return pickedMainTab;
    return mainTabs[0]?.key ?? CATEGORY_TAB_ALLE_KEY;
  }, [pickedMainTab, mainTabs]);

  const effectiveMainTab = useMemo(() => {
    const firstKey = mainTabs[0]?.key ?? CATEGORY_TAB_ALLE_KEY;
    const sections = buildSectionsForCategoryTab(mainTab, menuItems);
    if (sections.length > 0) return mainTab;
    return firstKey;
  }, [mainTab, mainTabs, menuItems]);

  const currentSections = useMemo(
    () => buildSectionsForCategoryTab(effectiveMainTab, menuItems),
    [menuItems, effectiveMainTab],
  );

  const visibleSections = useMemo(() => currentSections, [currentSections]);

  const activeCategoryLabel = useMemo(() => categoryTabLabel(effectiveMainTab), [effectiveMainTab]);

  const { onCategorySectionRef, trackWishlistAdd, trackWishlistRemove, trackCategoryTabSelect } =
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
    [filter, activeAllergens]
  );

  const showHighlightSlider =
    effectiveMainTab === CATEGORY_TAB_ALLE_KEY && highlights.length > 0;

  return (
    <div className="min-h-screen text-[#1a1916] speisekarte-template" style={{ backgroundColor: "var(--bg, #fafaf8)" }}>
      {!consentGiven && (
        <ConsentBanner
          onConsent={() => {
            setConsentGiven(true);
          }}
        />
      )}
      <header className="sticky top-0 z-[100] border-b border-[#e8e4dc] bg-[rgba(250,250,248,0.95)] backdrop-blur-xl">
        <div className="max-w-[880px] mx-auto px-[22px]">
          <Header
            restaurantName={restaurantName}
            lang={lang}
            onLangToggle={() => setLang(lang === "de" ? "en" : "de")}
            cartCount={cartCount}
            onCartOpen={openWishlist}
          />
          <FilterBar
            mainTabs={mainTabs}
            mainTab={effectiveMainTab}
            onMainTabChange={(key) => {
              setPickedMainTab(key);
              setFilter("all");
              trackCategoryTabSelect(categoryTabLabel(key));
            }}
            subCategories={[]}
            subCategory={null}
            onSubCategoryChange={() => {}}
            filter={filter}
            onFilterChange={setFilter}
            activeAllergenCount={activeAllergens.size}
            onAllergenOpen={() => setAllergenOpen(true)}
          />
        </div>
      </header>

      <main className="max-w-[880px] mx-auto px-[22px] pt-7 pb-28">
        <MenuGrid
          showHighlightSlider={showHighlightSlider}
          highlights={highlights}
          onAddToCart={handleAddToWishlist}
          visibleSections={visibleSections}
          filterItems={filterItems}
          onItemClick={setModalItem}
          activeAllergens={activeAllergens}
          isInWishlist={isInWishlist}
          onCategorySectionRef={onCategorySectionRef}
          bannerSlot={
            dailyPush && effectiveMainTab === CATEGORY_TAB_ALLE_KEY ? (
              <DailyPushBanner dailyPush={dailyPush} onOpenPopup={openDailyPopup} />
            ) : null
          }
        />
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
          theme="light"
        />
      )}

      <Wishlist
        open={wishlistOpen}
        onClose={closeWishlist}
        cart={entries}
        onUpdateQty={updateQty}
        onRemove={handleRemoveFromWishlist}
        cartTotal={cartTotal}
        onClear={clearWishlist}
        restaurantName={restaurantName}
      />

      {dailyPush && (
        <DailyPushPopup
          dailyPush={dailyPush}
          menuItems={menuItems}
          open={dailyPopupOpen}
          onClose={closeDailyPopup}
          onAddToCart={handleAddToWishlist}
        />
      )}

      <AllergenSheet
        open={allergenOpen}
        onClose={() => setAllergenOpen(false)}
        activeAllergens={activeAllergens}
        onToggleAllergen={toggleAllergen}
        onApply={() => setAllergenOpen(false)}
        onClearAll={() => setActiveAllergens(new Set())}
      />

      <footer className="text-center py-5 text-[0.68rem] text-[#9a948a] border-t border-[#e8e4dc]">
        <a href="/impressum" className="text-[#9a948a] no-underline hover:text-[#b8966a]">Impressum</a>
        {" · "}
        <a href="/datenschutz" className="text-[#9a948a] no-underline hover:text-[#b8966a]">Datenschutz</a>
      </footer>
    </div>
  );
}
