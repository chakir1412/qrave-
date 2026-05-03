"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  deriveCategoryTabsFromItems,
  buildSectionsForCategoryTab,
  categoryTabLabel,
  CATEGORY_TAB_ALLE_KEY,
} from "./menu-layout";
import type { MenuItem, DailyPush, SponsoredItem, LunchOffer } from "@/lib/supabase";
import { useWishlist } from "../shared/useWishlist";
import { useDailyPush } from "../shared/useDailyPush";
import { useAnalytics } from "../shared/useAnalytics";
import ConsentBanner from "@/components/ConsentBanner";
import Header from "./Header";
import FilterBar, { AllergenSheet, type MainTabItem } from "./FilterBar";
import MenuGrid, { type Section } from "./MenuGrid";
import ItemModal from "./ItemModal";
import Wishlist from "./Wishlist";
import { DailyPushBanner, DailyPushPopup, dailyPushToMenuItem } from "./DailyPush";
import GuestNoteBanner from "./GuestNoteBanner";
import LunchSection from "./LunchSection";
import { activeLunchOffers } from "@/lib/lunch";
import type { FilterKey } from "./constants";
import { useSpeisekarteTier1Tracking } from "./useSpeisekarteTier1Tracking";

export type SpeisekarteProps = {
  categories: string[];
  menuItems: MenuItem[];
  restaurantName: string;
  accentColor?: string;
  logoUrl?: string;
  highlights?: MenuItem[];
  /** Bis zu 3 Tages-Specials pro Tag. */
  dailyPushes?: DailyPush[];
  /** Öffentliche Restaurant-ID für Tier-1-Tracking */
  restaurantId?: string;
  tischNummer?: number;
  /** Gesponserte Partner-Items (lib/speisekarte-logic) */
  sponsoredItems?: SponsoredItem[];
  /** Frei-Text-Hinweis für Gäste (z. B. „Heute extra-lange Wartezeiten"). */
  guestNote?: string | null;
  /** Mittagsangebote — wenn aktuell im Zeitfenster, eigene Sektion oben. */
  lunchOffers?: LunchOffer[];
  /** Wochenplan (Mo–So) für „Heute geöffnet"-Indicator. */
  openingHours?: import("@/lib/supabase").OpeningHours | null;
};

export default function Speisekarte({
  categories,
  menuItems,
  restaurantName,
  highlights = [],
  dailyPushes = [],
  restaurantId,
  tischNummer,
  sponsoredItems = [],
  guestNote = null,
  lunchOffers = [],
}: SpeisekarteProps) {
  const primaryDailyPush = dailyPushes[0] ?? null;
  const [lang, setLang] = useState<"de" | "en">("de");
  const [pickedMainTab, setPickedMainTab] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [activeAllergens, setActiveAllergens] = useState<Set<string>>(new Set());
  /** Modal-Stack: oben = aktuelles Modal. Beim Schließen pop, sodass das vorherige Item wieder sichtbar ist. */
  const [modalStack, setModalStack] = useState<MenuItem[]>([]);
  const modalItem = modalStack[modalStack.length - 1] ?? null;
  const pushModal = useCallback((item: MenuItem) => {
    setModalStack((prev) => [...prev, item]);
  }, []);
  const popModal = useCallback(() => {
    setModalStack((prev) => prev.slice(0, -1));
  }, []);
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
    closePopup: closeDailyPopup,
  } = useDailyPush(primaryDailyPush, consentGiven);

  const openDailyPushItem = useCallback(
    (dp: DailyPush) => {
      const matched =
        menuItems.find((m) => m.name.trim().toLowerCase() === dp.item_name.trim().toLowerCase()) ??
        menuItems.find((m) =>
          m.name.trim().toLowerCase().includes(dp.item_name.trim().toLowerCase()),
        );
      pushModal(matched ?? dailyPushToMenuItem(dp));
    },
    [menuItems, pushModal],
  );
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
      hasDailyPush: dailyPushes.length > 0,
      itemCount: menuItems.length,
    });
    return undefined;
  }, [track, restaurantName, dailyPushes.length, menuItems.length]);

  // Initial false (SSR-konsistent); useEffect setzt nach Mount den echten
  // Zustand, Wechsel werden im 60s-Interval geprüft.
  const [hasActiveLunch, setHasActiveLunch] = useState(false);
  useEffect(() => {
    const update = () => setHasActiveLunch(activeLunchOffers(lunchOffers).length > 0);
    update();
    const t = window.setInterval(update, 60_000);
    return () => window.clearInterval(t);
  }, [lunchOffers]);

  const LUNCH_TAB_KEY = "lunch";
  const mainTabs: MainTabItem[] = useMemo(() => {
    const derived = deriveCategoryTabsFromItems(menuItems);
    if (hasActiveLunch) {
      return [{ key: LUNCH_TAB_KEY, label: "🍽️ Mittagsangebot" }, ...derived];
    }
    return derived;
  }, [menuItems, hasActiveLunch]);

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

  const currentSections = useMemo(
    () =>
      effectiveMainTab === LUNCH_TAB_KEY
        ? []
        : buildSectionsForCategoryTab(effectiveMainTab, menuItems),
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

      {guestNote && guestNote.trim() ? (
        <div className="max-w-[880px] mx-auto px-[22px] pt-4">
          <GuestNoteBanner note={guestNote} />
        </div>
      ) : null}

      <main className="max-w-[880px] mx-auto px-[22px] pt-7 pb-28">
        {effectiveMainTab === LUNCH_TAB_KEY ? (
          <LunchSection
            offers={lunchOffers}
            menuItems={menuItems}
            onItemClick={pushModal}
          />
        ) : (
          <MenuGrid
            showHighlightSlider={showHighlightSlider}
            highlights={highlights}
            onAddToCart={handleAddToWishlist}
            visibleSections={visibleSections}
            filterItems={filterItems}
            onItemClick={pushModal}
            activeAllergens={activeAllergens}
            isInWishlist={isInWishlist}
            onCategorySectionRef={onCategorySectionRef}
            bannerSlot={
              dailyPushes.length > 0 && effectiveMainTab === CATEGORY_TAB_ALLE_KEY ? (
                <div className="mb-3 flex flex-col gap-2">
                  {dailyPushes.map((dp) => (
                    <DailyPushBanner
                      key={dp.id}
                      dailyPush={dp}
                      onOpenPopup={() => openDailyPushItem(dp)}
                    />
                  ))}
                </div>
              ) : null
            }
          />
        )}
      </main>

      {modalItem && (
        <ItemModal
          item={modalItem}
          menuItems={menuItems}
          sponsoredItems={sponsoredItems}
          restaurantId={restaurantId}
          onClose={popModal}
          onSelectItem={pushModal}
          onAddToWishlist={handleAddToWishlist}
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

      {primaryDailyPush && (
        <DailyPushPopup
          dailyPush={primaryDailyPush}
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
