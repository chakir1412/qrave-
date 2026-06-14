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
import { deriveCategoryTabsFromItems, buildSectionsForCategoryTab, categoryTabLabel, CATEGORY_TAB_ALLE_KEY } from "@/components/speisekarte/menu-layout";
import { activeLunchOffers } from "@/lib/lunch";
import { useSpeisekarteTier1Tracking } from "@/components/speisekarte/useSpeisekarteTier1Tracking";
import { type FilterKey, IMG_BLUR_DATA_URL } from "@/components/speisekarte/constants";
import { getDisplayPrice } from "@/components/speisekarte/utils";
import HeritageItemModal from "@/components/templates/Heritage/HeritageItemModal";
import { resolveBackground, type BackgroundMode } from "@/lib/template-background";

const COL_DEFAULT = { bg: "#ffe5f0", white: "#fff", text: "#1a0a12", muted: "rgba(26,10,18,0.5)", border: "rgba(26,10,18,0.1)", accent: "#ff3d7f", accent2: "#ffb800" };
const DISPLAY = `'Syne', system-ui, sans-serif`;
const LUNCH_TAB_KEY = "__playful_lunch__";
const FILTER_TAG_ALIASES: Record<FilterKey, ReadonlyArray<string>> = {
  all: [], vegan: ["vegan"], veg: ["vegetarisch", "veg", "vegetarian"], gf: ["glutenfrei", "gf"], spicy: ["scharf", "spicy", "hot"],
};

