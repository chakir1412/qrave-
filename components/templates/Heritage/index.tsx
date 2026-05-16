"use client";

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
import { DRINK_CATEGORIES } from "@/lib/category-types";
import { useSpeisekarteTier1Tracking } from "@/components/speisekarte/useSpeisekarteTier1Tracking";
import { type FilterKey } from "@/components/speisekarte/constants";
import { getDisplayPrice } from "@/components/speisekarte/utils";
import HeritageItemModal from "./HeritageItemModal";

const COL = {
  bg: "#F5F0E8",
  text: "#1A1209",
  textMuted: "#6E665C",
  textSubtle: "#9A948A",
  accent: "#C8894E",
  accentSecondary: "#8B6914",
  divider: "rgba(200,137,78,0.3)",
  dividerSoft: "rgba(200,137,78,0.18)",
  white: "#FFFFFF",
  cream: "#EDE5D6",
} as const;

const SERIF = 'Georgia, "Times New Roman", ui-serif, serif';
const LUNCH_TAB_KEY = "__wirtshaus_lunch__";

const FILTER_OPTIONS: ReadonlyArray<{ key: FilterKey; label: string }> = [
  { key: "all", label: "Alle" },
  { key: "vegan", label: "🌱 Vegan" },
  { key: "veg", label: "🌿 Vegetarisch" },
  { key: "gf", label: "🚫 Glutenfrei" },
  { key: "spicy", label: "🌶 Scharf" },
];

/** Filter-Key → akzeptierte Tag-Werte. Im Repo existieren historisch zwei
 *  Schreibweisen (Kurz: "veg"/"gf"/"spicy" aus dem EditItemOverlay; Lang:
 *  "vegetarisch"/"glutenfrei"/"scharf" aus PDF-Import + manuellen SQL-Updates).
 *  Wir matchen beide. */
const FILTER_TAG_ALIASES: Record<FilterKey, ReadonlyArray<string>> = {
  all: [],
  vegan: ["vegan"],
  veg: ["vegetarisch", "veg", "vegetarian"],
  gf: ["glutenfrei", "gf", "gluten-free", "glutenfree"],
  spicy: ["scharf", "spicy", "hot"],
};

// Drink-Categories werden zentral aus lib/category-types geliefert,
// damit Wirts-Dashboard und Wirtshaus-Template synchron bleiben.

