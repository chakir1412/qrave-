"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import type { SpeisekarteProps } from "@/components/speisekarte";
import type { MenuItem, OpeningHoursDay } from "@/lib/supabase";
import { parseOpeningHours } from "@/lib/supabase";
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
import { type FilterKey } from "@/components/speisekarte/constants";
import { getDisplayPrice } from "@/components/speisekarte/utils";
import WirtshausItemModal from "./WirtshausItemModal";

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

function isOpenNow(hours: OpeningHoursDay[] | null, now = new Date()): boolean {
  if (!hours || hours.length !== 7) return false;
  const jsDay = now.getDay();
  const idx = jsDay === 0 ? 6 : jsDay - 1;
  const day = hours[idx];
  if (!day || day.closed) return false;
  const [oh, om] = day.open.split(":").map((x) => parseInt(x, 10));
  const [ch, cm] = day.close.split(":").map((x) => parseInt(x, 10));
  if (![oh, om, ch, cm].every(Number.isFinite)) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  return cur >= oh * 60 + om && cur <= ch * 60 + cm;
}

export default function FrankfurterWirtshausTemplate(props: SpeisekarteProps) {
  const {
    menuItems,
    restaurantName,
    dailyPushes = [],
    restaurantId,
    tischNummer,
    sponsoredItems = [],
    guestNote = null,
    lunchOffers = [],
    openingHours = null,
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

  // Open-Status alle 60s aktualisieren (kein hydration-Mismatch durch SSR-Zeit).
  const [openNow, setOpenNow] = useState(false);
  useEffect(() => {
    const parsed = parseOpeningHours(openingHours);
    const update = () => setOpenNow(isOpenNow(parsed));
    update();
    const t = window.setInterval(update, 60_000);
    return () => window.clearInterval(t);
  }, [openingHours]);

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
        <ConsentBanner onConsent={() => setConsentGiven(true)} />
      )}

      {/* Header — gedruckte Speisekarte */}
      <header
        className="relative px-5 pb-6 pt-9"
        style={{
          background: COL.bg,
          borderBottom: `1px solid ${COL.dividerSoft}`,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 14,
            right: 18,
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            color: openNow ? "#3a7d52" : COL.textMuted,
            fontWeight: 500,
            letterSpacing: "0.06em",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              backgroundColor: openNow ? "#3a7d52" : COL.textSubtle,
              boxShadow: openNow ? "0 0 6px rgba(58,125,82,0.6)" : "none",
            }}
            aria-hidden
          />
          {openNow ? "Geöffnet" : "Geschlossen"}
        </div>
        <div
          className="mx-auto max-w-[880px] text-center"
          style={{ paddingTop: 6 }}
        >
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
          <button
            type="button"
            onClick={openWishlist}
            style={{
              position: "absolute",
              top: 14,
              left: 18,
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: cartCount > 0 ? COL.accent : COL.textMuted,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontWeight: cartCount > 0 ? 600 : 500,
            }}
          >
            Merkliste {cartCount > 0 ? `(${cartCount})` : ""}
          </button>
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
          />
        )}
      </main>

      {/* Item Modal */}
      {modalItem && (
        <WirtshausItemModal
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

      {/* Footer */}
      <footer
        className="border-t py-6 text-center"
        style={{ borderColor: COL.dividerSoft }}
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
};

function ItemList({ sections, filterItems, onItemClick, onCategorySectionRef }: ItemListProps) {
  if (sections.length === 0) {
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
      {sections.map((sec, idx) => {
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
              {items.map((item) => (
                <li key={item.id} style={{ borderBottom: `1px dotted ${COL.dividerSoft}` }}>
                  <button
                    type="button"
                    onClick={() => onItemClick(item)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "14px 0",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
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
                        }}
                      >
                        {item.name}
                      </span>
                      <span
                        style={{
                          fontFamily: SERIF,
                          fontSize: 16,
                          fontWeight: 500,
                          color: COL.accent,
                          whiteSpace: "nowrap",
                          letterSpacing: "-0.01em",
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
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
