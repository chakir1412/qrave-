/** Diät-/Allergen-Filter-Keys, von allen Templates konsumiert. */
export const FILTER_KEYS = ["all", "vegan", "veg", "gf", "spicy"] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

/** Emoji-Fallback pro Standard-Kategorie wenn das Item kein eigenes Emoji
 *  trägt. Templates ohne Bilder zeigen das Kategorie-Emoji als Platzhalter. */
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

/** 1×1 transparentes PNG, von next/image als blur-Placeholder genutzt. */
export const IMG_BLUR_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
