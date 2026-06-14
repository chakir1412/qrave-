"use client";
import { tCategory } from "@/lib/i18n-menu";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  bg: "#fdf6f0",
  accent: "#e8836a",
  accent2: "#f4a88a",
  accent3: "#f9d4c5",
  text: "#3d2b1f",
  text2: "#7a5c4e",
  text3: "#b08a7a",
  tagBg: "#fce8df",
  tagText: "#c0603e",
  border: "#f0ddd4",
  card: "#ffffff",
  muted: "#7a5c4e",
};

const DISPLAY = `'Lora', Georgia, ui-serif, serif`;
const BODY = `'Nunito', system-ui, -apple-system, sans-serif`;
const LUNCH_TAB_KEY = "__blossom_lunch__";

const FILTER_TAG_ALIASES: Record<FilterKey, ReadonlyArray<string>> = {
  all: [],
  vegan: ["vegan"],
  veg: ["vegetarisch", "veg", "vegetarian"],
  gf: ["glutenfrei", "gf"],
  spicy: ["scharf", "spicy", "hot"],
};

export default function BlossomTemplate(props: SpeisekarteProps) {
  const {
    menuItems,
    restaurantName,
    logoUrl,
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
  const bgTheme = resolveBackground(
    "blossom",
    backgroundMode as BackgroundMode | null,
    customBgColor,
    customTextColor,
  );
  const accent = props.accentColor || COL_DEFAULT.accent;
  const COL = {
    ...COL_DEFAULT,
    bg: bgTheme.bg,
    text: bgTheme.text,
    muted: bgTheme.textMuted,
    accent,
  };

  const [pickedMainTab, setPickedMainTab] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [activeAllergens, setActiveAllergens] = useState<Set<string>>(new Set());
  const [allergenOpen, setAllergenOpen] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [modalStack, setModalStack] = useState<MenuItem[]>([]);
  const modalItem = modalStack[modalStack.length - 1] ?? null;
  const pushModal = useCallback((it: MenuItem) => setModalStack((p) => [...p, it]), []);
  const popModal = useCallback(() => setModalStack((p) => p.slice(0, -1)), []);
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
    const u = () => setHasActiveLunch(activeLunchOffers(lunchOffers).length > 0);
    u();
    const t = window.setInterval(u, 60_000);
    return () => window.clearInterval(t);
  }, [lunchOffers]);

  useMemo(() => {
    track("view_menu", {
      restaurantName,
      hasDailyPush: dailyPushes.length > 0,
      itemCount: menuItems.length,
      template: "blossom",
    });
    return undefined;
  }, [track, restaurantName, dailyPushes.length, menuItems.length]);
