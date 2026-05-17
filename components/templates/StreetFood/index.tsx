"use client";

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
import { deriveCategoryTabsFromItems, buildSectionsForCategoryTab, categoryTabLabel, CATEGORY_TAB_ALLE_KEY } from "@/components/speisekarte/menu-layout";
import { activeLunchOffers } from "@/lib/lunch";
import { useSpeisekarteTier1Tracking } from "@/components/speisekarte/useSpeisekarteTier1Tracking";
import { type FilterKey } from "@/components/speisekarte/constants";
import { getDisplayPrice } from "@/components/speisekarte/utils";
import HeritageItemModal from "@/components/templates/Heritage/HeritageItemModal";
import { resolveBackground, type BackgroundMode } from "@/lib/template-background";

const COL_DEFAULT = { bg: "#111110", bg2: "#1a1a18", white: "#f5f4f0", text: "#f5f4f0", muted: "rgba(245,244,240,0.45)", border: "rgba(245,244,240,0.08)", accent: "#e8b400", accent2: "#ff4422", card: "rgba(255,255,255,0.04)" };
const DISPLAY = `'Bebas Neue', Impact, system-ui, sans-serif`;
const LUNCH_TAB_KEY = "__streetfood_lunch__";
const FILTER_TAG_ALIASES: Record<FilterKey, ReadonlyArray<string>> = {
  all: [], vegan: ["vegan"], veg: ["vegetarisch", "veg", "vegetarian"], gf: ["glutenfrei", "gf"], spicy: ["scharf", "spicy", "hot"],
};

