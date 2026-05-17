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
import HeritageItemModal from "@/components/templates/Heritage/HeritageItemModal";
import { resolveBackground, type BackgroundMode } from "@/lib/template-background";

const COL = {
  bg: "#0a0805",
  cream: "rgba(255,248,235,0.88)",
  creamFull: "#fff8eb",
  muted: "rgba(255,248,235,0.38)",
  mutedSoft: "rgba(255,248,235,0.1)",
  gold: "#c9a84c",
  goldLight: "#e8c97a",
  card: "rgba(255,248,235,0.03)",
  border: "rgba(201,168,76,0.14)",
  borderStrong: "rgba(201,168,76,0.25)",
} as const;

const SERIF = `'Cormorant Garamond', Georgia, "Times New Roman", ui-serif, serif`;
const LUNCH_TAB_KEY = "__noir_lunch__";

const FILTER_OPTIONS: ReadonlyArray<{ key: FilterKey; label: string }> = [
  { key: "all", label: "Alle" },
  { key: "vegan", label: "Vegan" },
  { key: "veg", label: "Vegetarisch" },
  { key: "gf", label: "Glutenfrei" },
  { key: "spicy", label: "Scharf" },
];

const FILTER_TAG_ALIASES: Record<FilterKey, ReadonlyArray<string>> = {
  all: [],
  vegan: ["vegan"],
  veg: ["vegetarisch", "veg", "vegetarian"],
  gf: ["glutenfrei", "gf", "gluten-free", "glutenfree"],
  spicy: ["scharf", "spicy", "hot"],
};

