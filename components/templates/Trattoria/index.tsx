"use client";
import { tCategory } from "@/lib/i18n-menu";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
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
  bg: "#f5ede0",
  white: "#fffaf5",
  text: "#1c1410",
  muted: "#a08060",
  border: "#e8d8c4",
  accent: "#c0392b",
  accentLight: "rgba(192,57,43,0.08)",
  accentSoft: "rgba(192,57,43,0.18)",
};

const SERIF = `'Lora', Georgia, ui-serif, serif`;
const LUNCH_TAB_KEY = "__trattoria_lunch__";

const FILTER_TAG_ALIASES: Record<FilterKey, ReadonlyArray<string>> = {
  all: [],
  vegan: ["vegan"],
  veg: ["vegetarisch", "veg", "vegetarian"],
  gf: ["glutenfrei", "gf", "gluten-free", "glutenfree"],
  spicy: ["scharf", "spicy", "hot"],
};

export default function TrattoriaTemplate(props: SpeisekarteProps) {
  const { menuItems, restaurantName, dailyPushes = [], restaurantId, tischNummer, sponsoredItems = [], guestNote = null, lunchOffers = [], backgroundMode = null, customBgColor = null, customTextColor = null , locale = "de" } = props;
  const bgTheme = resolveBackground("trattoria", backgroundMode as BackgroundMode | null, customBgColor, customTextColor);
  const COL = { ...COL_DEFAULT, bg: bgTheme.bg, text: bgTheme.text, muted: bgTheme.textMuted, card: bgTheme.card, accent: props.accentColor || COL_DEFAULT.accent };
  const [pickedMainTab, setPickedMainTab] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [activeAllergens, setActiveAllergens] = useState<Set<string>>(new Set());
  const [allergenOpen, setAllergenOpen] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [modalStack, setModalStack] = useState<MenuItem[]>([]);
  const modalItem = modalStack[modalStack.length - 1] ?? null;
  const pushModal = useCallback((it: MenuItem) => setModalStack((prev) => [...prev, it]), []);
  const popModal = useCallback(() => setModalStack((prev) => prev.slice(0, -1)), []);

  const { entries, open: wishlistOpen, itemCount: cartCount, totalPrice: cartTotal, addToWishlist, updateQty, removeFromWishlist, clearWishlist, openWishlist, closeWishlist, isInWishlist } = useWishlist();
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
    track("view_menu", { restaurantName, hasDailyPush: dailyPushes.length > 0, itemCount: menuItems.length, template: "trattoria" });
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
  const mainTabs = useMemo(() => hasActiveLunch ? [{ key: LUNCH_TAB_KEY, label: "Mittagsangebot" }, ...derivedTabs] : derivedTabs, [derivedTabs, hasActiveLunch]);
  const mainTab = useMemo(() => (pickedMainTab && mainTabs.some((t) => t.key === pickedMainTab)) ? pickedMainTab : (mainTabs[0]?.key ?? CATEGORY_TAB_ALLE_KEY), [pickedMainTab, mainTabs]);
  const effectiveMainTab = useMemo(() => {
    if (mainTab === LUNCH_TAB_KEY && hasActiveLunch) return LUNCH_TAB_KEY;
    const first = mainTabs[0]?.key ?? CATEGORY_TAB_ALLE_KEY;
    return buildSectionsForCategoryTab(mainTab, menuItems).length > 0 ? mainTab : first;
  }, [mainTab, mainTabs, menuItems, hasActiveLunch]);
  const sections = useMemo(() => effectiveMainTab === LUNCH_TAB_KEY ? [] : buildSectionsForCategoryTab(effectiveMainTab, menuItems), [menuItems, effectiveMainTab]);
  const activeCategoryLabel = useMemo(() => effectiveMainTab === LUNCH_TAB_KEY ? "Mittagsangebot" : categoryTabLabel(effectiveMainTab), [effectiveMainTab]);

  const { onCategorySectionRef, onItemCardRef, trackWishlistAdd, trackWishlistRemove, trackCategoryTabSelect } = useSpeisekarteTier1Tracking({ restaurantId, tischNummer, effectiveMainTab: activeCategoryLabel, filter, modalItem });

  const handleAddToWishlist = useCallback((item: MenuItem, qty?: number) => { addToWishlist(item, qty); try { trackWishlistAdd(item); } catch { /* */ } }, [addToWishlist, trackWishlistAdd]);
  const handleRemoveFromWishlist = useCallback((id: string) => { removeFromWishlist(id); try { trackWishlistRemove(id); } catch { /* */ } }, [removeFromWishlist, trackWishlistRemove]);
  const handleToggleWishlist = useCallback((w: MenuItem) => { if (isInWishlist(w.id)) handleRemoveFromWishlist(w.id); else handleAddToWishlist(w); }, [isInWishlist, handleAddToWishlist, handleRemoveFromWishlist]);
  const toggleAllergen = useCallback((id: string) => setActiveAllergens((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }), []);
  const filterItems = useCallback((items: MenuItem[]) => {
    let list = items;
    if (filter !== "all") {
      const aliases = FILTER_TAG_ALIASES[filter];
      list = list.filter((it) => (it.tags ?? []).map((t) => t.trim().toLowerCase()).some((t) => aliases.includes(t)));
      if (filter === "vegan" || filter === "veg") {
        list = list.filter((it) => (it.main_tab ?? "").toLowerCase() !== "getraenke");
      }
    }
    return list;
  }, [filter, activeAllergens]);

  const handleDailyPushClick = useCallback((dpId: string) => {
    const dp = dailyPushes.find((p) => p.id === dpId);
    if (!dp) return;
    const matched = menuItems.find((m) => m.name.trim().toLowerCase() === dp.item_name.trim().toLowerCase()) ?? menuItems.find((m) => m.name.trim().toLowerCase().includes(dp.item_name.trim().toLowerCase()));
    pushModal(matched ?? dailyPushToMenuItem(dp));
  }, [dailyPushes, menuItems, pushModal]);

  const tabStyle = (active: boolean): CSSProperties => ({
    fontFamily: "inherit", fontSize: 13, fontWeight: 500, color: active ? COL.accent : COL.muted,
    paddingBottom: 12, paddingTop: 0, cursor: "pointer", borderBottom: `2px solid ${active ? COL.accent : "transparent"}`,
    marginBottom: -1, whiteSpace: "nowrap", background: "transparent", border: "none", borderBottomWidth: 2,
    borderBottomStyle: "solid", borderBottomColor: active ? COL.accent : "transparent",
    flexShrink: 0, transition: "color 0.2s, border-color 0.2s",
  });

  const featured = dailyPushes[0] ?? null;

  return (
    <div className="speisekarte-template" style={{ background: bgTheme.bg, color: bgTheme.text, minHeight: "100dvh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=Inter:wght@300;400;500&display=swap');
        .tratt-template { font-family: 'Inter', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
        .tratt-template .tratt-scrollbar-hide::-webkit-scrollbar { display: none; }
        .tratt-template .tratt-scrollbar-hide { scrollbar-width: none; -ms-overflow-style: none; }
        .tratt-template .tratt-item { animation: trattFadeUp 0.35s ease both; }
        .tratt-template .tratt-item:nth-child(1) { animation-delay: 0.04s; }
        .tratt-template .tratt-item:nth-child(2) { animation-delay: 0.08s; }
        .tratt-template .tratt-item:nth-child(3) { animation-delay: 0.12s; }
        .tratt-template .tratt-item:nth-child(4) { animation-delay: 0.16s; }
        .tratt-template .tratt-item:nth-child(5) { animation-delay: 0.20s; }
        .tratt-template .tratt-item:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,0.1) !important; }
        @keyframes trattFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {!consentGiven && <ConsentBanner locale={locale} theme="warm" onConsent={() => setConsentGiven(true)} />}

      <div className="tratt-template" style={{ maxWidth: 430, margin: "0 auto", width: "100%", paddingBottom: 90 }}>
        <header style={{ background: COL.bg, padding: "20px 20px 0" }}>
          <div style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: COL.muted, marginBottom: 4 }}>qrave.menu</div>
          <h1 style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 400, fontStyle: "italic", color: COL.text, lineHeight: 1.1, margin: 0 }}>{restaurantName}</h1>
        </header>

        <div style={{ position: "sticky", top: 0, zIndex: 10, background: COL.bg }}>
          <nav className="tratt-scrollbar-hide tab-bar-fade" style={{ display: "flex", overflowX: "auto", padding: "16px 20px 0", gap: 24, borderBottom: `1px solid ${COL.border}` }}>
            {mainTabs.map((tab) => {
              const active = effectiveMainTab === tab.key;
              return (
                <button key={tab.key} type="button" onClick={(e) => { setPickedMainTab(tab.key); setFilter("all"); if (tab.key !== LUNCH_TAB_KEY) trackCategoryTabSelect(categoryTabLabel(tab.key)); (e.currentTarget as HTMLButtonElement).scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); }} style={tabStyle(active)}>
                  {tab.key === LUNCH_TAB_KEY ? tab.label : tCategory(tab.label, locale)}
                </button>
              );
            })}
          </nav>
          {visibleFilterKeys.length > 1 ? (
            <div className="tratt-scrollbar-hide" style={{ display: "flex", gap: 8, padding: "10px 20px", overflowX: "auto" }}>
              {visibleFilterKeys.map((k) => {
                const active = filter === k;
                const label = k === "all" ? "Alle" : k === "vegan" ? "Vegan" : k === "veg" ? "Vegetarisch" : "Glutenfrei";
                return (
                  <button key={k} type="button" onClick={() => setFilter(k)} style={{
                    flexShrink: 0, fontSize: 11, fontWeight: 500, color: active ? COL.accent : COL.muted,
                    padding: "5px 12px", border: `1px solid ${active ? COL.accent : COL.border}`, borderRadius: 999,
                    background: active ? COL.accentLight : "transparent", cursor: "pointer", whiteSpace: "nowrap",
                  }}>{label}</button>
                );
              })}
            </div>
          ) : null}
        </div>

        {guestNote && guestNote.trim() ? <div style={{ padding: "0 16px", marginTop: 8 }}><GuestNoteBanner note={guestNote} /></div> : null}

        <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, color: COL.text, padding: "20px 20px 12px" }}>{activeCategoryLabel}</div>

        {featured ? (
          <button type="button" onClick={() => handleDailyPushClick(featured.id)} style={{
            margin: "0 16px 12px", padding: "14px 16px", background: "rgba(192,57,43,0.07)",
            border: `1px solid ${COL.accentSoft}`, borderRadius: 12, display: "flex", justifyContent: "space-between",
            alignItems: "center", cursor: "pointer", width: "calc(100% - 32px)", textAlign: "left", color: COL.text,
          }}>
            <div>
              <div style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: COL.accent, fontWeight: 600, marginBottom: 3 }}>✦ Tages-Special</div>
              <div style={{ fontFamily: SERIF, fontSize: 16, fontStyle: "italic" }}>{featured.item_name}</div>
            </div>
            {(() => {
              const m = menuItems.find((mi) => mi.name.trim().toLowerCase() === featured.item_name.trim().toLowerCase());
              return m ? <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600, color: COL.accent }}>{getDisplayPrice(m)}</div> : null;
            })()}
          </button>
        ) : null}

        <main>
          {effectiveMainTab === LUNCH_TAB_KEY ? (
            <div style={{ padding: "0 16px" }}><LunchSection offers={lunchOffers} menuItems={menuItems} onItemClick={pushModal} /></div>
          ) : (
            <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              {sections.map((sec) => {
                const items = filterItems(sec.items);
                if (items.length === 0) return null;
                return (
                  <section key={sec.kategorie} ref={(el) => onCategorySectionRef(sec.kategorie, el)} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {items.map((item, i) => {
                      const soldOut = item.sold_out === true;
                      const hasImg = Boolean(item.bild_url);
                      const tags = (item.tags ?? []).map((t) => t.trim().toLowerCase());
                      const isVeg = tags.includes("vegan") || tags.includes("vegetarisch") || tags.includes("veg");
                      const isSpicy = tags.includes("scharf") || tags.includes("spicy") || tags.includes("hot");
                      return (
                        <button key={item.id} type="button" ref={(el) => onItemCardRef?.(item, el as HTMLElement | null)} onClick={() => pushModal(item)} className="tratt-item" style={{
                          background: COL.white, borderRadius: 14, display: "flex", overflow: "hidden", cursor: "pointer",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.06)", transition: "transform 0.2s, box-shadow 0.2s",
                          border: "none", padding: 0, opacity: soldOut ? 0.5 : 1, textAlign: "left", color: "inherit",
                        }}>
                          <div style={{ width: 72, minWidth: 72, height: 72, background: "linear-gradient(135deg, #f0e4d0, #e8d4b8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, flexShrink: 0, overflow: "hidden" }}>
                            {hasImg ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <Image src={item.bild_url as string} alt={item.name} width={72} height={72} priority={i < 4} placeholder="blur" blurDataURL={IMG_BLUR_DATA_URL} sizes="72px" style={{ width: "100%", height: "100%", objectFit: "cover", filter: soldOut ? "grayscale(1)" : undefined }} />
                            ) : (<span aria-hidden>{item.emoji || "🍝"}</span>)}
                          </div>
                          <div style={{ flex: 1, padding: "12px 14px", display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
                            <div>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                                <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 600, color: COL.text, lineHeight: 1.3, textDecoration: soldOut ? "line-through" : undefined }}>{item.name}</div>
                                {isVeg && !isSpicy ? (
                                  <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", padding: "2px 8px", borderRadius: 999, background: "rgba(45,106,79,0.12)", color: "#2d6a4f", whiteSpace: "nowrap", flexShrink: 0 }}>Veggie</span>
                                ) : null}
                                {isSpicy ? (
                                  <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", padding: "2px 8px", borderRadius: 999, background: COL.accentLight, color: COL.accent, whiteSpace: "nowrap", flexShrink: 0 }}>Scharf</span>
                                ) : null}
                              </div>
                              {item.beschreibung ? <div style={{ fontSize: 11, color: COL.muted, lineHeight: 1.5, marginTop: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.beschreibung}</div> : null}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                              <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 600, color: COL.text, textDecoration: soldOut ? "line-through" : undefined }}>{getDisplayPrice(item)}</div>
                              {soldOut ? (
                                <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 8px", borderRadius: 999, color: "#c84030", background: "rgba(200,64,48,0.1)" }}>Ausverkauft</span>
                              ) : null}
                            </div>
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

        <footer style={{ borderTop: `1px solid ${COL.border}`, padding: "16px 20px", textAlign: "center", background: COL.bg, marginTop: 24 }}>
          <p style={{ fontSize: 10, color: COL.muted, margin: 0, letterSpacing: "0.06em" }}>
            <a href="/impressum" style={{ color: COL.muted, textDecoration: "none" }}>Impressum</a>{" · "}
            <a href="/datenschutz" style={{ color: COL.muted, textDecoration: "none" }}>Datenschutz</a>
          </p>
        </footer>
      </div>

      <BottomNav cartCount={cartCount} wishlistOpen={wishlistOpen} onOpenWishlist={openWishlist} onCloseWishlist={closeWishlist} accent={COL.accent} muted={COL.muted} bg={COL.white} border={COL.border} />

      {modalItem && (() => {
        const modalThemeProps = customBgColor && customTextColor
          ? { theme: "custom" as const, customBg: customBgColor, customText: customTextColor, customAccent: props.accentColor ?? COL.accent }
          : {};
        return <HeritageItemModal item={modalItem} menuItems={menuItems} sponsoredItems={sponsoredItems} restaurantId={restaurantId} onClose={popModal} onSelectItem={pushModal} onAddToWishlist={handleAddToWishlist} isInWishlist={isInWishlist} onToggleWishlist={handleToggleWishlist} {...modalThemeProps} />;
      })()}
      <Wishlist open={wishlistOpen} onClose={closeWishlist} overlayZIndex={999} cart={entries} onUpdateQty={updateQty} onRemove={handleRemoveFromWishlist} cartTotal={cartTotal} onClear={clearWishlist} restaurantName={restaurantName} locale={locale} />
    </div>
  );
}

/** Wiederverwendbare Bottom-Nav für die hellen Templates. */
function BottomNav({ cartCount, wishlistOpen, onOpenWishlist, onCloseWishlist, accent, muted, bg, border }: {
  cartCount: number; wishlistOpen: boolean; onOpenWishlist: () => void; onCloseWishlist: () => void;
  accent: string; muted: string; bg: string; border: string;
}) {
  return (
    <nav style={{
      position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430,
      background: bg, borderTop: `1px solid ${border}`, padding: "10px 0 20px", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)", display: "flex", justifyContent: "space-around",
      zIndex: 140, boxShadow: "0 -4px 20px rgba(0,0,0,0.06)",
    }}>
      <button type="button" onClick={() => { if (wishlistOpen) onCloseWishlist(); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", opacity: !wishlistOpen ? 1 : 0.35, background: "transparent", border: "none" }}>
        <span style={{ fontSize: 20 }} aria-hidden>◈</span>
        <span style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: accent, fontWeight: 500 }}>Karte</span>
      </button>
      <button type="button" onClick={onOpenWishlist} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", opacity: wishlistOpen ? 1 : 0.35, background: "transparent", border: "none" }}>
        <span style={{ fontSize: 20 }} aria-hidden>♡</span>
        <span style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: wishlistOpen ? accent : muted, fontWeight: 500 }}>Merkliste</span>
        {cartCount > 0 ? (<span style={{ position: "absolute", top: -4, right: 8, minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: accent, color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{cartCount}</span>) : null}
      </button>
    </nav>
  );
}
