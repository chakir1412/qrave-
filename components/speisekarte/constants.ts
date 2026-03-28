/** Haupt-Tabs aus menu_items.main_tab (Supabase) */
export const MAIN_TAB_KEYS = ["speisen", "getraenke", "snacks"] as const;
export const MAIN_TAB_LABELS: Record<string, string> = {
  speisen: "Speisen",
  getraenke: "Getränke",
  snacks: "Snacks",
  karte: "Karte",
  speisekarte: "Speisekarte",
};

export const FILTER_KEYS = ["all", "vegan", "veg", "gf", "spicy"] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

export const FILTER_LABELS: Record<string, string> = {
  all: "Alle",
  vegan: "🌱 Vegan",
  veg: "🌿 Vegetarisch",
  gf: "🚫 Glutenfrei",
  spicy: "🌶 Scharf",
};

export const ALLERGEN_IDS = ["gluten", "milk", "egg", "nuts", "shellfish", "fish", "soy"] as const;
export const ALLERGEN_LABELS: Record<string, string> = {
  gluten: "🌾 Gluten",
  milk: "🥛 Milch",
  egg: "🥚 Ei",
  nuts: "🥜 Nüsse",
  shellfish: "🦐 Schalentiere",
  fish: "🐟 Fisch",
  soy: "🫘 Soja",
};

export const VOL_LABELS: Record<string, string> = {
  g: "0,2l",
  m: "0,3l",
  l: "0,5l",
  btl: "Fl.",
};

export const BADGE_STYLES: Record<string, string> = {
  veg: "bg-[rgba(58,125,82,0.1)] text-[#3a7d52]",
  vegan: "bg-[rgba(45,107,63,0.1)] text-[#2d6b3f]",
  spicy: "bg-[rgba(185,58,58,0.08)] text-[#b93a3a]",
  new: "bg-[rgba(184,150,106,0.12)] text-[#b8966a]",
  sig: "bg-[rgba(184,150,106,0.08)] text-[#b8966a] border border-[rgba(184,150,106,0.2)]",
  gf: "bg-[rgba(100,100,100,0.07)] text-[#9a948a]",
};
export const BADGE_LABELS: Record<string, string> = {
  veg: "Veg",
  vegan: "Vegan",
  spicy: "Scharf",
  new: "Neu",
  sig: "★ Sig",
  gf: "GF",
};

export const KATEGORIE_EMOJIS: Record<string, string> = {
  Vorspeisen: "🥗",
  Hauptgerichte: "🍽️",
  Desserts: "🍮",
  Frühstück: "🥐",
  Bier: "🍺",
  Wein: "🍷",
  Cocktails: "🍹",
  Warmgetränke: "☕",
  Softdrinks: "🥤",
  "Snacks & Burger": "🍔",
  Snacks: "🧆",
  Kaffee: "☕",
};
