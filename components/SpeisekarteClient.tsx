"use client";

import Image from "next/image";
import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import type { MenuItem, DailyPush } from "@/lib/supabase";
import { emojiGradient } from "@/lib/emojiGradient";

const MAIN_TAB_KEYS = ["speisen", "cocktails", "bier_wein", "alkoholfrei", "snacks"] as const;
const MAIN_TAB_LABELS: Record<string, string> = {
  speisen: "🍽 Speisen",
  cocktails: "🍹 Cocktails",
  bier_wein: "🍺 Bier & Wein",
  alkoholfrei: "☕ Alkoholfrei",
  snacks: "🧆 Snacks",
  karte: "🍴 Karte",
};

const FILTER_KEYS = ["all", "vegan", "veg", "gf", "spicy"] as const;
const FILTER_LABELS: Record<string, string> = {
  all: "Alle",
  vegan: "🌱 Vegan",
  veg: "🌿 Vegetarisch",
  gf: "🚫 Glutenfrei",
  spicy: "🌶 Scharf",
};

const ALLERGEN_IDS = ["gluten", "milk", "egg", "nuts", "shellfish", "fish", "soy"] as const;
const ALLERGEN_LABELS: Record<string, string> = {
  gluten: "🌾 Gluten",
  milk: "🥛 Milch",
  egg: "🥚 Ei",
  nuts: "🥜 Nüsse",
  shellfish: "🦐 Schalentiere",
  fish: "🐟 Fisch",
  soy: "🫘 Soja",
};

const VOL_LABELS: Record<string, string> = {
  g: "0,2l",
  m: "0,3l",
  l: "0,5l",
  btl: "Fl.",
};

const BADGE_STYLES: Record<string, string> = {
  veg: "bg-[rgba(58,125,82,0.1)] text-[#3a7d52]",
  vegan: "bg-[rgba(45,107,63,0.1)] text-[#2d6b3f]",
  spicy: "bg-[rgba(185,58,58,0.08)] text-[#b93a3a]",
  new: "bg-[rgba(184,150,106,0.12)] text-[#b8966a]",
  sig: "bg-[rgba(184,150,106,0.08)] text-[#b8966a] border border-[rgba(184,150,106,0.2)]",
  gf: "bg-[rgba(100,100,100,0.07)] text-[#9a948a]",
};
const BADGE_LABELS: Record<string, string> = {
  veg: "Veg",
  vegan: "Vegan",
  spicy: "Scharf",
  new: "Neu",
  sig: "★ Sig",
  gf: "GF",
};

const KATEGORIE_EMOJIS: Record<string, string> = {
  Vorspeisen: "🥗",
  Hauptgerichte: "🍽",
  Desserts: "🍰",
  Bier: "🍺",
  Wein: "🍷",
  Cocktails: "🍹",
  Kaffee: "☕",
  Softdrinks: "🥤",
  Snacks: "🧆",
};

type Props = {
  categories: string[];
  menuItems: MenuItem[];
  restaurantName: string;
  highlights?: MenuItem[];
  dailyPush?: DailyPush | null;
};

type FilterKey = (typeof FILTER_KEYS)[number];

function formatPrice(price: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(price);
}

function getItemEmoji(item: MenuItem, kategorie?: string): string {
  if (item.emoji) return item.emoji;
  const cat = kategorie || item.kategorie?.trim() || "";
  return KATEGORIE_EMOJIS[cat] || "🍴";
}

function getDisplayPrice(item: MenuItem): string {
  const pv = item.preis_volumen;
  if (pv && typeof pv === "object") {
    const first = pv["g"] ?? pv["m"] ?? pv["l"] ?? pv["btl"];
    if (typeof first === "string") return first;
  }
  return formatPrice(item.preis);
}

