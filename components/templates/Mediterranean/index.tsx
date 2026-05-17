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

const COL_DEFAULT = { bg: "#faf6f0", white: "#fff", text: "#2c1a0e", muted: "rgba(44,26,14,0.45)", border: "rgba(44,26,14,0.1)", accent: "#c0580a", accent2: "#5c8a3c", gold: "#c9972a", terracotta: "#d4613a", card: "#fff" };
const LUNCH_TAB_KEY = "__med_lunch__";
const FILTER_TAG_ALIASES: Record<FilterKey, ReadonlyArray<string>> = {
  all: [], vegan: ["vegan"], veg: ["vegetarisch", "veg", "vegetarian"], gf: ["glutenfrei", "gf"], spicy: ["scharf", "spicy", "hot"],
};

export default function MediterraneanTemplate(props: SpeisekarteProps) {
  const { menuItems, restaurantName, dailyPushes = [], restaurantId, tischNummer, sponsoredItems = [], guestNote = null, lunchOffers = [], backgroundMode = null } = props;
  const bgTheme = resolveBackground("mediterranean", backgroundMode as BackgroundMode | null);
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
  useMemo(() => { track("view_menu", { restaurantName, hasDailyPush: dailyPushes.length > 0, itemCount: menuItems.length, template: "mediterranean" }); return undefined; }, [track, restaurantName, dailyPushes.length, menuItems.length]);
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

  return (
    <div className="speisekarte-template" style={{ background: bgTheme.bg, color: bgTheme.text, minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
        .med-template { font-family: 'Inter', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
        .med-template .med-scrollbar-hide::-webkit-scrollbar { display: none; }
        .med-template .med-scrollbar-hide { scrollbar-width: none; -ms-overflow-style: none; }
        .med-template .med-item { animation: medFadeUp 0.35s ease both; }
        .med-template .med-item:nth-child(1) { animation-delay: 0.04s; }
        .med-template .med-item:nth-child(2) { animation-delay: 0.08s; }
        .med-template .med-item:nth-child(3) { animation-delay: 0.12s; }
        .med-template .med-item:nth-child(4) { animation-delay: 0.16s; }
        .med-template .med-item:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(44,26,14,0.1) !important; }
        @keyframes medFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      {!consentGiven && <ConsentBanner theme="warm" onConsent={() => setConsentGiven(true)} />}

      {/* Ornamental top stripe */}
      <div aria-hidden style={{ height: 6, background: `repeating-linear-gradient(90deg, ${COL.terracotta} 0px, ${COL.terracotta} 12px, ${COL.gold} 12px, ${COL.gold} 24px, ${COL.accent2} 24px, ${COL.accent2} 36px, ${COL.gold} 36px, ${COL.gold} 48px)` }} />

      <div className="med-template" style={{ maxWidth: 430, margin: "0 auto", width: "100%", paddingBottom: 90 }}>
        <header style={{ background: COL.bg, padding: "24px 20px 16px", textAlign: "center", borderBottom: `1px solid ${COL.border}` }}>
          <h1 style={{ fontSize: 34, fontWeight: 700, color: COL.text, lineHeight: 1.1, letterSpacing: "0.01em", margin: 0 }}>{restaurantName}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0 0" }}>
            <div style={{ flex: 1, height: 1, background: COL.border }} />
            <span style={{ color: COL.gold, fontSize: 14 }} aria-hidden>✦</span>
            <div style={{ flex: 1, height: 1, background: COL.border }} />
          </div>
        </header>

        <nav className="med-scrollbar-hide tab-bar-fade" style={{ position: "sticky", top: 0, zIndex: 10, background: COL.bg, borderBottom: `1px solid ${COL.border}`, display: "flex", overflowX: "auto", padding: "0 20px", gap: 0 }}>
          {mainTabs.map((tab) => {
            const active = effectiveMainTab === tab.key;
            return (
              <button key={tab.key} type="button" onClick={() => { setPickedMainTab(tab.key); setFilter("all"); if (tab.key !== LUNCH_TAB_KEY) trackCategoryTabSelect(categoryTabLabel(tab.key)); }} style={{
                fontSize: 12, fontWeight: active ? 600 : 500, color: active ? COL.accent : COL.muted,
                padding: "13px 14px", cursor: "pointer", borderBottom: `2px solid ${active ? COL.accent : "transparent"}`,
                marginBottom: -1, whiteSpace: "nowrap", background: "transparent", border: "none", borderBottomWidth: 2,
                borderBottomStyle: "solid", borderBottomColor: active ? COL.accent : "transparent", flexShrink: 0,
                transition: "color 0.2s, border-color 0.2s",
              }}>{tab.label}</button>
            );
          })}
        </nav>

        <div className="med-scrollbar-hide" style={{ display: "flex", gap: 8, padding: "10px 16px", overflowX: "auto" }}>
          {(["all", "vegan", "veg", "gf"] as FilterKey[]).map((k) => {
            const active = filter === k;
            const label = k === "all" ? "Alle" : k === "vegan" ? "Vegan" : k === "veg" ? "Vegetarisch" : "GF";
            return (<button key={k} type="button" onClick={() => setFilter(k)} style={{ flexShrink: 0, fontSize: 11, fontWeight: 500, padding: "5px 12px", borderRadius: 999, border: `1px solid ${active ? COL.accent : COL.border}`, background: active ? "rgba(192,88,10,0.08)" : "transparent", color: active ? COL.accent : COL.muted, cursor: "pointer", whiteSpace: "nowrap" }}>{label}</button>);
          })}
          <button type="button" onClick={() => setAllergenOpen(true)} style={{ flexShrink: 0, fontSize: 11, fontWeight: 500, padding: "5px 12px", borderRadius: 999, border: `1px solid ${activeAllergens.size > 0 ? COL.terracotta : COL.border}`, background: "transparent", color: activeAllergens.size > 0 ? COL.terracotta : COL.muted, cursor: "pointer", whiteSpace: "nowrap" }}>{activeAllergens.size > 0 ? `Allergene (${activeAllergens.size})` : "Allergene"}</button>
        </div>

        {guestNote && guestNote.trim() ? <div style={{ padding: "0 16px" }}><GuestNoteBanner note={guestNote} /></div> : null}

        {featured ? (
          <button type="button" onClick={() => handleDailyPushClick(featured.id)} style={{ margin: "14px 16px 10px", padding: "14px 18px", background: "linear-gradient(135deg, rgba(192,88,10,0.08), rgba(201,151,42,0.08))", border: "1px solid rgba(192,88,10,0.2)", borderRadius: 14, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", width: "calc(100% - 32px)", textAlign: "left", color: COL.text }}>
            <div>
              <div style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: COL.accent, fontWeight: 600, marginBottom: 3 }}>✦ Tages-Special</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{featured.item_name}</div>
            </div>
            {(() => { const m = menuItems.find((mi) => mi.name.trim().toLowerCase() === featured.item_name.trim().toLowerCase()); return m ? <div style={{ fontSize: 18, fontWeight: 700, color: COL.accent }}>{getDisplayPrice(m)}</div> : null; })()}
          </button>
        ) : null}

        <div style={{ padding: "16px 16px 10px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: COL.text, letterSpacing: "0.02em" }}>{activeCategoryLabel}</div>
          <div style={{ flex: 1, height: 1, background: COL.border }} />
        </div>

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
                      const isHalal = tags.includes("halal");
                      return (
                        <button key={item.id} type="button" ref={(el) => onItemCardRef?.(item, el as HTMLElement | null)} onClick={() => pushModal(item)} className="med-item" style={{ background: COL.card, borderRadius: 16, overflow: "hidden", cursor: "pointer", boxShadow: "0 2px 10px rgba(44,26,14,0.07)", transition: "transform 0.2s, box-shadow 0.2s", border: "1px solid rgba(44,26,14,0.06)", textAlign: "left", padding: 0, opacity: soldOut ? 0.5 : 1, color: "inherit", width: "100%" }}>
                          <div style={{ width: "100%", height: 170, background: "linear-gradient(135deg, #f0e6d8, #e8d8c4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 72, position: "relative", overflow: "hidden" }}>
                            {hasImg ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={item.bild_url as string} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover", filter: soldOut ? "grayscale(1)" : undefined }} />
                            ) : (<span aria-hidden>{item.emoji || "🍽"}</span>)}
                            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60, background: `linear-gradient(transparent, ${COL.card})`, pointerEvents: "none" }} />
                          </div>
                          <div style={{ padding: "12px 16px 16px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 5 }}>
                              <div style={{ fontSize: 16, fontWeight: 600, color: COL.text, lineHeight: 1.3, textDecoration: soldOut ? "line-through" : undefined }}>{item.name}</div>
                              <div style={{ fontSize: 16, fontWeight: 700, color: COL.accent, whiteSpace: "nowrap", textDecoration: soldOut ? "line-through" : undefined }}>{getDisplayPrice(item)}</div>
                            </div>
                            {item.beschreibung ? <div style={{ fontSize: 12, color: COL.muted, lineHeight: 1.55, marginBottom: 10 }}>{item.beschreibung}</div> : null}
                            {(isVegan || isSpicy || isHalal) ? (
                              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                                {isVegan ? <span style={{ fontSize: 9, fontWeight: 600, padding: "3px 8px", borderRadius: 5, border: "1px solid rgba(92,138,60,0.3)", color: COL.accent2, background: "rgba(92,138,60,0.08)" }}>Vegan</span> : null}
                                {isHalal ? <span style={{ fontSize: 9, fontWeight: 600, padding: "3px 8px", borderRadius: 5, border: "1px solid rgba(201,151,42,0.3)", color: COL.gold, background: "rgba(201,151,42,0.08)" }}>Halal</span> : null}
                                {isSpicy ? <span style={{ fontSize: 9, fontWeight: 600, padding: "3px 8px", borderRadius: 5, border: "1px solid rgba(212,97,58,0.3)", color: COL.terracotta, background: "rgba(212,97,58,0.08)" }}>Scharf</span> : null}
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

        <footer style={{ borderTop: `1px solid ${COL.border}`, padding: "16px 20px", textAlign: "center", background: COL.bg, marginTop: 24 }}>
          <p style={{ fontSize: 10, color: COL.muted, margin: 0, letterSpacing: "0.06em" }}>
            <a href="/impressum" style={{ color: COL.muted, textDecoration: "none" }}>Impressum</a>{" · "}
            <a href="/datenschutz" style={{ color: COL.muted, textDecoration: "none" }}>Datenschutz</a>
          </p>
        </footer>
      </div>

      <nav style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: COL.bg, borderTop: `1px solid ${COL.border}`, padding: "10px 0 20px", display: "flex", justifyContent: "space-around", zIndex: 140, boxShadow: "0 -4px 20px rgba(44,26,14,0.06)" }}>
        <button type="button" onClick={() => { if (wishlistOpen) closeWishlist(); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", opacity: !wishlistOpen ? 1 : 0.35, background: "transparent", border: "none" }}>
          <span style={{ fontSize: 20 }} aria-hidden>◈</span>
          <span style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: COL.accent, fontWeight: 600 }}>Karte</span>
        </button>
        <button type="button" onClick={openWishlist} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", opacity: wishlistOpen ? 1 : 0.35, background: "transparent", border: "none" }}>
          <span style={{ fontSize: 20 }} aria-hidden>♡</span>
          <span style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: wishlistOpen ? COL.accent : COL.muted, fontWeight: 600 }}>Merkliste</span>
          {cartCount > 0 ? (<span style={{ position: "absolute", top: -4, right: 8, minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: COL.accent, color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{cartCount}</span>) : null}
        </button>
      </nav>

      {modalItem && (<HeritageItemModal item={modalItem} menuItems={menuItems} sponsoredItems={sponsoredItems} restaurantId={restaurantId} onClose={popModal} onSelectItem={pushModal} onAddToWishlist={handleAddToWishlist} isInWishlist={isInWishlist} onToggleWishlist={handleToggleWishlist} />)}
      <Wishlist open={wishlistOpen} onClose={closeWishlist} overlayZIndex={999} cart={entries} onUpdateQty={updateQty} onRemove={handleRemoveFromWishlist} cartTotal={cartTotal} onClear={clearWishlist} restaurantName={restaurantName} />
      <AllergenSheet open={allergenOpen} onClose={() => setAllergenOpen(false)} activeAllergens={activeAllergens} onToggleAllergen={toggleAllergen} onApply={() => setAllergenOpen(false)} onClearAll={() => setActiveAllergens(new Set())} />
    </div>
  );
}
