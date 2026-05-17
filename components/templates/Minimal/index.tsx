"use client";

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
import { deriveCategoryTabsFromItems, buildSectionsForCategoryTab, categoryTabLabel, CATEGORY_TAB_ALLE_KEY } from "@/components/speisekarte/menu-layout";
import { activeLunchOffers } from "@/lib/lunch";
import { useSpeisekarteTier1Tracking } from "@/components/speisekarte/useSpeisekarteTier1Tracking";
import { type FilterKey } from "@/components/speisekarte/constants";
import { getDisplayPrice } from "@/components/speisekarte/utils";
import HeritageItemModal from "@/components/templates/Heritage/HeritageItemModal";
import { resolveBackground, type BackgroundMode } from "@/lib/template-background";

const COL = { bg: "#f5f5f5", white: "#fff", text: "#111", muted: "#888", border: "#ebebeb", accent: "#111" } as const;
const LUNCH_TAB_KEY = "__minimal_lunch__";
const FILTER_TAG_ALIASES: Record<FilterKey, ReadonlyArray<string>> = {
  all: [], vegan: ["vegan"], veg: ["vegetarisch", "veg", "vegetarian"], gf: ["glutenfrei", "gf", "gluten-free", "glutenfree"], spicy: ["scharf", "spicy", "hot"],
};