export default function PlayfulTemplate(props: SpeisekarteProps) {
  const { menuItems, restaurantName, dailyPushes = [], restaurantId, tischNummer, sponsoredItems = [], guestNote = null, lunchOffers = [], backgroundMode = null , locale = "de" } = props;
  // Playful ignoriert custom_bg_color/custom_text_color — die Pink-CI ist
  // konstitutiv für das Template.
  const bgTheme = resolveBackground("playful", backgroundMode as BackgroundMode | null, null, null);
  const COL = { ...COL_DEFAULT, bg: bgTheme.bg, text: bgTheme.text, muted: bgTheme.textMuted, card: bgTheme.card };
  const [splashOpen, setSplashOpen] = useState(true);
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
  useMemo(() => { track("view_menu", { restaurantName, hasDailyPush: dailyPushes.length > 0, itemCount: menuItems.length, template: "playful" }); return undefined; }, [track, restaurantName, dailyPushes.length, menuItems.length]);
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
  const splashCategories = derivedTabs;
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
    if (filter !== "all") { const aliases = FILTER_TAG_ALIASES[filter]; list = list.filter((it) => (it.tags ?? []).map((t) => t.trim().toLowerCase()).some((t) => aliases.includes(t))); if (filter === "vegan" || filter === "veg") list = list.filter((it) => (it.main_tab ?? "").toLowerCase() !== "getraenke"); }
    return list;
  }, [filter, activeAllergens]);
  const handleDailyPushClick = useCallback((dpId: string) => {
    const dp = dailyPushes.find((p) => p.id === dpId);
    if (!dp) return;
    const m = menuItems.find((mi) => mi.name.trim().toLowerCase() === dp.item_name.trim().toLowerCase()) ?? menuItems.find((mi) => mi.name.trim().toLowerCase().includes(dp.item_name.trim().toLowerCase()));
    pushModal(m ?? dailyPushToMenuItem(dp));
  }, [dailyPushes, menuItems, pushModal]);

  function openCategory(key: string) {
    setPickedMainTab(key);
    setFilter("all");
    setSplashOpen(false);
    if (key !== LUNCH_TAB_KEY) trackCategoryTabSelect(categoryTabLabel(key));
  }

  const featured = dailyPushes[0] ?? null;

  return (
    <div className="speisekarte-template" style={{ background: bgTheme.bg, color: bgTheme.text, minHeight: "100dvh", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        .play-template { font-family: 'DM Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
        .play-template .play-scrollbar-hide::-webkit-scrollbar { display: none; }
        .play-template .play-scrollbar-hide { scrollbar-width: none; -ms-overflow-style: none; }
        .play-template .play-item { animation: playFadeUp 0.3s ease both; }
        .play-template .play-item:nth-child(1) { animation-delay: 0.04s; }
        .play-template .play-item:nth-child(2) { animation-delay: 0.08s; }
        .play-template .play-item:nth-child(3) { animation-delay: 0.12s; }
        .play-template .play-item:nth-child(4) { animation-delay: 0.16s; }
        .play-template .play-item:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0 ${COL.text} !important; }
        .play-template .play-item:active { transform: translate(2px, 2px); box-shadow: 2px 2px 0 ${COL.text} !important; }
        .play-template .play-cat-btn:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0 ${COL.text} !important; }
        .play-template .play-blob { animation: blobmorph 6s ease-in-out infinite; }
        .play-template .play-star { animation: playSpin 8s linear infinite; }
        @keyframes blobmorph { 0%,100% { border-radius: 60% 40% 70% 30% / 50% 60% 40% 50%; } 50% { border-radius: 30% 70% 40% 60% / 60% 40% 70% 30%; } }
        @keyframes playSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes playFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      {!consentGiven && <ConsentBanner locale={locale} onConsent={() => setConsentGiven(true)} />}

      <div className="play-template" style={{ maxWidth: 430, margin: "0 auto", width: "100%", paddingBottom: 100 }}>
        {splashOpen ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100dvh", padding: "40px 24px", textAlign: "center" }}>
            <div className="play-blob" style={{ width: 200, height: 200, background: "rgba(255,61,127,0.15)", marginBottom: -60 }} />
            <div style={{ overflow: "hidden", padding: "0 20px", width: "100%", maxWidth: "100%" }}>
              <h1
                style={{
                  fontFamily: DISPLAY,
                  fontSize: "clamp(1.4rem, 6vw, 2rem)",
                  fontWeight: 800,
                  color: COL.text,
                  letterSpacing: "-0.03em",
                  lineHeight: 1.1,
                  margin: "0 0 8px",
                  position: "relative",
                  wordBreak: "break-word",
                  maxWidth: "100%",
                }}
              >
                {restaurantName}<span style={{ color: COL.accent }}>!</span>
              </h1>
            </div>
            <div style={{ fontSize: 12, color: COL.muted, marginBottom: 48, letterSpacing: "0.1em", textTransform: "uppercase" }}>Speisekarte</div>
            <div className="play-star" style={{ fontSize: 48, marginBottom: 32, display: "inline-block" }} aria-hidden>✳</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 280 }}>
              {splashCategories.map((c, i) => {
                const highlight = i === 0 ? COL.accent : i === 2 ? COL.accent2 : COL.white;
                const textColor = i === 0 ? "#fff" : COL.text;
                return (
                  <button key={c.key} type="button" onClick={() => openCategory(c.key)} className="play-cat-btn" style={{
                    background: highlight, border: "none", borderRadius: 999, padding: "18px 32px",
                    fontFamily: DISPLAY, fontSize: 22, fontWeight: 700, color: textColor, cursor: "pointer",
                    transition: "transform 0.15s, box-shadow 0.15s", boxShadow: `4px 4px 0px ${COL.text}`,
                    textAlign: "center", width: "100%",
                  }}>{c.label}</button>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            <header style={{ background: COL.bg, padding: "20px 20px 16px", display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 10 }}>
              <button type="button" onClick={() => setSplashOpen(true)} style={{ fontSize: 22, cursor: "pointer", border: "none", background: COL.white, borderRadius: 999, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `2px 2px 0 ${COL.text}`, fontWeight: 700 }} aria-label="Zurück">←</button>
              <div style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 800, color: COL.text, letterSpacing: "-0.02em" }}>{activeCategoryLabel}</div>
            </header>

            {/* Kategorie-Tabs (horizontal scroll, aktiver unterstrichen) */}
            <nav
              className="play-scrollbar-hide tab-bar-fade"
              style={{
                display: "flex",
                overflowX: "auto",
                padding: "0 12px",
                background: COL.bg,
                borderBottom: `2px solid ${COL.text}`,
                position: "sticky",
                top: 72,
                zIndex: 9,
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
                      padding: "10px 14px",
                      fontFamily: DISPLAY,
                      fontSize: 13,
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: active ? COL.accent : COL.muted,
                      background: "transparent",
                      border: "none",
                      borderBottomWidth: 3,
                      borderBottomStyle: "solid",
                      borderBottomColor: active ? COL.accent : "transparent",
                      opacity: active ? 1 : 0.85,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      marginBottom: -2,
                    }}
                  >
                    {tab.key === LUNCH_TAB_KEY ? tab.label : tCategory(tab.label, locale)}
                  </button>
                );
              })}
            </nav>

            {visibleFilterKeys.length > 1 ? (
              <div className="play-scrollbar-hide" style={{ display: "flex", gap: 8, padding: "8px 16px 12px", overflowX: "auto" }}>
                {visibleFilterKeys.map((k) => {
                  const active = filter === k;
                  const label = k === "all" ? "Alle" : k === "vegan" ? "Vegan" : k === "veg" ? "Vegetarisch" : "GF";
                  return (<button key={k} type="button" onClick={() => setFilter(k)} style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, padding: "6px 16px", borderRadius: 999, cursor: "pointer", whiteSpace: "nowrap", border: `2px solid ${COL.text}`, background: active ? COL.text : "transparent", color: active ? "#fff" : COL.text }}>{label}</button>);
                })}
              </div>
            ) : null}

            {guestNote && guestNote.trim() ? <div style={{ padding: "0 16px 8px" }}><GuestNoteBanner note={guestNote} /></div> : null}

            {featured ? (
              <button type="button" onClick={() => handleDailyPushClick(featured.id)} style={{ margin: "16px 16px 8px", padding: "16px 20px", background: COL.accent, borderRadius: 20, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", boxShadow: `4px 4px 0 ${COL.text}`, width: "calc(100% - 32px)", textAlign: "left", border: "none", color: "#fff" }}>
                <div>
                  <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)", fontWeight: 600, marginBottom: 3 }}>✦ Tages-Special</div>
                  <div style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 700, color: "#fff" }}>{featured.item_name}</div>
                </div>
                {(() => { const m = menuItems.find((mi) => mi.name.trim().toLowerCase() === featured.item_name.trim().toLowerCase()); return m ? <div style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 800, color: "#fff" }}>{getDisplayPrice(m)}</div> : null; })()}
              </button>
            ) : null}

            <main>
              {effectiveMainTab === LUNCH_TAB_KEY ? (
                <div style={{ padding: "4px 16px" }}><LunchSection offers={lunchOffers} menuItems={menuItems} onItemClick={pushModal} /></div>
              ) : (
                <div style={{ padding: "4px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
                  {sections.map((sec) => {
                    const items = filterItems(sec.items);
                    if (items.length === 0) return null;
                    return (
                      <section key={sec.kategorie} ref={(el) => onCategorySectionRef(sec.kategorie, el)} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {items.map((item, i) => {
                          const soldOut = item.sold_out === true;
                          const hasImg = Boolean(item.bild_url);
                          const tags = (item.tags ?? []).map((t) => t.trim().toLowerCase());
                          const isVegan = tags.includes("vegan");
                          const isSpicy = tags.includes("scharf") || tags.includes("spicy");
                          return (
                            <button key={item.id} type="button" ref={(el) => onItemCardRef?.(item, el as HTMLElement | null)} onClick={() => pushModal(item)} className="play-item" style={{ background: COL.white, borderRadius: 20, padding: 16, display: "flex", gap: 14, alignItems: "center", cursor: "pointer", border: `2px solid ${COL.text}`, boxShadow: `4px 4px 0 ${COL.text}`, transition: "transform 0.15s, box-shadow 0.15s", textAlign: "left", opacity: soldOut ? 0.5 : 1, color: "inherit" }}>
                              <div style={{ width: 72, minWidth: 72, height: 72, borderRadius: 14, background: COL.bg, border: `2px solid ${COL.text}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, flexShrink: 0, overflow: "hidden" }}>
                                {hasImg ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <Image src={item.bild_url as string} alt={item.name} width={72} height={72} priority={i < 4} placeholder="blur" blurDataURL={IMG_BLUR_DATA_URL} sizes="72px" style={{ width: "100%", height: "100%", objectFit: "cover", filter: soldOut ? "grayscale(1)" : undefined }} />
                                ) : (<span aria-hidden>{item.emoji || "🍽"}</span>)}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 700, color: COL.text, marginBottom: 4, lineHeight: 1.2, textDecoration: soldOut ? "line-through" : undefined }}>{item.name}</div>
                                {item.beschreibung ? <div style={{ fontSize: 12, color: COL.muted, lineHeight: 1.45, marginBottom: 8, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.beschreibung}</div> : null}
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                  <div style={{ fontFamily: DISPLAY, fontSize: 14, fontWeight: 800, color: COL.text }}>{getDisplayPrice(item)}</div>
                                  <div style={{ display: "flex", gap: 4 }}>
                                    {isVegan ? <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 999, border: "1.5px solid #2d6a4f", color: "#2d6a4f", background: "rgba(45,106,79,0.08)" }}>Vegan</span> : null}
                                    {isSpicy ? <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 999, border: `1.5px solid ${COL.accent}`, color: COL.accent, background: "rgba(255,61,127,0.08)" }}>Scharf</span> : null}
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

            <footer style={{ padding: "16px 20px", textAlign: "center", marginTop: 24 }}>
              <p style={{ fontSize: 10, color: COL.muted, margin: 0 }}>
                <a href="/impressum" style={{ color: COL.muted, textDecoration: "none" }}>Impressum</a>{" · "}
                <a href="/datenschutz" style={{ color: COL.muted, textDecoration: "none" }}>Datenschutz</a>
              </p>
            </footer>
          </>
        )}
      </div>

      {!splashOpen ? (
        <nav style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: COL.bg, borderTop: `2px solid ${COL.text}`, padding: "10px 0 20px", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)", display: "flex", justifyContent: "space-around", zIndex: 140 }}>
          <button type="button" onClick={() => { if (wishlistOpen) closeWishlist(); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", opacity: !wishlistOpen ? 1 : 0.35, background: "transparent", border: "none" }}>
            <span style={{ fontSize: 20 }} aria-hidden>◈</span>
            <span style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: COL.text, fontWeight: 700 }}>Karte</span>
          </button>
          <button type="button" onClick={openWishlist} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", opacity: wishlistOpen ? 1 : 0.35, background: "transparent", border: "none" }}>
            <span style={{ fontSize: 20 }} aria-hidden>♡</span>
            <span style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: COL.text, fontWeight: 700 }}>Merkliste</span>
            {cartCount > 0 ? (<span style={{ position: "absolute", top: -4, right: 8, minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: COL.accent, color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{cartCount}</span>) : null}
          </button>
        </nav>
      ) : null}

      {modalItem && (<HeritageItemModal item={modalItem} menuItems={menuItems} sponsoredItems={sponsoredItems} restaurantId={restaurantId} onClose={popModal} onSelectItem={pushModal} onAddToWishlist={handleAddToWishlist} isInWishlist={isInWishlist} onToggleWishlist={handleToggleWishlist} theme="playful" />)}
      <Wishlist open={wishlistOpen} onClose={closeWishlist} overlayZIndex={999} cart={entries} onUpdateQty={updateQty} onRemove={handleRemoveFromWishlist} cartTotal={cartTotal} onClear={clearWishlist} restaurantName={restaurantName} locale={locale} />
    </div>
  );
}