/** Sichtbare Diät-Filter-Pills: nur die mit mindestens einem matching-Tag. */
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
  const mainTabs = useMemo(
    () =>
      hasActiveLunch
        ? [{ key: LUNCH_TAB_KEY, label: "Mittagsangebot" }, ...derivedTabs]
        : derivedTabs,
    [derivedTabs, hasActiveLunch],
  );
  const mainTab = useMemo(
    () =>
      pickedMainTab && mainTabs.some((t) => t.key === pickedMainTab)
        ? pickedMainTab
        : mainTabs[0]?.key ?? CATEGORY_TAB_ALLE_KEY,
    [pickedMainTab, mainTabs],
  );
  const effectiveMainTab = useMemo(() => {
    if (mainTab === LUNCH_TAB_KEY && hasActiveLunch) return LUNCH_TAB_KEY;
    const first = mainTabs[0]?.key ?? CATEGORY_TAB_ALLE_KEY;
    return buildSectionsForCategoryTab(mainTab, menuItems).length > 0 ? mainTab : first;
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
      effectiveMainTab === LUNCH_TAB_KEY ? "Mittagsangebot" : categoryTabLabel(effectiveMainTab),
    [effectiveMainTab],
  );

  const {
    onCategorySectionRef,
    onItemCardRef,
    trackWishlistAdd,
    trackWishlistRemove,
    trackCategoryTabSelect,
  } = useSpeisekarteTier1Tracking({
    restaurantId,
    tischNummer,
    effectiveMainTab: activeCategoryLabel,
    filter,
    modalItem,
  });

  const handleAddToWishlist = useCallback(
    (it: MenuItem, qty?: number) => {
      addToWishlist(it, qty);
      try {
        trackWishlistAdd(it);
      } catch {
        /* tracking-Fehler nicht eskalieren */
      }
    },
    [addToWishlist, trackWishlistAdd],
  );
  const handleRemoveFromWishlist = useCallback(
    (id: string) => {
      removeFromWishlist(id);
      try {
        trackWishlistRemove(id);
      } catch {
        /* tracking-Fehler nicht eskalieren */
      }
    },
    [removeFromWishlist, trackWishlistRemove],
  );
  const handleToggleWishlist = useCallback(
    (w: MenuItem) => {
      if (isInWishlist(w.id)) handleRemoveFromWishlist(w.id);
      else handleAddToWishlist(w);
    },
    [isInWishlist, handleAddToWishlist, handleRemoveFromWishlist],
  );

  const toggleAllergen = useCallback(
    (id: string) =>
      setActiveAllergens((p) => {
        const n = new Set(p);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      }),
    [],
  );

  const filterItems = useCallback(
    (items: MenuItem[]) => {
      let list = items;
      if (filter !== "all") {
        const aliases = FILTER_TAG_ALIASES[filter];
        list = list.filter((it) =>
          (it.tags ?? [])
            .map((t) => t.trim().toLowerCase())
            .some((t) => aliases.includes(t)),
        );
        if (filter === "vegan" || filter === "veg") {
          list = list.filter((it) => (it.main_tab ?? "").toLowerCase() !== "getraenke");
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
      const m =
        menuItems.find(
          (mi) => mi.name.trim().toLowerCase() === dp.item_name.trim().toLowerCase(),
        ) ??
        menuItems.find((mi) =>
          mi.name.trim().toLowerCase().includes(dp.item_name.trim().toLowerCase()),
        );
      pushModal(m ?? dailyPushToMenuItem(dp));
    },
    [dailyPushes, menuItems, pushModal],
  );

  const featured = dailyPushes[0] ?? null;

  // Modal-Theme: immer "custom" mit Blossom-Tokens, damit der Modal die
  // Coral-CI übernimmt — auch ohne Wirt-Customisierung.
  const modalCustomBg = customBgColor || COL.card;
  const modalCustomText = customTextColor || COL.text;
  const modalCustomAccent = accent;

  return (
    <div
      className="speisekarte-template"
      style={{
        background: bgTheme.bg,
        color: bgTheme.text,
        minHeight: "100dvh",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,500;0,600;1,500;1,600&family=Nunito:wght@400;600;700;800&display=swap');
        .blossom-template { font-family: ${BODY}; -webkit-font-smoothing: antialiased; }
        .blossom-template .blossom-scrollbar-hide::-webkit-scrollbar { display: none; }
        .blossom-template .blossom-scrollbar-hide { scrollbar-width: none; -ms-overflow-style: none; }
        .blossom-template .blossom-item {
          animation: blossomFadeUp 0.35s ease both;
          position: relative;
        }
        .blossom-template .blossom-item:nth-child(1) { animation-delay: 0.04s; }
        .blossom-template .blossom-item:nth-child(2) { animation-delay: 0.08s; }
        .blossom-template .blossom-item:nth-child(3) { animation-delay: 0.12s; }
        .blossom-template .blossom-item:nth-child(4) { animation-delay: 0.16s; }
        .blossom-template .blossom-item::before {
          content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
          background: ${accent}; border-radius: 18px 0 0 18px;
          transform: scaleY(0); transform-origin: center; transition: transform 0.25s ease;
        }
        .blossom-template .blossom-item:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(232,131,106,0.15) !important; }
        .blossom-template .blossom-item:hover::before { transform: scaleY(1); }
        @keyframes blossomFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      {!consentGiven && <ConsentBanner locale={locale} theme="warm" onConsent={() => setConsentGiven(true)} />}

      {/* Fixe Blur-Blobs für Tiefe */}
      <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-10%", left: "-15%", width: 320, height: 320, borderRadius: "50%", background: "#f4c4a8", filter: "blur(90px)", opacity: 0.55 }} />
        <div style={{ position: "absolute", top: "30%", right: "-20%", width: 360, height: 360, borderRadius: "50%", background: "#fbe0c8", filter: "blur(100px)", opacity: 0.5 }} />
        <div style={{ position: "absolute", bottom: "-15%", left: "20%", width: 300, height: 300, borderRadius: "50%", background: "#fad6c0", filter: "blur(90px)", opacity: 0.5 }} />
      </div>

      <div className="blossom-template" style={{ maxWidth: 430, margin: "0 auto", width: "100%", paddingBottom: 100, position: "relative", zIndex: 1 }}>
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            background: `${COL.bg}cc`,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            padding: "16px 20px 14px",
            borderBottom: `1px solid ${COL.border}`,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            aria-hidden
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${COL.accent3}, ${COL.accent2})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              overflow: "hidden",
              boxShadow: "0 4px 12px rgba(232,131,106,0.2)",
            }}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontFamily: DISPLAY, fontStyle: "italic", fontWeight: 600, fontSize: 18, color: "#fff" }}>
                {restaurantName.charAt(0)}
              </span>
            )}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1
              style={{
                fontFamily: DISPLAY,
                fontStyle: "italic",
                fontWeight: 600,
                fontSize: 22,
                color: COL.text,
                lineHeight: 1.15,
                margin: 0,
                letterSpacing: "-0.005em",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {restaurantName}
            </h1>
            <div style={{ fontSize: 11, color: COL.text3, marginTop: 2, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Speisekarte
            </div>
          </div>
        </header>

        <nav
          className="blossom-scrollbar-hide tab-bar-fade"
          style={{
            display: "flex",
            overflowX: "auto",
            padding: "14px 16px 6px",
            gap: 8,
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: COL.bg,
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
                  fontFamily: BODY,
                  fontSize: 13,
                  fontWeight: active ? 700 : 600,
                  padding: "8px 16px",
                  borderRadius: 999,
                  border: active ? "none" : `1px solid ${COL.border}`,
                  background: active ? COL.accent : COL.card,
                  color: active ? "#fff" : COL.text2,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxShadow: active ? "0 4px 12px rgba(232,131,106,0.25)" : "none",
                  transition: "all 0.2s ease",
                }}
              >
                {tab.key === LUNCH_TAB_KEY ? tab.label : tCategory(tab.label, locale)}
              </button>
            );
          })}
        </nav>

        {visibleFilterKeys.length > 1 ? (
          <div
            className="blossom-scrollbar-hide"
            style={{ display: "flex", gap: 8, padding: "4px 16px 12px", overflowX: "auto" }}
          >
            {visibleFilterKeys.map((k) => {
              const active = filter === k;
              const label =
                k === "all" ? "Alle" : k === "vegan" ? "Vegan" : k === "veg" ? "Vegetarisch" : "GF";
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilter(k)}
                  style={{
                    flexShrink: 0,
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "5px 12px",
                    borderRadius: 999,
                    border: `1px solid ${active ? COL.accent : COL.border}`,
                    background: active ? COL.tagBg : "transparent",
                    color: active ? COL.tagText : COL.text3,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        ) : null}

        {guestNote && guestNote.trim() ? (
          <div style={{ padding: "0 16px" }}>
            <GuestNoteBanner note={guestNote} />
          </div>
        ) : null}

        {featured ? (
          <button
            type="button"
            onClick={() => handleDailyPushClick(featured.id)}
            style={{
              margin: "8px 16px 14px",
              padding: "16px 18px",
              background: `linear-gradient(135deg, #fff3ee, #fde8dc)`,
              border: `1px solid ${COL.accent3}`,
              borderRadius: 18,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 6,
              cursor: "pointer",
              width: "calc(100% - 32px)",
              textAlign: "left",
              color: COL.text,
              boxShadow: "0 4px 16px rgba(232,131,106,0.1)",
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                padding: "4px 10px",
                borderRadius: 999,
                background: COL.accent,
                color: "#fff",
              }}
            >
              ✨ Heute besonders
            </span>
            <div
              style={{
                fontFamily: DISPLAY,
                fontStyle: "italic",
                fontWeight: 600,
                fontSize: 20,
                color: COL.text,
                lineHeight: 1.2,
              }}
            >
              {featured.item_name}
            </div>
            {(() => {
              const m = menuItems.find(
                (mi) => mi.name.trim().toLowerCase() === featured.item_name.trim().toLowerCase(),
              );
              return m ? (
                <div style={{ fontSize: 16, fontWeight: 800, color: COL.accent }}>
                  {getDisplayPrice(m)}
                </div>
              ) : null;
            })()}
          </button>
        ) : null}

        <main>
          {effectiveMainTab === LUNCH_TAB_KEY ? (
            <div style={{ padding: "0 16px" }}>
              <LunchSection offers={lunchOffers} menuItems={menuItems} onItemClick={pushModal} />
            </div>
          ) : (
            <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              {sections.map((sec, secIdx) => {
                const items = filterItems(sec.items);
                if (items.length === 0) return null;
                return (
                  <section
                    key={sec.kategorie}
                    ref={(el) => onCategorySectionRef(sec.kategorie, el)}
                    style={{ display: "flex", flexDirection: "column", gap: 10 }}
                  >
                    {secIdx > 0 ? (
                      <div
                        aria-hidden
                        style={{
                          textAlign: "center",
                          color: COL.accent3,
                          fontSize: 14,
                          letterSpacing: 8,
                          padding: "10px 0 4px",
                        }}
                      >
                        ✿ ✾ ✿
                      </div>
                    ) : null}

                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0 6px" }}>
                      <div
                        style={{
                          fontFamily: DISPLAY,
                          fontStyle: "italic",
                          fontWeight: 600,
                          fontSize: 22,
                          color: COL.text,
                          letterSpacing: "-0.005em",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {tCategory(sec.kategorie, locale)}
                      </div>
                      <div
                        aria-hidden
                        style={{
                          flex: 1,
                          height: 1,
                          background: `linear-gradient(90deg, ${COL.border}, transparent)`,
                        }}
                      />
                    </div>

                    {items.map((item, i) => {
                      const soldOut = item.sold_out === true;
                      const hasImg = Boolean(item.bild_url);
                      const tags = (item.tags ?? []).map((t) => t.trim().toLowerCase());
                      const isVegan = tags.includes("vegan");
                      const isVeg = tags.includes("vegetarisch") || tags.includes("veg");
                      const isGf = tags.includes("glutenfrei") || tags.includes("gf");
                      const isSpicy = tags.includes("scharf") || tags.includes("spicy");
                      const inWishlist = isInWishlist(item.id);

                      return (
                        <button
                          key={item.id}
                          type="button"
                          ref={(el) => onItemCardRef?.(item, el as HTMLElement | null)}
                          onClick={() => pushModal(item)}
                          className="blossom-item"
                          style={{
                            background: COL.card,
                            borderRadius: 18,
                            overflow: "hidden",
                            cursor: "pointer",
                            boxShadow: "0 2px 8px rgba(61,43,31,0.06)",
                            transition: "transform 0.2s, box-shadow 0.2s",
                            border: `1px solid ${COL.border}`,
                            textAlign: "left",
                            padding: 0,
                            opacity: soldOut ? 0.5 : 1,
                            color: "inherit",
                            width: "100%",
                            display: "flex",
                            flexDirection: hasImg ? "column" : "row",
                          }}
                        >
                          {hasImg ? (
                            <div
                              style={{
                                width: "100%",
                                height: 170,
                                position: "relative",
                                overflow: "hidden",
                                background: COL.accent3,
                              }}
                            >
                              <Image
                                src={item.bild_url as string}
                                alt={item.name}
                                fill
                                priority={i < 4}
                                placeholder="blur"
                                blurDataURL={IMG_BLUR_DATA_URL}
                                sizes="(max-width: 430px) 100vw, 430px"
                                style={{
                                  objectFit: "cover",
                                  filter: soldOut ? "grayscale(1)" : undefined,
                                }}
                              />
                              <button
                                type="button"
                                aria-label={inWishlist ? "Aus Merkliste entfernen" : "Zur Merkliste"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleWishlist(item);
                                }}
                                style={{
                                  position: "absolute",
                                  top: 10,
                                  right: 10,
                                  width: 36,
                                  height: 36,
                                  borderRadius: "50%",
                                  background: `${COL.accent3}d9`,
                                  backdropFilter: "blur(6px)",
                                  WebkitBackdropFilter: "blur(6px)",
                                  border: "none",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  cursor: "pointer",
                                  color: COL.accent,
                                }}
                              >
                                <i className={`fa-${inWishlist ? "solid" : "regular"} fa-heart`} style={{ fontSize: 14 }} />
                              </button>
                              {soldOut ? (
                                <span
                                  style={{
                                    position: "absolute",
                                    bottom: 10,
                                    left: 10,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: "4px 10px",
                                    borderRadius: 999,
                                    background: "rgba(0,0,0,0.7)",
                                    color: "#fff",
                                    letterSpacing: "0.05em",
                                  }}
                                >
                                  Ausverkauft
                                </span>
                              ) : null}
                            </div>
                          ) : null}

                          <div
                            style={{
                              padding: hasImg ? "14px 16px 16px" : "14px 16px",
                              flex: hasImg ? undefined : 1,
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                gap: 10,
                              }}
                            >
                              <div
                                style={{
                                  fontFamily: BODY,
                                  fontSize: 15,
                                  fontWeight: 700,
                                  color: COL.text,
                                  lineHeight: 1.3,
                                  textDecoration: soldOut ? "line-through" : undefined,
                                }}
                              >
                                {item.name}
                              </div>
                              <div
                                style={{
                                  fontSize: 15,
                                  fontWeight: 800,
                                  color: COL.accent,
                                  whiteSpace: "nowrap",
                                  textDecoration: soldOut ? "line-through" : undefined,
                                }}
                              >
                                {getDisplayPrice(item)}
                              </div>
                            </div>
                            {item.beschreibung ? (
                              <div
                                style={{
                                  fontSize: 13,
                                  color: COL.text2,
                                  lineHeight: 1.5,
                                }}
                              >
                                {item.beschreibung}
                              </div>
                            ) : null}
                            {(isVegan || isVeg || isGf || isSpicy || (!hasImg && soldOut)) ? (
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                                {isVegan ? <Tag label="Vegan" bg={COL.tagBg} fg={COL.tagText} /> : null}
                                {!isVegan && isVeg ? <Tag label="Vegetarisch" bg={COL.tagBg} fg={COL.tagText} /> : null}
                                {isGf ? <Tag label="Glutenfrei" bg={COL.tagBg} fg={COL.tagText} /> : null}
                                {isSpicy ? <Tag label="Scharf" bg={COL.tagBg} fg={COL.tagText} /> : null}
                                {!hasImg && soldOut ? (
                                  <Tag label="Ausverkauft" bg="rgba(0,0,0,0.06)" fg={COL.text2} />
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </section>
                );
              })}
            </div>
          )}
        </main>

        <footer
          style={{
            borderTop: `1px solid ${COL.border}`,
            padding: "20px 20px",
            textAlign: "center",
            marginTop: 28,
          }}
        >
          <div aria-hidden style={{ color: COL.accent3, fontSize: 14, letterSpacing: 8, marginBottom: 10 }}>
            ✿ ✾ ✿
          </div>
          <p style={{ fontSize: 10, color: COL.text3, margin: 0, letterSpacing: "0.06em" }}>
            <a href="/impressum" style={{ color: COL.text3, textDecoration: "none" }}>Impressum</a>
            {" · "}
            <a href="/datenschutz" style={{ color: COL.text3, textDecoration: "none" }}>Datenschutz</a>
          </p>
        </footer>
      </div>

      <nav
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 430,
          background: `${COL.bg}e6`,
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderTop: `1px solid ${COL.border}`,
          padding: "10px 0 20px",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)",
          display: "flex",
          justifyContent: "space-around",
          zIndex: 140,
          boxShadow: "0 -4px 20px rgba(61,43,31,0.06)",
        }}
      >
        <BlossomNavBtn
          icon="fa-utensils"
          label="Speisekarte"
          active={!wishlistOpen}
          accent={COL.accent}
          muted={COL.text3}
          onClick={() => {
            if (wishlistOpen) closeWishlist();
          }}
        />
        <BlossomNavBtn
          icon="fa-heart"
          label="Merkliste"
          active={wishlistOpen}
          badge={cartCount}
          accent={COL.accent}
          muted={COL.text3}
          onClick={openWishlist}
        />
      </nav>

      {modalItem ? (
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
          theme="custom"
          customBg={modalCustomBg}
          customText={modalCustomText}
          customAccent={modalCustomAccent}
        />
      ) : null}
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

function Tag({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: "3px 9px",
        borderRadius: 999,
        background: bg,
        color: fg,
        letterSpacing: "0.02em",
      }}
    >
      {label}
    </span>
  );
}

function BlossomNavBtn({
  icon,
  label,
  active,
  accent,
  muted,
  badge,
  onClick,
}: {
  icon: string;
  label: string;
  active: boolean;
  accent: string;
  muted: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        cursor: "pointer",
        background: "transparent",
        border: "none",
        padding: 0,
        color: "inherit",
      }}
    >
      <i
        className={`fa-${active ? "solid" : "regular"} ${icon}`}
        style={{ fontSize: 17, color: active ? accent : muted }}
      />
      <span
        style={{
          fontSize: 10,
          letterSpacing: "0.05em",
          color: active ? accent : muted,
          fontWeight: 700,
        }}
      >
        {label}
      </span>
      {badge && badge > 0 ? (
        <span
          style={{
            position: "absolute",
            top: -4,
            right: 4,
            minWidth: 18,
            height: 18,
            padding: "0 5px",
            borderRadius: 999,
            background: accent,
            color: "#fff",
            fontSize: 10,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}