export default function MinimalTemplate(props: SpeisekarteProps) {
  const { menuItems, restaurantName, dailyPushes = [], restaurantId, tischNummer, sponsoredItems = [], guestNote = null, lunchOffers = [], backgroundMode = null } = props;
  const bgTheme = resolveBackground("minimal", backgroundMode as BackgroundMode | null);
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
  useMemo(() => { track("view_menu", { restaurantName, hasDailyPush: dailyPushes.length > 0, itemCount: menuItems.length, template: "minimal" }); return undefined; }, [track, restaurantName, dailyPushes.length, menuItems.length]);
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

  const catPill = (active: boolean): CSSProperties => ({
    flexShrink: 0, fontSize: 13, fontWeight: 500, padding: "6px 16px", borderRadius: 999, cursor: "pointer",
    whiteSpace: "nowrap", transition: "all 0.18s", border: `1px solid ${active ? COL.text : COL.border}`,
    background: active ? COL.text : COL.white, color: active ? "#fff" : COL.muted,
  });
  const featured = dailyPushes[0] ?? null;

  return (
    <div className="speisekarte-template" style={{ background: bgTheme.bg, color: bgTheme.text, minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        .min-template { font-family: 'Inter', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
        .min-template .min-scrollbar-hide::-webkit-scrollbar { display: none; }
        .min-template .min-scrollbar-hide { scrollbar-width: none; -ms-overflow-style: none; }
        .min-template .min-item { animation: minFadeUp 0.3s ease both; }
        .min-template .min-item:nth-child(1) { animation-delay: 0.03s; }
        .min-template .min-item:nth-child(2) { animation-delay: 0.06s; }
        .min-template .min-item:nth-child(3) { animation-delay: 0.09s; }
        .min-template .min-item:nth-child(4) { animation-delay: 0.12s; }
        .min-template .min-item:nth-child(5) { animation-delay: 0.15s; }
        .min-template .min-item:hover { background: #fafafa; }
        @keyframes minFadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      {!consentGiven && <ConsentBanner onConsent={() => setConsentGiven(true)} />}
      <div className="min-template" style={{ maxWidth: 430, margin: "0 auto", width: "100%", paddingBottom: 90, background: COL.white, minHeight: "100vh" }}>
        <header style={{ background: COL.white, padding: "16px 20px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${COL.border}`, position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ width: 22 }} />
          <div style={{ fontSize: 17, fontWeight: 600, color: COL.text, textAlign: "center", flex: 1 }}>{restaurantName}</div>
          <div style={{ width: 22 }} />
        </header>
        <div className="min-scrollbar-hide" style={{ display: "flex", gap: 8, padding: "12px 16px", overflowX: "auto", borderBottom: `1px solid ${COL.border}`, background: COL.white, position: "sticky", top: 57, zIndex: 9 }}>
          {mainTabs.map((tab) => {
            const active = effectiveMainTab === tab.key;
            return (
              <button key={tab.key} type="button" onClick={() => { setPickedMainTab(tab.key); setFilter("all"); if (tab.key !== LUNCH_TAB_KEY) trackCategoryTabSelect(categoryTabLabel(tab.key)); }} style={catPill(active)}>
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="min-scrollbar-hide" style={{ display: "flex", gap: 8, padding: "10px 16px", overflowX: "auto", borderBottom: `1px solid ${COL.border}`, background: COL.white }}>
          {(["all", "vegan", "veg", "gf"] as FilterKey[]).map((k) => {
            const active = filter === k;
            const label = k === "all" ? "Alle" : k === "vegan" ? "Vegan" : k === "veg" ? "Vegetarisch" : "GF";
            return (<button key={k} type="button" onClick={() => setFilter(k)} style={{ flexShrink: 0, fontSize: 11, fontWeight: 500, padding: "4px 12px", borderRadius: 999, border: `1px solid ${active ? COL.text : COL.border}`, background: active ? COL.text : "transparent", color: active ? "#fff" : COL.muted, cursor: "pointer", whiteSpace: "nowrap" }}>{label}</button>);
          })}
          <button type="button" onClick={() => setAllergenOpen(true)} style={{ flexShrink: 0, fontSize: 11, fontWeight: 500, padding: "4px 12px", borderRadius: 999, border: `1px solid ${activeAllergens.size > 0 ? "#c84030" : COL.border}`, background: "transparent", color: activeAllergens.size > 0 ? "#c84030" : COL.muted, cursor: "pointer", whiteSpace: "nowrap" }}>{activeAllergens.size > 0 ? `Allergene (${activeAllergens.size})` : "Allergene"}</button>
        </div>

        {guestNote && guestNote.trim() ? <div style={{ padding: "12px 16px 0" }}><GuestNoteBanner note={guestNote} /></div> : null}
        <div style={{ fontSize: 18, fontWeight: 700, color: COL.text, padding: "20px 16px 8px" }}>{activeCategoryLabel}</div>

        {featured ? (
          <button type="button" onClick={() => handleDailyPushClick(featured.id)} style={{ margin: "0 16px 8px", padding: "12px 16px", background: "#f9f9f9", border: `1px solid ${COL.border}`, borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", width: "calc(100% - 32px)", textAlign: "left", color: COL.text }}>
            <div>
              <div style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: COL.muted, fontWeight: 600, marginBottom: 2 }}>✦ Tages-Special</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: COL.text }}>{featured.item_name}</div>
            </div>
            {(() => { const m = menuItems.find((mi) => mi.name.trim().toLowerCase() === featured.item_name.trim().toLowerCase()); return m ? <div style={{ fontSize: 14, fontWeight: 700, color: COL.text }}>{getDisplayPrice(m)}</div> : null; })()}
          </button>
        ) : null}

        <main>
          {effectiveMainTab === LUNCH_TAB_KEY ? (
            <div style={{ padding: "0 16px" }}><LunchSection offers={lunchOffers} menuItems={menuItems} onItemClick={pushModal} /></div>
          ) : (
            <div>
              {sections.map((sec) => {
                const items = filterItems(sec.items);
                if (items.length === 0) return null;
                return (
                  <section key={sec.kategorie} ref={(el) => onCategorySectionRef(sec.kategorie, el)}>
                    {items.map((item) => {
                      const soldOut = item.sold_out === true;
                      const hasImg = Boolean(item.bild_url);
                      const tags = (item.tags ?? []).map((t) => t.trim().toLowerCase());
                      const isVegan = tags.includes("vegan");
                      const isSpicy = tags.includes("scharf") || tags.includes("spicy") || tags.includes("hot");
                      const isGf = tags.includes("glutenfrei") || tags.includes("gf");
                      return (
                        <button key={item.id} type="button" ref={(el) => onItemCardRef?.(item, el as HTMLElement | null)} onClick={() => pushModal(item)} className="min-item" style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: 16, borderBottom: `1px solid ${COL.border}`, cursor: "pointer", transition: "background 0.15s", width: "100%", background: COL.white, border: "none", borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: COL.border, textAlign: "left", opacity: soldOut ? 0.5 : 1, color: "inherit" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                              <div style={{ fontSize: 15, fontWeight: 600, color: COL.text, lineHeight: 1.3, textDecoration: soldOut ? "line-through" : undefined }}>{item.name}</div>
                              {item.emoji ? <span style={{ fontSize: 14 }} aria-hidden>{item.emoji}</span> : null}
                            </div>
                            {(isVegan || isSpicy || isGf) ? (
                              <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                                {isVegan ? <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 3, background: "rgba(45,106,79,0.1)", color: "#2d6a4f" }}>Vegan</span> : null}
                                {isSpicy ? <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 3, background: "rgba(192,57,43,0.1)", color: "#c0392b" }}>Scharf</span> : null}
                                {isGf ? <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 3, background: "rgba(230,160,50,0.1)", color: "#b07a20" }}>GF</span> : null}
                              </div>
                            ) : null}
                            {item.beschreibung ? <div style={{ fontSize: 12, color: COL.muted, lineHeight: 1.5, marginBottom: 8, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.beschreibung}</div> : null}
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: COL.text, textDecoration: soldOut ? "line-through" : undefined }}>{getDisplayPrice(item)}</div>
                              {soldOut ? <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 3, background: "rgba(200,64,48,0.1)", color: "#c84030" }}>Ausverkauft</span> : null}
                            </div>
                          </div>
                          <div style={{ width: 90, minWidth: 90, height: 90, borderRadius: 10, background: "linear-gradient(135deg, #f0f0f0, #e4e4e4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, flexShrink: 0, overflow: "hidden" }}>
                            {hasImg ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={item.bild_url as string} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover", filter: soldOut ? "grayscale(1)" : undefined }} />
                            ) : (<span aria-hidden>{item.emoji || "🍽"}</span>)}
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

        <footer style={{ padding: "16px 20px", textAlign: "center", background: COL.white, borderTop: `1px solid ${COL.border}` }}>
          <p style={{ fontSize: 10, color: COL.muted, margin: 0, letterSpacing: "0.06em" }}>
            <a href="/impressum" style={{ color: COL.muted, textDecoration: "none" }}>Impressum</a>{" · "}
            <a href="/datenschutz" style={{ color: COL.muted, textDecoration: "none" }}>Datenschutz</a>
          </p>
        </footer>
      </div>

      <nav style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: COL.white, borderTop: `1px solid ${COL.border}`, padding: "10px 0 20px", display: "flex", justifyContent: "space-around", zIndex: 140 }}>
        <button type="button" onClick={() => { if (wishlistOpen) closeWishlist(); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", opacity: !wishlistOpen ? 1 : 0.3, background: "transparent", border: "none" }}>
          <span style={{ fontSize: 20 }} aria-hidden>◈</span>
          <span style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: COL.text, fontWeight: 500 }}>Karte</span>
        </button>
        <button type="button" onClick={openWishlist} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", opacity: wishlistOpen ? 1 : 0.3, background: "transparent", border: "none" }}>
          <span style={{ fontSize: 20 }} aria-hidden>♡</span>
          <span style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: COL.text, fontWeight: 500 }}>Merkliste</span>
          {cartCount > 0 ? (<span style={{ position: "absolute", top: -4, right: 8, minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: COL.text, color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{cartCount}</span>) : null}
        </button>
      </nav>

      {modalItem && (<HeritageItemModal item={modalItem} menuItems={menuItems} sponsoredItems={sponsoredItems} restaurantId={restaurantId} onClose={popModal} onSelectItem={pushModal} onAddToWishlist={handleAddToWishlist} isInWishlist={isInWishlist} onToggleWishlist={handleToggleWishlist} />)}
      <Wishlist open={wishlistOpen} onClose={closeWishlist} overlayZIndex={999} cart={entries} onUpdateQty={updateQty} onRemove={handleRemoveFromWishlist} cartTotal={cartTotal} onClear={clearWishlist} restaurantName={restaurantName} />
      <AllergenSheet open={allergenOpen} onClose={() => setAllergenOpen(false)} activeAllergens={activeAllergens} onToggleAllergen={toggleAllergen} onApply={() => setAllergenOpen(false)} onClearAll={() => setActiveAllergens(new Set())} />
    </div>
  );
}
