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

const COL = { bg: "#0d0d0f", bg2: "#141417", white: "#f0eee8", text: "#f0eee8", muted: "rgba(240,238,232,0.4)", border: "rgba(240,238,232,0.07)", accent: "#e8282e", accent2: "#ff6b35", gold: "#c9a84c", card: "rgba(255,255,255,0.04)" } as const;
const JP = `'Noto Sans JP', system-ui, sans-serif`;
const LUNCH_TAB_KEY = "__asiandark_lunch__";
const FILTER_TAG_ALIASES: Record<FilterKey, ReadonlyArray<string>> = {
  all: [], vegan: ["vegan"], veg: ["vegetarisch", "veg", "vegetarian"], gf: ["glutenfrei", "gf"], spicy: ["scharf", "spicy", "hot"],
};

export default function AsianDarkTemplate(props: SpeisekarteProps) {
  const { menuItems, restaurantName, dailyPushes = [], restaurantId, tischNummer, sponsoredItems = [], guestNote = null, lunchOffers = [] } = props;
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
  useMemo(() => { track("view_menu", { restaurantName, hasDailyPush: dailyPushes.length > 0, itemCount: menuItems.length, template: "asian-dark" }); return undefined; }, [track, restaurantName, dailyPushes.length, menuItems.length]);
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
    <div className="speisekarte-template" style={{ background: COL.bg, color: COL.text, minHeight: "100vh", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;700&family=Inter:wght@300;400;500;600&display=swap');
        .asian-template { font-family: 'Inter', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
        .asian-template .asian-scrollbar-hide::-webkit-scrollbar { display: none; }
        .asian-template .asian-scrollbar-hide { scrollbar-width: none; -ms-overflow-style: none; }
        .asian-template .asian-item { animation: asianFadeUp 0.35s ease both; }
        .asian-template .asian-item:nth-child(1) { animation-delay: 0.04s; }
        .asian-template .asian-item:nth-child(2) { animation-delay: 0.08s; }
        .asian-template .asian-item:nth-child(3) { animation-delay: 0.12s; }
        .asian-template .asian-item:nth-child(4) { animation-delay: 0.16s; }
        .asian-template .asian-item:hover { background: rgba(255,255,255,0.06); border-color: rgba(232,40,46,0.3) !important; }
        @keyframes asianFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      {!consentGiven && <ConsentBanner onConsent={() => setConsentGiven(true)} />}
      <div aria-hidden style={{ position: "fixed", top: -100, left: "50%", transform: "translateX(-50%)", width: 300, height: 300, background: "radial-gradient(ellipse, rgba(232,40,46,0.12) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <div className="asian-template" style={{ maxWidth: 430, margin: "0 auto", width: "100%", paddingBottom: 90, position: "relative", zIndex: 2 }}>
        <header style={{ padding: "28px 20px 20px", borderBottom: `1px solid ${COL.border}` }}>
          <div style={{ fontFamily: JP, fontSize: 11, letterSpacing: "0.3em", color: COL.accent, marginBottom: 6 }}>QRAVE.MENU</div>
          <h1 style={{ fontFamily: JP, fontSize: 28, fontWeight: 700, color: COL.text, letterSpacing: "0.05em", lineHeight: 1.1, margin: 0 }}>{restaurantName}</h1>
          <div style={{ height: 2, background: `linear-gradient(90deg, ${COL.accent}, transparent)`, marginTop: 16 }} />
        </header>

        <nav className="asian-scrollbar-hide" style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(13,13,15,0.96)", backdropFilter: "blur(16px)", borderBottom: `1px solid ${COL.border}`, display: "flex", overflowX: "auto", padding: "0 20px" }}>
          {mainTabs.map((tab) => {
            const active = effectiveMainTab === tab.key;
            return (
              <button key={tab.key} type="button" onClick={() => { setPickedMainTab(tab.key); setFilter("all"); if (tab.key !== LUNCH_TAB_KEY) trackCategoryTabSelect(categoryTabLabel(tab.key)); }} style={{
                fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase",
                color: active ? COL.accent : COL.muted, padding: "14px 16px", cursor: "pointer",
                borderBottom: `2px solid ${active ? COL.accent : "transparent"}`, marginBottom: -1,
                whiteSpace: "nowrap", background: "transparent", border: "none", borderBottomWidth: 2,
                borderBottomStyle: "solid", borderBottomColor: active ? COL.accent : "transparent", flexShrink: 0,
                transition: "color 0.2s, border-color 0.2s",
              }}>{tab.label}</button>
            );
          })}
        </nav>

        <div className="asian-scrollbar-hide" style={{ display: "flex", gap: 8, padding: "10px 20px", overflowX: "auto" }}>
          {(["all", "vegan", "veg", "gf", "spicy"] as FilterKey[]).map((k) => {
            const active = filter === k;
            const label = k === "all" ? "Alle" : k === "vegan" ? "Vegan" : k === "veg" ? "Veggie" : k === "gf" ? "GF" : "Scharf";
            return (<button key={k} type="button" onClick={() => setFilter(k)} style={{ flexShrink: 0, fontSize: 11, fontWeight: 500, padding: "5px 12px", borderRadius: 999, border: `1px solid ${active ? COL.accent : COL.border}`, background: active ? "rgba(232,40,46,0.1)" : "transparent", color: active ? COL.accent : COL.muted, cursor: "pointer", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</button>);
          })}
          <button type="button" onClick={() => setAllergenOpen(true)} style={{ flexShrink: 0, fontSize: 11, fontWeight: 500, padding: "5px 12px", borderRadius: 999, border: `1px solid ${activeAllergens.size > 0 ? COL.accent : COL.border}`, background: "transparent", color: activeAllergens.size > 0 ? COL.accent : COL.muted, cursor: "pointer", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.08em" }}>{activeAllergens.size > 0 ? `Allergene (${activeAllergens.size})` : "Allergene"}</button>
        </div>

        {guestNote && guestNote.trim() ? <div style={{ padding: "0 16px" }}><GuestNoteBanner note={guestNote} /></div> : null}

        <div style={{ padding: "20px 20px 12px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontFamily: JP, fontSize: 18, fontWeight: 700, color: COL.text, letterSpacing: "0.05em" }}>{activeCategoryLabel}</div>
          <div style={{ flex: 1, height: 1, background: COL.border }} />
        </div>

        {featured ? (
          <button type="button" onClick={() => handleDailyPushClick(featured.id)} style={{ margin: "0 16px 12px", padding: "14px 18px", background: "rgba(232,40,46,0.1)", border: "1px solid rgba(232,40,46,0.3)", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", position: "relative", overflow: "hidden", width: "calc(100% - 32px)", textAlign: "left", color: COL.text }}>
            <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: COL.accent }} />
            <div style={{ paddingLeft: 6 }}>
              <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: COL.accent, fontWeight: 600, marginBottom: 3 }}>✦ Tages-Special</div>
              <div style={{ fontFamily: JP, fontSize: 16, fontWeight: 700, color: COL.text }}>{featured.item_name}</div>
            </div>
            {(() => { const m = menuItems.find((mi) => mi.name.trim().toLowerCase() === featured.item_name.trim().toLowerCase()); return m ? <div style={{ fontSize: 18, fontWeight: 600, color: COL.accent }}>{getDisplayPrice(m)}</div> : null; })()}
          </button>
        ) : null}

        <main>
          {effectiveMainTab === LUNCH_TAB_KEY ? (
            <div style={{ padding: "0 16px" }}><LunchSection offers={lunchOffers} menuItems={menuItems} onItemClick={pushModal} /></div>
          ) : (
            <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              {sections.map((sec) => {
                const items = filterItems(sec.items);
                if (items.length === 0) return null;
                return (
                  <section key={sec.kategorie} ref={(el) => onCategorySectionRef(sec.kategorie, el)} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {items.map((item) => {
                      const soldOut = item.sold_out === true;
                      const hasImg = Boolean(item.bild_url);
                      const tags = (item.tags ?? []).map((t) => t.trim().toLowerCase());
                      const isVegan = tags.includes("vegan");
                      const isSpicy = tags.includes("scharf") || tags.includes("spicy");
                      return (
                        <button key={item.id} type="button" ref={(el) => onItemCardRef?.(item, el as HTMLElement | null)} onClick={() => pushModal(item)} className="asian-item" style={{ background: COL.card, border: `1px solid ${COL.border}`, borderRadius: 12, display: "flex", gap: 14, padding: 14, cursor: "pointer", transition: "background 0.2s, border-color 0.2s", textAlign: "left", opacity: soldOut ? 0.5 : 1, color: "inherit" }}>
                          <div style={{ width: 88, minWidth: 88, height: 88, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: `1px solid ${COL.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, flexShrink: 0, overflow: "hidden" }}>
                            {hasImg ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={item.bild_url as string} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover", filter: soldOut ? "grayscale(1)" : undefined }} />
                            ) : (<span aria-hidden>{item.emoji || "🍜"}</span>)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                            <div>
                              <div style={{ fontFamily: JP, fontSize: 15, fontWeight: 700, color: COL.text, lineHeight: 1.3, textDecoration: soldOut ? "line-through" : undefined }}>{item.name}</div>
                              {item.beschreibung ? <div style={{ fontSize: 11, color: COL.muted, lineHeight: 1.5, marginTop: 4, marginBottom: 8, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.beschreibung}</div> : null}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <div style={{ fontSize: 15, fontWeight: 600, color: COL.gold, textDecoration: soldOut ? "line-through" : undefined }}>{getDisplayPrice(item)}</div>
                              <div style={{ display: "flex", gap: 4 }}>
                                {isVegan ? <span style={{ fontSize: 8, fontWeight: 600, padding: "2px 7px", borderRadius: 3, letterSpacing: "0.08em", textTransform: "uppercase", border: "1px solid rgba(134,199,104,0.3)", color: "rgba(134,199,104,0.9)" }}>Vegan</span> : null}
                                {isSpicy ? <span style={{ fontSize: 8, fontWeight: 600, padding: "2px 7px", borderRadius: 3, letterSpacing: "0.08em", textTransform: "uppercase", border: "1px solid rgba(232,40,46,0.4)", color: COL.accent }}>Scharf</span> : null}
                              </div>
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

        <footer style={{ borderTop: `1px solid ${COL.border}`, padding: "16px 20px", textAlign: "center", marginTop: 24 }}>
          <p style={{ fontSize: 10, color: COL.muted, margin: 0 }}>
            <a href="/impressum" style={{ color: COL.muted, textDecoration: "none" }}>Impressum</a>{" · "}
            <a href="/datenschutz" style={{ color: COL.muted, textDecoration: "none" }}>Datenschutz</a>
          </p>
        </footer>
      </div>

      <nav style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "rgba(13,13,15,0.97)", backdropFilter: "blur(16px)", borderTop: `1px solid ${COL.border}`, padding: "10px 0 20px", display: "flex", justifyContent: "space-around", zIndex: 140 }}>
        <button type="button" onClick={() => { if (wishlistOpen) closeWishlist(); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", opacity: !wishlistOpen ? 1 : 0.35, background: "transparent", border: "none" }}>
          <span style={{ fontSize: 20 }} aria-hidden>◈</span>
          <span style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: COL.accent, fontWeight: 500 }}>Karte</span>
        </button>
        <button type="button" onClick={openWishlist} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", opacity: wishlistOpen ? 1 : 0.35, background: "transparent", border: "none" }}>
          <span style={{ fontSize: 20 }} aria-hidden>♡</span>
          <span style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: wishlistOpen ? COL.accent : COL.muted, fontWeight: 500 }}>Merkliste</span>
          {cartCount > 0 ? (<span style={{ position: "absolute", top: -4, right: 8, minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: COL.accent, color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{cartCount}</span>) : null}
        </button>
      </nav>

      {modalItem && (<HeritageItemModal item={modalItem} menuItems={menuItems} sponsoredItems={sponsoredItems} restaurantId={restaurantId} onClose={popModal} onSelectItem={pushModal} onAddToWishlist={handleAddToWishlist} isInWishlist={isInWishlist} onToggleWishlist={handleToggleWishlist} />)}
      <Wishlist open={wishlistOpen} onClose={closeWishlist} overlayZIndex={999} cart={entries} onUpdateQty={updateQty} onRemove={handleRemoveFromWishlist} cartTotal={cartTotal} onClear={clearWishlist} restaurantName={restaurantName} />
      <AllergenSheet open={allergenOpen} onClose={() => setAllergenOpen(false)} activeAllergens={activeAllergens} onToggleAllergen={toggleAllergen} onApply={() => setAllergenOpen(false)} onClearAll={() => setActiveAllergens(new Set())} />
    </div>
  );
}