export default function SpeisekarteClient({
  categories,
  menuItems,
  restaurantName,
  highlights = [],
  dailyPush = null,
}: Props) {
  const [lang, setLang] = useState<"de" | "en">("de");
  const [mainTab, setMainTab] = useState<string>(MAIN_TAB_KEYS[0]);
  const [subCategory, setSubCategory] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [activeAllergens, setActiveAllergens] = useState<Set<string>>(new Set());
  const [cart, setCart] = useState<{ item: MenuItem; qty: number }[]>([]);
  const [modalItem, setModalItem] = useState<MenuItem | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [allergenOpen, setAllergenOpen] = useState(false);
  const [dailyPopupOpen, setDailyPopupOpen] = useState(false);
  const dailyPopupShownRef = useRef(false);

  useEffect(() => {
    if (!dailyPush || dailyPopupShownRef.current) return;
    const t = setTimeout(() => {
      dailyPopupShownRef.current = true;
      setDailyPopupOpen(true);
    }, 6000);
    return () => clearTimeout(t);
  }, [dailyPush]);

  useEffect(() => {
    if (dailyPopupOpen) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [dailyPopupOpen]);

  const hasMainTabs = useMemo(() => {
    const withMain = menuItems.some((i) => i.main_tab && i.main_tab.trim() !== "");
    return withMain;
  }, [menuItems]);

  const mainTabs = useMemo(() => {
    if (!hasMainTabs) return [{ key: "karte", label: MAIN_TAB_LABELS.karte }];
    const keys = new Set<string>();
    menuItems.forEach((i) => {
      const t = i.main_tab?.trim();
      if (t && MAIN_TAB_KEYS.includes(t as (typeof MAIN_TAB_KEYS)[number])) keys.add(t);
    });
    const order = MAIN_TAB_KEYS.filter((k) => keys.has(k));
    if (order.length === 0) return [{ key: "karte", label: MAIN_TAB_LABELS.karte }];
    return order.map((k) => ({ key: k, label: MAIN_TAB_LABELS[k] || k }));
  }, [menuItems, hasMainTabs]);

  const sectionsByMain = useMemo(() => {
    const map = new Map<string, { kategorie: string; subtitle: string | null; items: MenuItem[] }[]>();
    for (const item of menuItems) {
      const main = hasMainTabs && item.main_tab ? item.main_tab : "karte";
      const cat = item.kategorie?.trim() || "Sonstiges";
      let list = map.get(main);
      if (!list) {
        list = [];
        map.set(main, list);
      }
      let sec = list.find((s) => s.kategorie === cat);
      if (!sec) {
        sec = { kategorie: cat, subtitle: item.section_subtitle ?? null, items: [] };
        list.push(sec);
      }
      sec.items.push(item);
    }
    map.forEach((list) => list.sort((a, b) => a.kategorie.localeCompare(b.kategorie)));
    return map;
  }, [menuItems, hasMainTabs]);

  const currentSections = useMemo(() => {
    return sectionsByMain.get(mainTab) ?? [];
  }, [sectionsByMain, mainTab]);

  const subCategories = useMemo(() => {
    if (currentSections.length <= 1) return [];
    return currentSections.map((s) => s.kategorie);
  }, [currentSections]);

  const visibleSections = useMemo(() => {
    if (subCategory) return currentSections.filter((s) => s.kategorie === subCategory);
    return currentSections;
  }, [currentSections, subCategory]);

  const addToCart = useCallback((item: MenuItem, qty = 1) => {
    setCart((prev) => {
      const i = prev.findIndex((x) => x.item.id === item.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + qty };
        return next;
      }
      return [...prev, { item, qty }];
    });
  }, []);

  const updateCartQty = useCallback((itemId: string, delta: number) => {
    setCart((prev) => {
      const i = prev.findIndex((x) => x.item.id === itemId);
      if (i < 0) return prev;
      const next = [...prev];
      const newQty = next[i].qty + delta;
      if (newQty <= 0) return next.filter((_, j) => j !== i);
      next[i] = { ...next[i], qty: newQty };
      return next;
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCart((prev) => prev.filter((x) => x.item.id !== itemId));
  }, []);

  const cartCount = cart.reduce((s, x) => s + x.qty, 0);
  const cartTotal = cart.reduce((s, x) => s + x.item.preis * x.qty, 0);

  const alsoOrdered = useMemo(() => {
    if (!modalItem) return [];
    return menuItems
      .filter((i) => i.id !== modalItem.id && i.kategorie !== modalItem.kategorie)
      .slice(0, 4);
  }, [modalItem, menuItems]);

  const toggleAllergen = (id: string) => {
    setActiveAllergens((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filterItems = (items: MenuItem[]) => {
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
  };

  const showHighlightSlider = mainTab === "speisen" && highlights.length > 0 && !subCategory;

  return (
    <div className="min-h-screen text-[#1a1916] speisekarte-template" style={{ backgroundColor: "var(--bg, #fafaf8)" }}>
      {/* ═══ HEADER ═══ */}
      <header className="sticky top-0 z-[100] border-b border-[#e8e4dc] bg-[rgba(250,250,248,0.95)] backdrop-blur-xl">
        <div className="max-w-[880px] mx-auto px-[22px]">
          <div className="flex items-center justify-between py-4 gap-3">
            <div className="font-serif font-light tracking-[0.2em] text-[clamp(1.5rem,5vw,2.4rem)] leading-none text-[#1a1916]">
              {restaurantName}<span className="text-[#b8966a]">·</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLang(lang === "de" ? "en" : "de")}
                className="rounded-full border border-[#e8e4dc] px-2.5 py-1 text-[0.68rem] font-semibold uppercase text-[#9a948a] hover:border-[#b8966a] hover:text-[#b8966a]"
              >
                {lang === "de" ? "DE" : "EN"}
              </button>
              <button
                type="button"
                onClick={() => setCartOpen(true)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.78rem] font-medium transition-all ${
                  cartCount > 0
                    ? "border-[#b8966a] bg-[rgba(184,150,106,0.06)] text-[#b8966a]"
                    : "border-[#e8e4dc] bg-white text-[#1a1916]"
                }`}
              >
                🛒 <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#b8966a] text-[0.62rem] font-bold text-white">{cartCount}</span>
              </button>
            </div>
          </div>

          <nav className="flex overflow-x-auto scrollbar-hide border-b border-[#e8e4dc] -mb-px">
            {mainTabs.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => { setMainTab(key); setSubCategory(null); setFilter("all"); }}
                className={`flex-shrink-0 border-b-2 pb-2.5 pt-2 px-4 text-[0.74rem] font-medium uppercase tracking-wide whitespace-nowrap transition-all ${
                  mainTab === key ? "border-[#b8966a] text-[#b8966a]" : "border-transparent text-[#9a948a]"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          {subCategories.length > 0 && (
            <div className="pt-2 pb-2 flex gap-1.5 overflow-x-auto scrollbar-hide">
              <button
                type="button"
                onClick={() => setSubCategory(null)}
                className={`flex-shrink-0 rounded-full border px-3.5 py-1.5 text-[0.71rem] ${
                  !subCategory ? "bg-[#1a1916] text-[#fafaf8] border-[#1a1916]" : "bg-white border-[#e8e4dc] text-[#9a948a]"
                }`}
              >
                Alle
              </button>
              {subCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSubCategory(cat)}
                  className={`flex-shrink-0 rounded-full border px-3.5 py-1.5 text-[0.71rem] ${
                    subCategory === cat ? "bg-[#1a1916] text-[#fafaf8] border-[#1a1916]" : "bg-white border-[#e8e4dc] text-[#9a948a]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1.5 py-2 border-t border-[#f0ece5]">
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide flex-1">
              {FILTER_KEYS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-[0.68rem] ${
                    filter === f ? "border-[#b8966a] text-[#b8966a] bg-[rgba(184,150,106,0.07)]" : "border-transparent text-[#9a948a]"
                  }`}
                >
                  {FILTER_LABELS[f]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setAllergenOpen(true)}
              className={`flex-shrink-0 flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[0.68rem] font-semibold ${
                activeAllergens.size > 0 ? "bg-[rgba(185,58,58,0.08)] border-[#c84030] text-[#c84030]" : "border-[#e8e4dc] bg-[#f5f4f0] text-[#9a948a]"
              }`}
            >
              ⚠️ {activeAllergens.size > 0 ? `Filter (${activeAllergens.size})` : "Allergene"}
            </button>
          </div>
        </div>
      </header>

      {/* ═══ MAIN ═══ */}
      <main className="max-w-[880px] mx-auto px-[22px] pt-7 pb-28">
        {showHighlightSlider && (
          <section className="mb-9">
            <div className="flex items-center gap-3 text-[0.6rem] uppercase tracking-widest text-[#9a948a] mb-3">
              <span className="h-px flex-1 bg-[#e8e4dc]" /> ✦ EMPFEHLUNGEN ✦ <span className="h-px flex-1 bg-[#e8e4dc]" />
            </div>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide scroll-snap-x snap-mandatory pb-1">
              {highlights.map((h) => {
                const emoji = getItemEmoji(h);
                return (
                  <div
                    key={h.id}
                    className="flex-shrink-0 w-[216px] snap-start rounded-2xl border border-[#e8e4dc] bg-white overflow-hidden cursor-pointer hover:border-[#d4ad7a] hover:shadow-lg transition-all"
                  >
                    <div className="h-[116px] flex items-center justify-center relative" style={{ background: emojiGradient(emoji) }}>
                      <span className="text-[3rem]">{emoji}</span>
                      <span className="absolute top-2 left-2 rounded-full bg-[#b8966a] px-2 py-0.5 text-[0.52rem] font-bold text-white uppercase tracking-wide">Partner</span>
                    </div>
                    <div className="p-3">
                      <div className="text-[0.56rem] uppercase tracking-wider text-[#b8966a] font-semibold mb-0.5">{h.partner_name || "Partner"}</div>
                      <div className="font-serif text-[1.06rem] text-[#1a1916] mb-1">{h.name}</div>
                      <div className="text-[0.68rem] text-[#9a948a] leading-snug mb-2 line-clamp-2">{h.beschreibung}</div>
                      <div className="flex items-center justify-between">
                        <span className="font-serif text-[1rem] text-[#b8966a] font-medium">{getDisplayPrice(h)}</span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); addToCart(h); }}
                          className="text-[0.63rem] font-bold border border-[#e8e4dc] rounded-full px-2.5 py-1 hover:border-[#b8966a] hover:text-[#b8966a]"
                        >
                          + Merken
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {dailyPush && mainTab === "speisen" && (
          <button
            type="button"
            onClick={() => setDailyPopupOpen(true)}
            className="w-full mb-6 flex items-center gap-3 p-4 rounded-2xl border border-[rgba(184,150,106,0.25)] text-left transition-colors hover:border-[#b8966a]"
            style={{ background: "linear-gradient(135deg, rgba(184,150,106,0.1), rgba(212,173,122,0.08))" }}
          >
            <span className="text-[2.2rem]">{dailyPush.item_emoji || "⭐"}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[0.58rem] uppercase tracking-widest text-[#b8966a] font-semibold mb-0.5">Chef empfiehlt heute</div>
              <div className="font-serif text-[1.15rem] font-normal text-[#1a1916]">{dailyPush.item_name}</div>
              {dailyPush.item_desc && <div className="text-[0.7rem] text-[#9a948a] mt-0.5">{dailyPush.item_desc}</div>}
            </div>
          </button>
        )}

        <div className="space-y-11">
          {visibleSections.map((sec) => {
            const filtered = filterItems(sec.items);
            return (
              <section key={sec.kategorie} className="cat-block">
                <div className="flex items-baseline gap-4 pb-2.5 mb-0.5 border-b border-[#e8e4dc]">
                  <h2 className="font-serif font-light text-[clamp(1.4rem,3.5vw,1.9rem)] tracking-tight text-[#1a1916] whitespace-nowrap">
                    {sec.kategorie}
                  </h2>
                  {sec.subtitle && <span className="text-[0.72rem] text-[#9a948a] italic">{sec.subtitle}</span>}
                </div>
                <div className="flex flex-col">
                  {filtered.length === 0 ? (
                    <p className="text-center text-[#9a948a] py-9 text-sm italic">Keine Gerichte für diesen Filter.</p>
                  ) : (
                    filtered.map((item) => {
                      const emoji = getItemEmoji(item, sec.kategorie);
                      const tags = (item.tags ?? []).map((t) => t.toLowerCase());
                      const allergenWarn = activeAllergens.size > 0 && (item.allergen_ids ?? []).some((a) => activeAllergens.has(a as string));
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => !allergenWarn && setModalItem(item)}
                          className={`w-full flex items-center gap-3 py-3.5 text-left border-b border-[#f0ece5] transition-all hover:bg-[rgba(184,150,106,0.04)] -mx-4 px-4 last:border-0 ${item.sponsored ? "bg-[rgba(184,150,106,0.02)]" : ""} ${allergenWarn ? "opacity-30 pointer-events-none" : ""}`}
                        >
                          <div className="flex-shrink-0 w-[68px] h-[68px] rounded-[10px] border border-[#e8e4dc] overflow-hidden flex items-center justify-center" style={{ background: emojiGradient(emoji) }}>
                            {item.bild_url ? (
                              <Image src={item.bild_url} alt={item.name} width={68} height={68} className="w-full h-full object-cover" unoptimized />
                            ) : (
                              <span className="text-[1.75rem]">{emoji}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            {item.sponsored && item.partner_name && (
                              <div className="text-[0.55rem] uppercase tracking-wider text-[rgba(184,150,106,0.7)] font-medium mb-0.5">★ Empfohlen von {item.partner_name}</div>
                            )}
                            <div className="flex items-center flex-wrap gap-1.5 mb-0.5">
                              <span className="font-serif text-[1.06rem] text-[#1a1916]">{item.name}</span>
                              {tags.map((t) => BADGE_LABELS[t] && <span key={t} className={`text-[0.52rem] font-semibold px-1.5 py-0.5 rounded-full uppercase ${BADGE_STYLES[t]}`}>{BADGE_LABELS[t]}</span>)}
                            </div>
                            {item.beschreibung && <p className="text-[0.71rem] text-[#9a948a] italic leading-snug line-clamp-2">{item.beschreibung}</p>}
                          </div>
                          <div className="flex-shrink-0 text-right">
                            {item.preis_volumen && typeof item.preis_volumen === "object" && Object.keys(item.preis_volumen).length > 0 ? (
                              <div className="flex gap-3">
                                {(["g", "m", "l", "btl"] as const).map((k) => (item.preis_volumen as Record<string, string>)[k] && (
                                  <div key={k} className="text-center">
                                    <span className="block text-[0.55rem] text-[#9a948a]">{VOL_LABELS[k]}</span>
                                    <span className="font-serif text-[0.9rem] font-medium text-[#b8966a]">{(item.preis_volumen as Record<string, string>)[k]}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="font-serif text-[1.05rem] font-medium text-[#b8966a]">{getDisplayPrice(item)}</span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>

        <div className="mt-11 p-4 border border-[#e8e4dc] rounded-xl bg-white">
          <div className="text-[0.92rem] font-serif text-[#9a948a] tracking-wide mb-2.5">Legende</div>
          <div className="flex flex-wrap gap-2">
            {["vegan", "veg", "gf", "spicy", "new", "sig"].map((b) => (
              <span key={b} className="text-[0.68rem] text-[#9a948a] flex items-center gap-1">
                <span className={`text-[0.52rem] font-semibold px-1.5 py-0.5 rounded-full uppercase ${BADGE_STYLES[b]}`}>{BADGE_LABELS[b]}</span>
                {b === "vegan" ? "Vegan" : b === "veg" ? "Vegetarisch" : b === "gf" ? "Glutenfrei" : b === "spicy" ? "Scharf" : b === "new" ? "Neuheit" : "Signature"}
              </span>
            ))}
          </div>
        </div>
        <p className="text-[0.66rem] text-[#9a948a] text-center leading-relaxed mt-5 pt-4 border-t border-[#f0ece5]">
          ⚠️ Zu Allergenen und Unverträglichkeiten informiert Sie gerne unser Service-Team.<br />Alle Angaben ohne Gewähr · Preise inkl. MwSt.
        </p>
      </main>

      {/* ═══ MODAL ═══ */}
      {modalItem && (
        <div className="fixed inset-0 z-[500] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-[fadeIn_0.22s_ease] sm:items-center" onClick={() => setModalItem(null)}>
          <div className="w-full max-w-[520px] max-h-[92vh] sm:max-h-[88vh] bg-white rounded-t-3xl sm:rounded-[22px] flex flex-col overflow-hidden animate-[slideUp_0.3s_cubic-bezier(0.32,0.72,0,1)]" onClick={(e) => e.stopPropagation()}>
            <div className="w-full max-h-[280px] min-h-[200px] flex items-center justify-center flex-shrink-0 relative" style={{ background: emojiGradient(getItemEmoji(modalItem)) }}>
              {modalItem.bild_url ? (
                <Image src={modalItem.bild_url} alt={modalItem.name} width={400} height={280} className="w-full h-full object-cover" unoptimized />
              ) : (
                <span className="text-[6rem]">{getItemEmoji(modalItem)}</span>
              )}
              <button type="button" onClick={() => setModalItem(null)} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 text-[#555] flex items-center justify-center shadow-md">✕</button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <h3 className="font-serif text-[1.85rem] font-normal text-[#1a1916] mb-1">{modalItem.name}</h3>
              <p className="font-serif text-[1.3rem] text-[#b8966a] font-medium mb-2">{getDisplayPrice(modalItem)}</p>
              {modalItem.beschreibung && <p className="text-[0.82rem] text-[#9a948a] leading-relaxed pb-4 border-b border-[#f0ece5]">{modalItem.beschreibung}</p>}
              {alsoOrdered.length > 0 && (
                <div className="pt-4">
                  <div className="text-[0.66rem] uppercase tracking-wider text-[#9a948a] font-semibold mb-2 px-1">Dazu passend</div>
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                    {alsoOrdered.slice(0, 4).map((o) => (
                      <div key={o.id} className="flex-shrink-0 w-[126px] rounded-xl border border-[#e8e4dc] bg-[#f5f4f0] overflow-hidden">
                        <div className="h-[84px] flex items-center justify-center" style={{ background: emojiGradient(getItemEmoji(o)) }}>
                          <span className="text-[2rem]">{getItemEmoji(o)}</span>
                        </div>
                        <div className="p-2">
                          <div className="text-[0.73rem] font-semibold text-[#1a1916] leading-tight truncate">{o.name}</div>
                          <div className="text-[0.7rem] text-[#b8966a] font-semibold mb-1">{getDisplayPrice(o)}</div>
                          <button type="button" onClick={() => addToCart(o)} className="w-full py-1 rounded-md border border-[#e8e4dc] text-[0.62rem] font-bold text-[#1a1916] hover:border-[#b8966a] hover:text-[#b8966a]">+ Hinzufügen</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 pt-3 border-t border-[#f0ece5] bg-white">
              <button type="button" onClick={() => { addToCart(modalItem); setModalItem(null); }} className="w-full py-3.5 rounded-xl bg-[#1a1916] text-[#fafaf8] font-bold text-[0.86rem] tracking-wide">
                + Zur Merkliste
              </button>
              <p className="text-[0.62rem] text-[#9a948a] text-center mt-2.5 leading-snug">⚠️ Zu Allergenen informiert Sie gerne unser Service-Team. Alle Angaben ohne Gewähr · Preise inkl. MwSt.</p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ CART DRAWER ═══ */}
      {cartOpen && (
        <div className="fixed inset-0 z-[500] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setCartOpen(false)}>
          <div className="w-full max-w-[480px] max-h-[84vh] bg-white rounded-t-3xl flex flex-col border-t border-[#e8e4dc] animate-[slideUp_0.28s_ease]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#e8e4dc]">
              <h3 className="font-serif text-[1.3rem] font-normal">Meine Liste</h3>
              <button type="button" onClick={() => setCartOpen(false)} className="w-8 h-8 rounded-full bg-[#f5f4f0] border border-[#e8e4dc] flex items-center justify-center text-[#9a948a]">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-[#9a948a]">
                  <div className="text-[2.2rem] mb-2">🛒</div>
                  <div className="text-[0.84rem]">Deine Liste ist leer.</div>
                </div>
              ) : (
                <ul className="space-y-2">
                  {cart.map(({ item, qty }) => (
                    <li key={item.id} className="flex items-center gap-2 py-2 border-b border-[#f0ece5] last:border-0">
                      <span className="text-[1.6rem]">{getItemEmoji(item)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-[0.84rem]">{item.name}</div>
                        <div className="text-[0.73rem] text-[#b8966a]">{getDisplayPrice(item)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => updateCartQty(item.id, -1)} className="w-7 h-7 rounded-full bg-[#f5f4f0] border border-[#e8e4dc] flex items-center justify-center font-semibold text-sm">−</button>
                        <span className="text-[0.82rem] font-semibold min-w-[16px] text-center">{qty}</span>
                        <button type="button" onClick={() => updateCartQty(item.id, 1)} className="w-7 h-7 rounded-full bg-[#f5f4f0] border border-[#e8e4dc] flex items-center justify-center font-semibold text-sm">+</button>
                      </div>
                      <button type="button" onClick={() => removeFromCart(item.id)} className="text-[#9a948a] p-1">🗑</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {cart.length > 0 && (
              <div className="p-4 border-t border-[#e8e4dc]">
                <div className="flex justify-between font-semibold text-[0.9rem] mb-2">
                  <span>Gesamt (ca.)</span>
                  <span className="font-serif text-[1.1rem] text-[#b8966a]">{formatPrice(cartTotal)}</span>
                </div>
                <button type="button" className="w-full py-3 rounded-xl bg-[#1a1916] text-[#fafaf8] font-semibold text-[0.84rem] mb-2">📋 Kellner zeigen</button>
                <button type="button" onClick={() => setCart([])} className="w-full py-2 rounded-xl border border-[#e8e4dc] text-[0.73rem] text-[#9a948a]">Liste leeren</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ DAILY PUSH POPUP ═══ */}
      {dailyPopupOpen && dailyPush && (
        <div
          className="fixed inset-0 z-[700] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center"
          onClick={() => { setDailyPopupOpen(false); document.body.style.overflow = ""; }}
        >
          <div
            className="w-full max-w-[480px] bg-white rounded-t-3xl sm:rounded-[22px] overflow-hidden border-t border-[#e8e4dc] sm:border animate-[slideUp_0.32s_cubic-bezier(0.32,0.72,0,1)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="w-full h-40 flex items-center justify-center relative text-[5rem]"
              style={{ background: emojiGradient(dailyPush.item_emoji || "⭐") }}
            >
              <span>{dailyPush.item_emoji || "⭐"}</span>
              <button
                type="button"
                onClick={() => { setDailyPopupOpen(false); document.body.style.overflow = ""; }}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 text-[#555] flex items-center justify-center shadow-md text-[0.85rem]"
              >
                ✕
              </button>
            </div>
            <div className="p-5 pt-4">
              <div className="text-[0.58rem] uppercase tracking-[0.14em] text-[#b8966a] font-semibold mb-1.5">Chef empfiehlt heute</div>
              <h3 className="font-serif text-[1.7rem] font-normal text-[#1a1916] leading-tight mb-2">{dailyPush.item_name}</h3>
              {dailyPush.item_desc && <p className="text-[0.8rem] text-[#9a948a] leading-relaxed mb-5">{dailyPush.item_desc}</p>}
              <button
                type="button"
                onClick={() => {
                  const match = menuItems.find((i) => i.name.trim() === dailyPush!.item_name.trim());
                  if (match) addToCart(match);
                  setDailyPopupOpen(false);
                  document.body.style.overflow = "";
                }}
                className="w-full py-3.5 rounded-xl bg-[#1a1916] text-[#fafaf8] font-bold text-[0.86rem] tracking-wide"
              >
                + Zur Liste
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ALLERGEN SHEET ═══ */}
      {allergenOpen && (
        <div className="fixed inset-0 z-[600] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setAllergenOpen(false)}>
          <div className="w-full max-w-[480px] bg-white rounded-t-3xl p-5 pb-10 border border-[#e8e4dc] border-b-0 animate-[slideUp_0.28s_ease]" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-serif text-[1.45rem] font-normal mb-0.5">Allergene filtern</h3>
            <p className="text-[0.76rem] text-[#9a948a] mb-4 leading-snug">Gerichte mit diesen Zutaten werden ausgeblendet.</p>
            <div className="flex flex-wrap gap-2 mb-5">
              {ALLERGEN_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleAllergen(id)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.76rem] font-medium transition-all ${
                    activeAllergens.has(id) ? "bg-[rgba(185,58,58,0.08)] border-[#c84030] text-[#c84030] font-semibold" : "bg-[#f5f4f0] border-[#e8e4dc] text-[#1a1916]"
                  }`}
                >
                  {ALLERGEN_LABELS[id]}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setAllergenOpen(false)} className="w-full py-3 rounded-xl bg-[#b8966a] text-white font-bold text-[0.86rem] mb-2">Anwenden</button>
            <button type="button" onClick={() => setActiveAllergens(new Set())} className="w-full py-2 rounded-xl border border-[#e8e4dc] text-[0.76rem] text-[#9a948a]">Alle entfernen</button>
          </div>
        </div>
      )}

      <footer className="text-center py-5 text-[0.68rem] text-[#9a948a] border-t border-[#e8e4dc]">
        <a href="/impressum" className="text-[#9a948a] no-underline hover:text-[#b8966a]">Impressum</a>
        {" · "}
        <a href="/datenschutz" className="text-[#9a948a] no-underline hover:text-[#b8966a]">Datenschutz</a>
      </footer>
    </div>
  );
}