export default function StreetFoodTemplate(props: SpeisekarteProps) {
  const { menuItems, restaurantName, dailyPushes = [], restaurantId, tischNummer, sponsoredItems = [], guestNote = null, lunchOffers = [], backgroundMode = null } = props;
  const bgTheme = resolveBackground("street-food", backgroundMode as BackgroundMode | null);
  const COL = { ...COL_DEFAULT, bg: bgTheme.bg, text: bgTheme.text, muted: bgTheme.textMuted };
  const [pickedMainTab, setPickedMainTab] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [activeAllergens, setActiveAllergens] = useState<Set<string>>(new Set());
  const [allergenOpen, setAllergenOpen] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [modalStack, setModalStack] = useState<MenuItem[]>([]);
  const modalItem = modalStack[modalStack.length - 1] ?? null;
  const pushModal = useCallback((it: MenuItem) => setModalStack((p) => [...p, it]), []);
  const popModal = useCallback(() => setModalStack((p) => p.slice(0, -1)), []);
  const { entries, open: wishlistOpen, itemCount: cartCount, totalPrice: cartTotal, addToWishlist, updateQty, removeFromWishlist, clearWishlist, openWishlist, closeWishlist, isInWishlist } = useWishlist();
  const { track } = useAnalytics();
  useEffect(() => { if (typeof window === "undefined") return; const v = window.localStorage.getItem("qrave_consent"); if (v) setConsentGiven(true); }, []);
  const [hasActiveLunch, setHasActiveLunch] = useState(false);
  useEffect(() => { const u = () => setHasActiveLunch(activeLunchOffers(lunchOffers).length > 0); u(); const t = window.setInterval(u, 60_000); return () => window.clearInterval(t); }, [lunchOffers]);
  useMemo(() => { track("view_menu", { restaurantName, hasDailyPush: dailyPushes.length > 0, itemCount: menuItems.length, template: "street-food" }); return undefined; }, [track, restaurantName, dailyPushes.length, menuItems.length]);
  const derivedTabs = useMemo(() => deriveCategoryTabsFromItems(menuItems), [menuItems]);
  const mainTabs = useMemo(() => hasActiveLunch ? [{ key: LUNCH_TAB_KEY, label: "Mittagsangebot" }, ...derivedTabs] : derivedTabs, [derivedTabs, hasActiveLunch]);
  const mainTab = useMemo(() => (pickedMainTab && mainTabs.some((t) => t.key === pickedMainTab)) ? pickedMainTab : (mainTabs[0]?.key ?? CATEGORY_TAB_ALLE_KEY), [pickedMainTab, mainTabs]);
  const effectiveMainTab = useMemo(() => {
    if (mainTab === LUNCH_TAB_KEY && hasActiveLunch) return LUNCH_TAB_KEY;
    const first = mainTabs[0]?.key ?? CATEGORY_TAB_ALLE_KEY;
    return buildSectionsForCategoryTab(mainTab, menuItems).length > 0 ? mainTab : first;
  }, [mainTab, mainTabs, menuItems, hasActiveLunch]);
  const sections = useMemo(() => effectiveMainTab === LUNCH_TAB_KEY ? [] : buildSectionsForCategoryTab(effectiveMainTab, menuItems), [menuItems, effectiveMainTab]);
  const activeCategoryLabel = useMemo(() => effectiveMainTab === LUNCH_TAB_KEY ? "MITTAGSANGEBOT" : categoryTabLabel(effectiveMainTab).toUpperCase(), [effectiveMainTab]);
  const { onCategorySectionRef, onItemCardRef, trackWishlistAdd, trackWishlistRemove, trackCategoryTabSelect } = useSpeisekarteTier1Tracking({ restaurantId, tischNummer, effectiveMainTab: activeCategoryLabel, filter, modalItem });
  const handleAddToWishlist = useCallback((it: MenuItem, qty?: number) => { addToWishlist(it, qty); try { trackWishlistAdd(it); } catch { /* */ } }, [addToWishlist, trackWishlistAdd]);
  const handleRemoveFromWishlist = useCallback((id: string) => { removeFromWishlist(id); try { trackWishlistRemove(id); } catch { /* */ } }, [removeFromWishlist, trackWishlistRemove]);
  const handleToggleWishlist = useCallback((w: MenuItem) => { if (isInWishlist(w.id)) handleRemoveFromWishlist(w.id); else handleAddToWishlist(w); }, [isInWishlist, handleAddToWishlist, handleRemoveFromWishlist]);
  const toggleAllergen = useCallback((id: string) => setActiveAllergens((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }), []);
  const filterItems = useCallback((items: MenuItem[]) => {
    let list = items;
    if (filter !== "all") { const aliases = FILTER_TAG_ALIASES[filter]; list = list.filter((it) => (it.tags ?? []).map((t) => t.trim().toLowerCase()).some((t) => aliases.includes(t))); }
    if (activeAllergens.size > 0) list = list.filter((it) => !((it.allergen_ids ?? []) as string[]).some((a) => activeAllergens.has(a)));
    return list;
  }, [filter, activeAllergens]);
  const handleDailyPushClick = useCallback((dpId: string) => {
    const dp = dailyPushes.find((p) => p.id === dpId);
    if (!dp) return;
    const m = menuItems.find((mi) => mi.name.trim().toLowerCase() === dp.item_name.trim().toLowerCase()) ?? menuItems.find((mi) => mi.name.trim().toLowerCase().includes(dp.item_name.trim().toLowerCase()));
    pushModal(m ?? dailyPushToMenuItem(dp));
  }, [dailyPushes, menuItems, pushModal]);

  const featured = dailyPushes[0] ?? null;
  const totalItems = sections.reduce((sum, s) => sum + filterItems(s.items).length, 0);

  return (
    <div className="speisekarte-template" style={{ background: bgTheme.bg, color: bgTheme.text, minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;500;600&display=swap');
        .sf-template { font-family: 'Inter', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
        .sf-template .sf-scrollbar-hide::-webkit-scrollbar { display: none; }
        .sf-template .sf-scrollbar-hide { scrollbar-width: none; -ms-overflow-style: none; }
        .sf-template .sf-item { animation: sfFadeUp 0.3s ease both; }
        .sf-template .sf-item:nth-child(1) { animation-delay: 0.04s; }
        .sf-template .sf-item:nth-child(2) { animation-delay: 0.08s; }
        .sf-template .sf-item:nth-child(3) { animation-delay: 0.12s; }
        .sf-template .sf-item:nth-child(4) { animation-delay: 0.16s; }
        .sf-template .sf-item:hover { border-color: rgba(232,180,0,0.3) !important; transform: translateY(-2px); }
        @keyframes sfFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      {!consentGiven && <ConsentBanner onConsent={() => setConsentGiven(true)} />}

      <div className="sf-template" style={{ maxWidth: 430, margin: "0 auto", width: "100%", paddingBottom: 90 }}>
        <header style={{ background: COL.accent, padding: "24px 20px 18px", position: "relative", overflow: "hidden" }}>
          <div aria-hidden style={{ position: "absolute", bottom: -20, right: -20, width: 120, height: 120, background: "rgba(0,0,0,0.1)", borderRadius: "50%" }} />
          <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(0,0,0,0.5)", fontWeight: 600, marginBottom: 2 }}>qrave.menu</div>
          <h1 style={{ fontFamily: DISPLAY, fontSize: 52, color: "#111", lineHeight: 0.9, letterSpacing: "0.02em", margin: 0 }}>{restaurantName.toUpperCase()}</h1>
        </header>

        <nav className="sf-scrollbar-hide" style={{ position: "sticky", top: 0, zIndex: 10, background: COL.bg, borderBottom: `1px solid ${COL.border}`, display: "flex", overflowX: "auto", padding: "0 16px", gap: 0 }}>
          {mainTabs.map((tab) => {
            const active = effectiveMainTab === tab.key;
            return (
              <button key={tab.key} type="button" onClick={() => { setPickedMainTab(tab.key); setFilter("all"); if (tab.key !== LUNCH_TAB_KEY) trackCategoryTabSelect(categoryTabLabel(tab.key)); }} style={{
                fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase",
                color: active ? COL.accent : COL.muted, padding: "14px 14px", cursor: "pointer",
                borderBottom: `2px solid ${active ? COL.accent : "transparent"}`, marginBottom: -1,
                whiteSpace: "nowrap", background: "transparent", border: "none", borderBottomWidth: 2,
                borderBottomStyle: "solid", borderBottomColor: active ? COL.accent : "transparent", flexShrink: 0,
              }}>{tab.label.toUpperCase()}</button>
            );
          })}
        </nav>

        <div className="sf-scrollbar-hide" style={{ display: "flex", gap: 8, padding: "10px 16px", overflowX: "auto" }}>
          {(["all", "vegan", "veg", "gf", "spicy"] as FilterKey[]).map((k) => {
            const active = filter === k;
            const label = k === "all" ? "ALLE" : k === "vegan" ? "VEGAN" : k === "veg" ? "VEGGIE" : k === "gf" ? "GF" : "HOT";
            return (<button key={k} type="button" onClick={() => setFilter(k)} style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 999, border: `1px solid ${active ? COL.accent : COL.border}`, background: active ? "rgba(232,180,0,0.1)" : "transparent", color: active ? COL.accent : COL.muted, cursor: "pointer", whiteSpace: "nowrap", letterSpacing: "0.08em" }}>{label}</button>);
          })}
          <button type="button" onClick={() => setAllergenOpen(true)} style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 999, border: `1px solid ${activeAllergens.size > 0 ? COL.accent2 : COL.border}`, background: "transparent", color: activeAllergens.size > 0 ? COL.accent2 : COL.muted, cursor: "pointer", whiteSpace: "nowrap", letterSpacing: "0.08em" }}>{activeAllergens.size > 0 ? `ALLERGENE (${activeAllergens.size})` : "ALLERGENE"}</button>
        </div>

        {guestNote && guestNote.trim() ? <div style={{ padding: "0 16px" }}><GuestNoteBanner note={guestNote} /></div> : null}

        <div style={{ padding: "20px 16px 10px", display: "flex", alignItems: "baseline", gap: 10 }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 32, color: COL.text, letterSpacing: "0.02em" }}>{activeCategoryLabel}</div>
          {totalItems > 0 ? <div style={{ fontSize: 11, color: COL.muted, fontWeight: 500 }}>{totalItems} Items</div> : null}
        </div>

        {featured ? (
          <button type="button" onClick={() => handleDailyPushClick(featured.id)} style={{ margin: "0 16px 12px", padding: "14px 18px", background: COL.accent2, borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", width: "calc(100% - 32px)", textAlign: "left", border: "none", color: "#fff" }}>
            <div>
              <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)", fontWeight: 600, marginBottom: 2 }}>🔥 Deal des Tages</div>
              <div style={{ fontFamily: DISPLAY, fontSize: 20, color: "#fff", letterSpacing: "0.02em" }}>{featured.item_name.toUpperCase()}</div>
            </div>
            {(() => { const m = menuItems.find((mi) => mi.name.trim().toLowerCase() === featured.item_name.trim().toLowerCase()); return m ? <div style={{ fontFamily: DISPLAY, fontSize: 24, color: "#fff" }}>{getDisplayPrice(m)}</div> : null; })()}
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
                    {items.map((item) => {
                      const soldOut = item.sold_out === true;
                      const hasImg = Boolean(item.bild_url);
                      const tags = (item.tags ?? []).map((t) => t.trim().toLowerCase());
                      const isVegan = tags.includes("vegan");
                      const isSpicy = tags.includes("scharf") || tags.includes("spicy");
                      return (
                        <button key={item.id} type="button" ref={(el) => onItemCardRef?.(item, el as HTMLElement | null)} onClick={() => pushModal(item)} className="sf-item" style={{ background: COL.bg2, borderRadius: 14, overflow: "hidden", cursor: "pointer", border: `1px solid ${COL.border}`, transition: "border-color 0.2s, transform 0.2s", textAlign: "left", padding: 0, opacity: soldOut ? 0.5 : 1, color: "inherit", width: "100%" }}>
                          <div style={{ width: "100%", height: 160, background: "linear-gradient(135deg, #2a2520, #1a1815)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 72, position: "relative", overflow: "hidden" }}>
                            {hasImg ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={item.bild_url as string} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover", filter: soldOut ? "grayscale(1)" : undefined }} />
                            ) : (<span aria-hidden>{item.emoji || "🔥"}</span>)}
                            <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 6 }}>
                              {isSpicy ? <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 999, background: COL.accent2, color: "#fff" }}>🔥 HOT</span> : null}
                              {isVegan ? <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 999, background: "rgba(45,106,79,0.9)", color: "#fff" }}>VEGAN</span> : null}
                            </div>
                          </div>
                          <div style={{ padding: "14px 16px 16px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 5 }}>
                              <div style={{ fontFamily: DISPLAY, fontSize: 22, color: COL.text, letterSpacing: "0.02em", lineHeight: 1, textDecoration: soldOut ? "line-through" : undefined }}>{item.name.toUpperCase()}</div>
                              <div style={{ fontFamily: DISPLAY, fontSize: 22, color: COL.accent, whiteSpace: "nowrap", textDecoration: soldOut ? "line-through" : undefined }}>{getDisplayPrice(item)}</div>
                            </div>
                            {item.beschreibung ? <div style={{ fontSize: 12, color: COL.muted, lineHeight: 1.5 }}>{item.beschreibung}</div> : null}
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

        <footer style={{ borderTop: `1px solid ${COL.border}`, padding: "16px 20px", textAlign: "center", marginTop: 24 }}>
          <p style={{ fontSize: 10, color: COL.muted, margin: 0, letterSpacing: "0.06em" }}>
            <a href="/impressum" style={{ color: COL.muted, textDecoration: "none" }}>Impressum</a>{" · "}
            <a href="/datenschutz" style={{ color: COL.muted, textDecoration: "none" }}>Datenschutz</a>
          </p>
        </footer>
      </div>

      <nav style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: COL.bg, borderTop: `1px solid ${COL.border}`, padding: "10px 0 20px", display: "flex", justifyContent: "space-around", zIndex: 140 }}>
        <button type="button" onClick={() => { if (wishlistOpen) closeWishlist(); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", opacity: !wishlistOpen ? 1 : 0.35, background: "transparent", border: "none" }}>
          <span style={{ fontSize: 20 }} aria-hidden>◈</span>
          <span style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: COL.accent, fontWeight: 600 }}>Karte</span>
        </button>
        <button type="button" onClick={openWishlist} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", opacity: wishlistOpen ? 1 : 0.35, background: "transparent", border: "none" }}>
          <span style={{ fontSize: 20 }} aria-hidden>♡</span>
          <span style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: wishlistOpen ? COL.accent : COL.muted, fontWeight: 600 }}>Merkliste</span>
          {cartCount > 0 ? (<span style={{ position: "absolute", top: -4, right: 8, minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: COL.accent, color: "#111", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{cartCount}</span>) : null}
        </button>
      </nav>

      {modalItem && (<HeritageItemModal item={modalItem} menuItems={menuItems} sponsoredItems={sponsoredItems} restaurantId={restaurantId} onClose={popModal} onSelectItem={pushModal} onAddToWishlist={handleAddToWishlist} isInWishlist={isInWishlist} onToggleWishlist={handleToggleWishlist} theme="dark" />)}
      <Wishlist open={wishlistOpen} onClose={closeWishlist} overlayZIndex={999} cart={entries} onUpdateQty={updateQty} onRemove={handleRemoveFromWishlist} cartTotal={cartTotal} onClear={clearWishlist} restaurantName={restaurantName} />
      <AllergenSheet open={allergenOpen} onClose={() => setAllergenOpen(false)} activeAllergens={activeAllergens} onToggleAllergen={toggleAllergen} onApply={() => setAllergenOpen(false)} onClearAll={() => setActiveAllergens(new Set())} theme="dark" />
    </div>
  );
}