export default function HeritageTemplate(props: SpeisekarteProps) {
  const {
    menuItems,
    restaurantName,
    dailyPushes = [],
    restaurantId,
    tischNummer,
    sponsoredItems = [],
    guestNote = null,
    lunchOffers = [],
  } = props;

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
      template: "frankfurter-wirtshaus",
    });
    return undefined;
  }, [track, restaurantName, dailyPushes.length, menuItems.length]);

  const derivedTabs = useMemo(() => deriveCategoryTabsFromItems(menuItems), [menuItems]);

  const mainTabs = useMemo(() => {
    if (hasActiveLunch) {
      return [{ key: LUNCH_TAB_KEY, label: "🍽 Mittagsangebot" }, ...derivedTabs];
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
        const aliases = FILTER_TAG_ALIASES[filter];
        list = list.filter((item) => {
          const tags = (item.tags ?? []).map((t) => t.trim().toLowerCase());
          return aliases.some((a) => tags.includes(a));
        });
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

  const taglineCategories = useMemo(() => {
    const seen = new Set<string>();
    const labels: string[] = [];
    for (const t of derivedTabs) {
      const k = t.label.trim().toUpperCase();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      labels.push(k);
      if (labels.length >= 4) break;
    }
    return labels;
  }, [derivedTabs]);

  const handleDailyPushClick = useCallback(
    (dpId: string) => {
      const dp = dailyPushes.find((p) => p.id === dpId);
      if (!dp) return;
      const matched =
        menuItems.find(
          (m) => m.name.trim().toLowerCase() === dp.item_name.trim().toLowerCase(),
        ) ??
        menuItems.find((m) =>
          m.name.trim().toLowerCase().includes(dp.item_name.trim().toLowerCase()),
        );
      pushModal(matched ?? dailyPushToMenuItem(dp));
    },
    [dailyPushes, menuItems, pushModal],
  );

  const tabButtonStyle = (active: boolean): CSSProperties => ({
    flexShrink: 0,
    padding: "10px 4px",
    margin: "0 8px",
    fontSize: 12,
    fontWeight: active ? 600 : 500,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: active ? COL.accent : COL.textMuted,
    borderBottom: `2px solid ${active ? COL.accent : "transparent"}`,
    background: "transparent",
    cursor: "pointer",
    transition: "color 200ms ease, border-color 200ms ease",
    whiteSpace: "nowrap",
  });

  const filterPillStyle = (active: boolean): CSSProperties => ({
    flexShrink: 0,
    padding: "5px 12px",
    fontSize: 11,
    fontWeight: 500,
    color: active ? COL.accent : COL.textMuted,
    border: `1px solid ${active ? COL.accent : "transparent"}`,
    borderRadius: 999,
    background: active ? "rgba(200,137,78,0.06)" : "transparent",
    cursor: "pointer",
    whiteSpace: "nowrap",
  });

  return (
    <div
      className="min-h-screen speisekarte-template"
      style={{ backgroundColor: COL.bg, color: COL.text }}
    >
      {!consentGiven && (
        <ConsentBanner theme="warm" onConsent={() => setConsentGiven(true)} />
      )}

      {/* Header — gedruckte Speisekarte */}
      <header
        className="px-5 pb-6 pt-9"
        style={{
          background: COL.bg,
          borderBottom: `1px solid ${COL.dividerSoft}`,
        }}
      >
        <div className="mx-auto max-w-[880px] text-center">
          <h1
            style={{
              fontFamily: SERIF,
              fontSize: "clamp(2.2rem, 5.5vw, 3rem)",
              fontWeight: 400,
              color: COL.text,
              margin: 0,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
            }}
          >
            {restaurantName}
          </h1>
          {taglineCategories.length > 0 ? (
            <div
              style={{
                marginTop: 12,
                fontSize: 11,
                letterSpacing: "0.24em",
                color: COL.accent,
                fontWeight: 500,
              }}
            >
              {taglineCategories.join("  ·  ")}
            </div>
          ) : null}
        </div>
      </header>

      {/* Banner: Guest-Note + Daily-Push (helles Wirtshaus-Theme inline) */}
      {(guestNote && guestNote.trim()) || dailyPushes.length > 0 ? (
        <div className="mx-auto mt-4 max-w-[880px] px-5">
          {guestNote && guestNote.trim() ? <GuestNoteBanner note={guestNote} /> : null}
          {dailyPushes.length > 0 ? (
            <div className="flex flex-col gap-2">
              {dailyPushes.map((dp) => (
                <button
                  key={dp.id}
                  type="button"
                  onClick={() => handleDailyPushClick(dp.id)}
                  className="flex items-center gap-3 rounded-2xl border p-4 text-left transition"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(200,137,78,0.10), rgba(255,255,255,0.65))",
                    borderColor: COL.divider,
                    color: COL.text,
                  }}
                >
                  <span style={{ fontSize: "2rem", lineHeight: 1 }}>
                    {dp.item_emoji || "⭐"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        color: COL.accent,
                        marginBottom: 2,
                      }}
                    >
                      Chef empfiehlt heute
                    </div>
                    <div
                      style={{
                        fontFamily: SERIF,
                        fontSize: "1.15rem",
                        fontWeight: 400,
                        color: COL.text,
                        letterSpacing: "-0.005em",
                      }}
                    >
                      {dp.item_name}
                    </div>
                    {dp.item_desc ? (
                      <div
                        style={{
                          fontSize: 12,
                          color: COL.textMuted,
                          marginTop: 2,
                        }}
                      >
                        {dp.item_desc}
                      </div>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Kategorie-Tabs */}
      <nav
        className="sticky top-0 z-[80] mt-4"
        style={{
          background: COL.bg,
          borderBottom: `1px solid ${COL.dividerSoft}`,
        }}
      >
        <div className="mx-auto max-w-[880px]">
          <div
            className="scrollbar-hide flex overflow-x-auto px-5"
            style={{ paddingBottom: 0 }}
          >
            {mainTabs.map((tab) => {
              const active = effectiveMainTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setPickedMainTab(tab.key);
                    setFilter("all");
                    if (tab.key !== LUNCH_TAB_KEY) {
                      trackCategoryTabSelect(categoryTabLabel(tab.key));
                    }
                  }}
                  style={tabButtonStyle(active)}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          {/* Filter + Allergene */}
          <div
            className="flex items-center gap-2 px-5 pb-3 pt-2"
            style={{ borderTop: `1px solid ${COL.dividerSoft}` }}
          >
            <div className="scrollbar-hide flex flex-1 gap-1 overflow-x-auto">
              {FILTER_OPTIONS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  style={filterPillStyle(filter === f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setAllergenOpen(true)}
              style={{
                flexShrink: 0,
                padding: "5px 12px",
                fontSize: 11,
                fontWeight: 600,
                color: activeAllergens.size > 0 ? "#c84030" : COL.textMuted,
                border: `1px solid ${activeAllergens.size > 0 ? "#c84030" : COL.dividerSoft}`,
                borderRadius: 999,
                background:
                  activeAllergens.size > 0 ? "rgba(200,64,48,0.06)" : "transparent",
                cursor: "pointer",
              }}
            >
              ⚠️ {activeAllergens.size > 0 ? `Filter (${activeAllergens.size})` : "Allergene"}
            </button>
          </div>
        </div>
      </nav>

      {/* Inhalt */}
      <main className="mx-auto max-w-[880px] px-5 pb-28 pt-6">
        {effectiveMainTab === LUNCH_TAB_KEY ? (
          <LunchSection offers={lunchOffers} menuItems={menuItems} onItemClick={pushModal} />
        ) : (
          <ItemList
            sections={sections}
            filterItems={filterItems}
            onItemClick={pushModal}
            onCategorySectionRef={onCategorySectionRef}
            onItemCardRef={onItemCardRef}
            hideCategories={filter !== "all" ? DRINK_CATEGORIES : null}
          />
        )}
      </main>

      {/* Item Modal */}
      {modalItem && (
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
        />
      )}

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
      />

      <AllergenSheet
        open={allergenOpen}
        onClose={() => setAllergenOpen(false)}
        activeAllergens={activeAllergens}
        onToggleAllergen={toggleAllergen}
        onApply={() => setAllergenOpen(false)}
        onClearAll={() => setActiveAllergens(new Set())}
      />

      {/* Bottom-Bar — Karte / Merkliste */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-[140] border-t"
        style={{
          borderColor: COL.divider,
          background: `${COL.bg}f2`,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <div className="mx-auto flex max-w-[880px] items-center gap-3 px-5 py-3">
          <button
            type="button"
            onClick={() => {
              if (wishlistOpen) closeWishlist();
            }}
            className="flex flex-1 flex-col items-center gap-1 rounded-xl px-3 py-2"
            style={{
              border: `1px solid ${!wishlistOpen ? COL.accent : COL.dividerSoft}`,
              background: !wishlistOpen ? "rgba(200,137,78,0.08)" : "transparent",
              color: !wishlistOpen ? COL.accent : COL.textMuted,
              fontSize: 11,
              fontWeight: !wishlistOpen ? 600 : 500,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 18 }} aria-hidden>
              📖
            </span>
            Karte
          </button>
          <button
            type="button"
            onClick={openWishlist}
            className="relative flex flex-1 flex-col items-center gap-1 rounded-xl px-3 py-2"
            style={{
              border: `1px solid ${wishlistOpen ? COL.accent : COL.dividerSoft}`,
              background: wishlistOpen ? "rgba(200,137,78,0.08)" : "transparent",
              color: wishlistOpen ? COL.accent : COL.textMuted,
              fontSize: 11,
              fontWeight: wishlistOpen ? 600 : 500,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 18 }} aria-hidden>
              🔖
            </span>
            Merkliste
            <span
              className="absolute"
              style={{
                top: 2,
                right: 12,
                minWidth: 18,
                height: 18,
                padding: "0 5px",
                borderRadius: 999,
                background: COL.accent,
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0,
                textTransform: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: cartCount > 0 ? 1 : 0,
                transform: cartCount > 0 ? "scale(1)" : "scale(0.75)",
                transition: "opacity 200ms ease, transform 200ms ease",
              }}
            >
              {cartCount}
            </span>
          </button>
        </div>
      </nav>

      {/* Footer */}
      <footer
        className="border-t py-6 text-center"
        style={{ borderColor: COL.dividerSoft, paddingBottom: 88 }}
      >
        <p
          style={{
            fontSize: 10,
            letterSpacing: "0.12em",
            color: COL.textSubtle,
            margin: "0 0 6px",
          }}
        >
          Bitte beachten Sie: für Allergiker stehen Ihnen unsere Mitarbeiter zur Verfügung.
        </p>
        <p
          style={{
            fontSize: 10,
            color: COL.textSubtle,
            margin: 0,
          }}
        >
          <a
            href="/impressum"
            style={{ color: COL.textSubtle, textDecoration: "none" }}
          >
            Impressum
          </a>
          {" · "}
          <a
            href="/datenschutz"
            style={{ color: COL.textSubtle, textDecoration: "none" }}
          >
            Datenschutz
          </a>
        </p>
      </footer>

    </div>
  );
}

type ItemListProps = {
  sections: ReturnType<typeof buildSectionsForCategoryTab>;
  filterItems: (items: MenuItem[]) => MenuItem[];
  onItemClick: (item: MenuItem) => void;
  onCategorySectionRef: (kategorie: string, el: HTMLElement | null) => void;
  onItemCardRef?: (item: MenuItem, el: HTMLElement | null) => void;
  /** Wenn gesetzt: Kategorien aus diesem Set werden komplett ausgeblendet
   *  (z. B. Getränke bei aktivem Diät-Filter). */
  hideCategories: ReadonlySet<string> | null;
};

function ItemList({
  sections,
  filterItems,
  onItemClick,
  onCategorySectionRef,
  onItemCardRef,
  hideCategories,
}: ItemListProps) {
  const visibleSections =
    hideCategories === null
      ? sections
      : sections.filter((sec) => !hideCategories.has(sec.kategorie));

  if (visibleSections.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          color: COL.textMuted,
          padding: "60px 0",
          fontSize: 13,
        }}
      >
        Keine Gerichte mit den aktuellen Filtern.
      </div>
    );
  }

  return (
    <div>
      {visibleSections.map((sec, idx) => {
        const items = filterItems(sec.items);
        if (items.length === 0) return null;
        return (
          <section
            key={sec.kategorie}
            ref={(el) => onCategorySectionRef(sec.kategorie, el)}
            style={{
              marginTop: idx === 0 ? 0 : 32,
              paddingTop: idx === 0 ? 0 : 24,
              borderTop: idx === 0 ? "none" : `1px solid ${COL.divider}`,
            }}
          >
            <h2
              style={{
                fontFamily: SERIF,
                fontSize: 22,
                fontWeight: 400,
                color: COL.accentSecondary,
                letterSpacing: "0.04em",
                margin: "0 0 20px",
                textAlign: "center",
              }}
            >
              {sec.kategorie}
            </h2>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {items.map((item) => {
                const hasImage = Boolean(item.bild_url);
                const soldOut = item.sold_out === true;
                return (
                  <li
                    key={item.id}
                    ref={(el) => onItemCardRef?.(item, el)}
                    style={{ borderBottom: `1px dotted ${COL.dividerSoft}` }}
                  >
                    <button
                      type="button"
                      onClick={() => onItemClick(item)}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: hasImage ? 14 : 0,
                        width: "100%",
                        textAlign: "left",
                        padding: "14px 0",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        opacity: soldOut ? 0.5 : 1,
                      }}
                    >
                      {hasImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.bild_url as string}
                          alt={item.name}
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 8,
                            objectFit: "cover",
                            flexShrink: 0,
                            filter: soldOut ? "grayscale(1)" : undefined,
                          }}
                        />
                      ) : null}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "baseline",
                            gap: 16,
                          }}
                        >
                          <span
                            style={{
                              fontFamily: SERIF,
                              fontSize: 16,
                              fontWeight: 500,
                              color: COL.text,
                              flex: 1,
                              letterSpacing: "-0.005em",
                              textDecoration: soldOut ? "line-through" : undefined,
                            }}
                          >
                            {item.name}
                            {soldOut ? (
                              <span
                                style={{
                                  display: "inline-block",
                                  marginLeft: 8,
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  fontFamily: "system-ui, sans-serif",
                                  fontSize: 10,
                                  fontWeight: 600,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.06em",
                                  color: "#c44b6e",
                                  background: "rgba(255,75,110,0.12)",
                                  border: "1px solid rgba(255,75,110,0.3)",
                                  textDecoration: "none",
                                }}
                              >
                                Ausverkauft
                              </span>
                            ) : null}
                          </span>
                          <span
                            style={{
                              fontFamily: SERIF,
                              fontSize: 16,
                              fontWeight: 500,
                              color: COL.accent,
                              whiteSpace: "nowrap",
                              letterSpacing: "-0.01em",
                              textDecoration: soldOut ? "line-through" : undefined,
                            }}
                          >
                            {getDisplayPrice(item)}
                          </span>
                        </div>
                        {item.beschreibung ? (
                          <p
                            style={{
                              fontSize: 12.5,
                              color: COL.textMuted,
                              margin: "4px 0 0",
                              lineHeight: 1.5,
                              letterSpacing: "0.005em",
                            }}
                          >
                            {item.beschreibung}
                          </p>
                        ) : null}
                        {item.allergens_text && item.allergens_text.trim() ? (
                          <p
                            style={{
                              fontSize: 11,
                              color: COL.textSubtle,
                              margin: "3px 0 0",
                              fontStyle: "italic",
                            }}
                          >
                            {item.allergens_text}
                          </p>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