export default function NoirTemplate(props: SpeisekarteProps) {
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
  } = props;
  const bgTheme = resolveBackground("noir", backgroundMode as BackgroundMode | null);

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
      template: "noir",
    });
    return undefined;
  }, [track, restaurantName, dailyPushes.length, menuItems.length]);

  const derivedTabs = useMemo(() => deriveCategoryTabsFromItems(menuItems), [menuItems]);

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

  const tabButtonStyle = (active: boolean): CSSProperties => ({
    flexShrink: 0,
    fontSize: 10,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: active ? COL.gold : COL.muted,
    padding: "0 16px 14px",
    cursor: "pointer",
    borderBottom: `1px solid ${active ? COL.gold : "transparent"}`,
    marginBottom: -1,
    whiteSpace: "nowrap",
    background: "transparent",
    border: "none",
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
    borderBottomColor: active ? COL.gold : "transparent",
    transition: "color 0.2s, border-color 0.2s",
    fontWeight: 500,
  });

  const filterPillStyle = (active: boolean): CSSProperties => ({
    flexShrink: 0,
    fontSize: 10,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: active ? COL.gold : COL.muted,
    padding: "6px 14px",
    border: `1px solid ${active ? COL.gold : COL.mutedSoft}`,
    borderRadius: 999,
    background: active ? "rgba(201,168,76,0.08)" : "transparent",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all 0.2s",
    fontWeight: 500,
  });

  // Erstes verfügbares Daily-Push als Special-Banner (Noir-Style, abweichend
  // zu Heritage wo eine Liste gerendert wird — Noir-Mockup zeigt nur eines).
  const featuredDailyPush = dailyPushes[0] ?? null;

  return (
    <div
      className="speisekarte-template"
      style={{
        background: bgTheme.bg,
        color: bgTheme.text,
        minHeight: "100vh",
        overflowX: "hidden",
        position: "relative",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        .noir-template { font-family: 'DM Sans', system-ui, sans-serif; }
        .noir-template .noir-item { animation: noirFadeUp 0.4s ease both; }
        .noir-template .noir-item:nth-child(1) { animation-delay: 0.05s; }
        .noir-template .noir-item:nth-child(2) { animation-delay: 0.1s; }
        .noir-template .noir-item:nth-child(3) { animation-delay: 0.15s; }
        .noir-template .noir-item:nth-child(4) { animation-delay: 0.2s; }
        .noir-template .noir-item:nth-child(5) { animation-delay: 0.25s; }
        .noir-template .noir-item:hover { transform: translateY(-2px); border-color: ${COL.borderStrong} !important; }
        @keyframes noirFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .noir-template .noir-scrollbar-hide::-webkit-scrollbar { display: none; }
        .noir-template .noir-scrollbar-hide { scrollbar-width: none; -ms-overflow-style: none; }
      `}</style>

      {!consentGiven && (
        <ConsentBanner onConsent={() => setConsentGiven(true)} />
      )}

      {/* Ambient Glow */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          background: "radial-gradient(ellipse 600px 400px at 50% -20%, rgba(201,168,76,0.06) 0%, transparent 70%)",
        }}
      />

      <div
        className="noir-template"
        style={{
          position: "relative",
          zIndex: 2,
          maxWidth: 480,
          margin: "0 auto",
          padding: "0 0 120px",
          fontFamily: `'DM Sans', system-ui, sans-serif`,
        }}
      >
        {/* Sticky Header */}
        <header
          style={{
            padding: "32px 24px 20px",
            borderBottom: `1px solid ${COL.border}`,
            position: "sticky",
            top: 0,
            background: "rgba(10,8,5,0.94)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            zIndex: 10,
          }}
        >
          <div style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: COL.gold, marginBottom: 4 }}>
            qrave.menu
          </div>
          <h1 style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 300, letterSpacing: "0.02em", color: COL.creamFull, lineHeight: 1.1, margin: 0 }}>
            {restaurantName}
          </h1>
        </header>

        {/* Tabs */}
        <nav
          className="noir-scrollbar-hide"
          style={{
            display: "flex",
            overflowX: "auto",
            padding: "20px 24px 0",
            borderBottom: `1px solid ${COL.border}`,
            gap: 0,
          }}
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
                  if (tab.key !== LUNCH_TAB_KEY) trackCategoryTabSelect(categoryTabLabel(tab.key));
                }}
                style={tabButtonStyle(active)}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Filter */}
        <div
          className="noir-scrollbar-hide"
          style={{ display: "flex", gap: 8, padding: "16px 24px", overflowX: "auto" }}
        >
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
          <button
            type="button"
            onClick={() => setAllergenOpen(true)}
            style={{
              ...filterPillStyle(activeAllergens.size > 0),
              borderColor: activeAllergens.size > 0 ? "#c84030" : COL.mutedSoft,
              color: activeAllergens.size > 0 ? "#e08070" : COL.muted,
              background: activeAllergens.size > 0 ? "rgba(200,64,48,0.08)" : "transparent",
            }}
          >
            {activeAllergens.size > 0 ? `Allergene (${activeAllergens.size})` : "Allergene"}
          </button>
        </div>

        {/* Guest-Note */}
        {guestNote && guestNote.trim() ? (
          <div style={{ padding: "0 16px 8px" }}>
            <GuestNoteBanner note={guestNote} />
          </div>
        ) : null}

        {/* Special Banner */}
        {featuredDailyPush ? (
          <button
            type="button"
            onClick={() => handleDailyPushClick(featuredDailyPush.id)}
            style={{
              margin: "8px 24px 16px",
              padding: "16px 20px",
              background: "rgba(201,168,76,0.07)",
              border: "1px solid rgba(201,168,76,0.2)",
              borderRadius: 10,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
              transition: "background 0.2s",
              width: "calc(100% - 48px)",
              color: COL.creamFull,
              textAlign: "left",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(201,168,76,0.11)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(201,168,76,0.07)"; }}
          >
            <div>
              <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: COL.gold, marginBottom: 4 }}>
                ✦ Tages-Special
              </div>
              <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 400, color: COL.creamFull }}>
                {featuredDailyPush.item_name}
              </div>
            </div>
            {(() => {
              const matched = menuItems.find(
                (m) => m.name.trim().toLowerCase() === featuredDailyPush.item_name.trim().toLowerCase(),
              );
              const price = matched ? getDisplayPrice(matched) : null;
              return price ? (
                <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 600, color: COL.gold }}>
                  {price}
                </div>
              ) : null;
            })()}
          </button>
        ) : null}

        {/* Inhalt */}
        <main>
          {effectiveMainTab === LUNCH_TAB_KEY ? (
            <div style={{ padding: "0 16px" }}>
              <LunchSection offers={lunchOffers} menuItems={menuItems} onItemClick={pushModal} />
            </div>
          ) : (
            <NoirItemList
              sections={sections}
              filterItems={filterItems}
              onItemClick={pushModal}
              onCategorySectionRef={onCategorySectionRef}
              onItemCardRef={onItemCardRef}
              hideCategories={filter !== "all" ? DRINK_CATEGORIES : null}
            />
          )}
        </main>

        {/* Footer */}
        <footer style={{ borderTop: `1px solid ${COL.border}`, padding: "24px 24px 16px", textAlign: "center" }}>
          <p style={{ fontSize: 10, color: COL.muted, margin: 0, letterSpacing: "0.08em" }}>
            <a href="/impressum" style={{ color: COL.muted, textDecoration: "none" }}>Impressum</a>
            {" · "}
            <a href="/datenschutz" style={{ color: COL.muted, textDecoration: "none" }}>Datenschutz</a>
          </p>
        </footer>
      </div>

      {/* Bottom-Nav */}
      <nav
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 480,
          background: "rgba(10,8,5,0.96)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTop: `1px solid ${COL.border}`,
          padding: "12px 0 28px",
          display: "flex",
          justifyContent: "space-around",
          zIndex: 140,
        }}
      >
        <button
          type="button"
          onClick={() => { if (wishlistOpen) closeWishlist(); }}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            cursor: "pointer",
            opacity: !wishlistOpen ? 1 : 0.38,
            background: "transparent",
            border: "none",
            color: !wishlistOpen ? COL.gold : COL.muted,
            transition: "opacity 0.2s, color 0.2s",
          }}
        >
          <span style={{ fontSize: 18 }} aria-hidden>◈</span>
          <span style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase" }}>Karte</span>
        </button>
        <button
          type="button"
          onClick={openWishlist}
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            cursor: "pointer",
            opacity: wishlistOpen ? 1 : 0.38,
            background: "transparent",
            border: "none",
            color: wishlistOpen ? COL.gold : COL.muted,
            transition: "opacity 0.2s, color 0.2s",
          }}
        >
          <span style={{ fontSize: 18 }} aria-hidden>♡</span>
          <span style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase" }}>Merkliste</span>
          {cartCount > 0 ? (
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -8,
                minWidth: 18,
                height: 18,
                padding: "0 5px",
                borderRadius: 999,
                background: COL.gold,
                color: COL.bg,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0,
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
          theme="dark"
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
        theme="dark"
      />
    </div>
  );
}

type NoirItemListProps = {
  sections: ReturnType<typeof buildSectionsForCategoryTab>;
  filterItems: (items: MenuItem[]) => MenuItem[];
  onItemClick: (item: MenuItem) => void;
  onCategorySectionRef: (kategorie: string, el: HTMLElement | null) => void;
  onItemCardRef?: (item: MenuItem, el: HTMLElement | null) => void;
  hideCategories: ReadonlySet<string> | null;
};

function NoirItemList({
  sections,
  filterItems,
  onItemClick,
  onCategorySectionRef,
  onItemCardRef,
  hideCategories,
}: NoirItemListProps) {
  const visibleSections =
    hideCategories === null ? sections : sections.filter((sec) => !hideCategories.has(sec.kategorie));

  if (visibleSections.length === 0) {
    return (
      <div style={{ textAlign: "center", color: COL.muted, padding: "60px 16px", fontSize: 13 }}>
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
            style={{ marginTop: idx === 0 ? 0 : 8 }}
          >
            <div style={{ padding: "20px 24px 0", display: "flex", alignItems: "center", gap: 16 }}>
              <h2 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 300, fontStyle: "italic", color: COL.goldLight, letterSpacing: "0.02em", whiteSpace: "nowrap", margin: 0 }}>
                {sec.kategorie}
              </h2>
              <div style={{ flex: 1, height: 1, background: COL.border }} />
            </div>
            <div style={{ padding: "8px 16px 0", display: "flex", flexDirection: "column", gap: 16 }}>
              {items.map((item) => (
                <NoirItemCard
                  key={item.id}
                  item={item}
                  onClick={() => onItemClick(item)}
                  cardRef={(el) => onItemCardRef?.(item, el)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function NoirItemCard({
  item,
  onClick,
  cardRef,
}: {
  item: MenuItem;
  onClick: () => void;
  cardRef: (el: HTMLElement | null) => void;
}) {
  const soldOut = item.sold_out === true;
  const hasImage = Boolean(item.bild_url);
  const tags = (item.tags ?? []).map((t) => t.trim().toLowerCase());
  const isVegan = tags.includes("vegan");
  const isVeg = tags.includes("vegetarisch") || tags.includes("veg") || tags.includes("vegetarian");

  return (
    <button
      type="button"
      ref={cardRef as (el: HTMLButtonElement | null) => void}
      onClick={onClick}
      className="noir-item"
      style={{
        background: COL.card,
        border: `1px solid ${COL.border}`,
        borderRadius: 14,
        overflow: "hidden",
        cursor: "pointer",
        transition: "transform 0.2s, border-color 0.2s",
        opacity: soldOut ? 0.5 : 1,
        textAlign: "left",
        padding: 0,
        width: "100%",
        color: "inherit",
        fontFamily: "inherit",
      }}
    >
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.bild_url as string}
          alt={item.name}
          style={{
            width: "100%",
            height: 200,
            objectFit: "cover",
            display: "block",
            borderBottom: "1px solid rgba(201,168,76,0.1)",
            filter: soldOut ? "grayscale(1)" : undefined,
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: 200,
            background: "linear-gradient(135deg, rgba(201,168,76,0.08), rgba(255,248,235,0.03))",
            borderBottom: "1px solid rgba(201,168,76,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 56,
            opacity: 0.8,
          }}
          aria-hidden
        >
          {item.emoji || "🍽"}
        </div>
      )}
      <div style={{ padding: "16px 18px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 6 }}>
          <div
            style={{
              fontFamily: SERIF,
              fontSize: 20,
              fontWeight: 400,
              color: COL.creamFull,
              letterSpacing: "0.01em",
              lineHeight: 1.25,
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
                  color: "#e08070",
                  background: "rgba(200,64,48,0.12)",
                  border: "1px solid rgba(200,64,48,0.3)",
                  textDecoration: "none",
                }}
              >
                Ausverkauft
              </span>
            ) : null}
          </div>
          <div
            style={{
              fontFamily: SERIF,
              fontSize: 19,
              fontWeight: 600,
              color: COL.gold,
              whiteSpace: "nowrap",
              flexShrink: 0,
              textDecoration: soldOut ? "line-through" : undefined,
            }}
          >
            {getDisplayPrice(item)}
          </div>
        </div>
        {item.beschreibung ? (
          <p style={{ fontSize: 12, color: COL.muted, lineHeight: 1.55, fontWeight: 300, marginBottom: 8 }}>
            {item.beschreibung}
          </p>
        ) : null}
        {item.allergens_text && item.allergens_text.trim() ? (
          <p style={{ fontSize: 10, color: "rgba(201,168,76,0.45)", fontStyle: "italic", marginBottom: 6 }}>
            {item.allergens_text}
          </p>
        ) : null}
        {(isVegan || isVeg) ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {isVegan ? (
              <span
                style={{
                  fontSize: 9,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  padding: "3px 8px",
                  borderRadius: 3,
                  border: "1px solid rgba(134,199,104,0.3)",
                  color: "rgba(134,199,104,0.8)",
                }}
              >
                Vegan
              </span>
            ) : null}
            {isVeg && !isVegan ? (
              <span
                style={{
                  fontSize: 9,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  padding: "3px 8px",
                  borderRadius: 3,
                  border: "1px solid rgba(134,199,104,0.2)",
                  color: "rgba(134,199,104,0.6)",
                }}
              >
                Vegetarisch
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </button>
  );
}
