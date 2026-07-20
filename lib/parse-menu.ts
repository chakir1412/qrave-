/** DTO aus Claude / API (vor Client-Review) */
export type ParsedMenuItemDto = {
  name: string;
  beschreibung: string;
  /** Diät-Tags (Subset von vegan, vegetarisch, glutenfrei, scharf). */
  tags: string[];
  /** 14 LMIV-Allergene als Schlüssel (Subset von LMIV_ALLERGEN_KEYS). */
  allergens: string[];
  /** Freitext für Zusatzstoffe (Geschmacksverstärker, Konservierungsstoffe etc.). */
  additives_text: string;
  preis: number;
  kategorie: string;
  main_tab: "speisen" | "getraenke" | "snacks";
  /** 0..1, wie sicher die Kategorie-Zuordnung ist */
  category_confidence: number;
  /** True wenn das Item Codes am Namen hatte, aber die Karte keine
   *  auflösbare Legende hatte — der Wirt muss allergens/additives_text
   *  im Import-Review manuell nachtragen. */
  needs_review: boolean;
  /** Kurzer Grund für die Markierung. Nur relevant wenn needs_review=true. */
  needs_review_reason?: string;
};

const ALLOWED_TAGS = ["vegan", "vegetarisch", "glutenfrei", "scharf"] as const;

/** Zulässige LMIV-Allergen-Schlüssel — muss synchron zu LMIV_ALLERGENS in i18n-menu.ts. */
const ALLOWED_ALLERGENS = [
  "gluten",
  "krebstiere",
  "eier",
  "fisch",
  "erdnuesse",
  "soja",
  "milch",
  "schalenfruechte",
  "sellerie",
  "senf",
  "sesam",
  "sulfite",
  "lupinen",
  "weichtiere",
] as const;

function normalizeAllergens(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<string>();
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const k = v.trim().toLowerCase();
    if ((ALLOWED_ALLERGENS as readonly string[]).includes(k)) out.add(k);
  }
  return Array.from(out);
}

function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<string>();
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const k = v.trim().toLowerCase();
    if ((ALLOWED_TAGS as readonly string[]).includes(k)) out.add(k);
  }
  // Vegan impliziert vegetarisch.
  if (out.has("vegan")) out.add("vegetarisch");
  return Array.from(out);
}

const MAIN_TABS = ["speisen", "getraenke", "snacks"] as const;

const SPEISEN_TERMS = [
  "starters",
  "vorspeisen",
  "salate",
  "salads",
  "suppen",
  "soup",
  "main course",
  "hauptgerichte",
  "fleisch",
  "fisch",
  "fish",
  "meat",
  "vegetarisch",
  "vegan",
  "pasta",
  "pizza",
  "burger",
  "dessert",
  "desserts",
  "nachspeisen",
  "frühstück",
  "fruehstueck",
  "breakfast",
  "lunch",
  "brunch",
  "happas",
  "kleinigkeiten",
] as const;

const GETRAENKE_TERMS = [
  "drinks",
  "getränke",
  "getraenke",
  "wein",
  "wine",
  "bier",
  "beer",
  "cocktails",
  "spirits",
  "spirituosen",
  "longdrinks",
  "softdrinks",
  "kaffee",
  "coffee",
  "tee",
  "tea",
  "aperitifs",
  "digestifs",
  "wasser",
  "water",
  "säfte",
  "saefte",
  "juices",
  "offene weine",
  "rotwein",
  "weißwein",
  "weisswein",
] as const;

const SNACKS_TERMS = [
  "snacks",
  "fingerfood",
  "tapas",
  "snacks & burger",
] as const;

function includesAny(haystack: string, terms: readonly string[]): boolean {
  for (const t of terms) {
    if (haystack.includes(t)) return true;
  }
  return false;
}

/** Heuristik für Kategorie -> Main Tab (null = unklar). */
export function inferMainTabFromCategoryName(
  category: string,
): ParsedMenuItemDto["main_tab"] | null {
  const x = category.toLowerCase().trim();
  if (!x) return null;
  if (includesAny(x, SNACKS_TERMS)) return "snacks";
  if (includesAny(x, GETRAENKE_TERMS)) return "getraenke";
  if (includesAny(x, SPEISEN_TERMS)) return "speisen";
  return null;
}

function normalizeMainTab(raw: unknown): ParsedMenuItemDto["main_tab"] {
  if (typeof raw !== "string") return "speisen";
  const x = raw.toLowerCase().trim();
  if (x === "getraenke" || x.includes("getränk") || x.includes("getraenk")) return "getraenke";
  if (x === "snacks" || x.includes("snack")) return "snacks";
  if (MAIN_TABS.includes(x as (typeof MAIN_TABS)[number])) return x as ParsedMenuItemDto["main_tab"];
  return "speisen";
}

function toNumberPreis(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, raw);
  if (typeof raw === "string") {
    const s = raw.replace(/€/g, "").replace(/\s/g, "").replace(",", ".");
    const n = Number.parseFloat(s);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }
  return 0;
}

function normalizeConfidence(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, Math.min(1, raw));
  }
  if (typeof raw === "string") {
    const n = Number.parseFloat(raw.replace(",", "."));
    if (Number.isFinite(n)) return Math.max(0, Math.min(1, n));
  }
  return 0.5;
}

function normalizeOne(raw: unknown): ParsedMenuItemDto | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!name) return null;
  const beschreibung =
    typeof o.beschreibung === "string"
      ? o.beschreibung.trim()
      : typeof o.desc === "string"
        ? o.desc.trim()
        : "";
  const additives_text =
    typeof o.additives_text === "string"
      ? o.additives_text.trim()
      : typeof o.zusatzstoffe === "string"
        ? o.zusatzstoffe.trim()
        : "";
  const kategorie =
    typeof o.kategorie === "string" && o.kategorie.trim()
      ? o.kategorie.trim()
      : "Sonstiges";
  const needs_review = o.needs_review === true;
  const needs_review_reason =
    typeof o.needs_review_reason === "string" && o.needs_review_reason.trim()
      ? o.needs_review_reason.trim()
      : undefined;
  return {
    name,
    beschreibung,
    tags: normalizeTags(o.tags),
    allergens: normalizeAllergens(o.allergens),
    additives_text,
    preis: toNumberPreis(o.preis),
    kategorie,
    main_tab: normalizeMainTab(o.main_tab),
    category_confidence: normalizeConfidence(o.category_confidence),
    needs_review,
    ...(needs_review_reason ? { needs_review_reason } : {}),
  };
}

/** JSON aus Modell-Antwort parsen und validieren */
export function parseMenuJsonFromModel(text: string): ParsedMenuItemDto[] {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  }
  const data: unknown = JSON.parse(t) as unknown;
  if (typeof data !== "object" || data === null) {
    throw new Error("Ungültiges JSON");
  }
  const o = data as Record<string, unknown>;
  const items = o.items;
  if (!Array.isArray(items)) {
    throw new Error('JSON muss ein Array "items" enthalten');
  }
  const out: ParsedMenuItemDto[] = [];
  for (const el of items) {
    const n = normalizeOne(el);
    if (n) out.push(n);
  }
  if (out.length === 0) {
    throw new Error("Keine gültigen Gerichte im JSON");
  }
  return out;
}

export const PARSE_MENU_PROMPT = `Analysiere diese Speisekarte und extrahiere ALLE Menü-Items als JSON — Speisen UND Getränke. Überspringe KEINE Sektion. Auch wenn ein Text-Chunk nur Getränke enthält: extrahiere alles daraus.

Format: { "items": [{ "name", "beschreibung", "preis", "kategorie", "main_tab", "category_confidence", "allergens", "additives_text" }] }

WICHTIG — deutsche Kennzeichnungs-Konvention:
- BUCHSTABEN (A, B, C, D, E, F, G, H, ... oder A1, A2 auf einigen Karten) → ALLERGENE → in "allergens" als LMIV-Schlüssel.
- ZIFFERN (1, 2, 3, ..., 14) → ZUSATZSTOFFE → in "additives_text" als deutscher Klartext. NICHT als Allergen interpretieren!

allergens: Array der 14 LMIV-Allergen-Schlüssel — NUR diese Werte sind erlaubt (exakte Schreibweise):
gluten, krebstiere, eier, fisch, erdnuesse, soja, milch, schalenfruechte, sellerie, senf, sesam, sulfite, lupinen, weichtiere.
Einzige zulässige Quelle: Buchstaben-Codes, die AUSDRÜCKLICH am Item auf der Karte stehen (übliche Legende: A=Gluten, B=Krebstiere, C=Eier, D=Fisch, E=Erdnüsse, F=Soja, G=Milch, H=Schalenfrüchte, L=Sellerie, M=Senf, N=Sesam, O=Sulfite, P=Lupinen, R=Weichtiere — wenn eine Legende auf der Karte steht, nach dieser vorgehen).

NIEMALS Allergene aus Zutaten oder Item-Namen ableiten oder schlussfolgern:
- "Brötchen" NICHT → gluten (nur wenn A auf der Karte steht)
- "Camembert" NICHT → milch (nur wenn G auf der Karte steht)
- "Krabbencocktail" NICHT → krebstiere (nur wenn B auf der Karte steht)
- Auch nicht bei "enthält Gluten" im Beschreibungstext — nur die Buchstaben-Kennzeichnung zählt.

NIEMALS Ziffern 1-14 als Allergene interpretieren — das sind Zusatzstoffe.
Wenn keine Buchstaben-Kennzeichnung am Item vorhanden: [].

additives_text: Zusatzstoffe (NICHT Allergene!). Deutsche Karten kennzeichnen Zusatzstoffe meist mit Ziffern 1-14. Löse nach dieser Standard-Legende auf und schreibe komma-getrennt als deutschen Klartext:
- 1 = mit Milcheiweiß
- 2 = mit Geschmacksverstärker
- 3 = mit Konservierungsstoff
- 4 = mit Antioxidationsmittel
- 5 = mit Farbstoff
- 6 = mit Säuerungsmittel
- 7 = mit Säureregulator
- 8 = mit Stabilisator
- 9 = mit Süßstoff Aspartam (enthält Phenylalaninquelle)
- 10 = mit Emulgator
- 11 = mit Süßungsmittel
- 12 = mit Nitritpökelsalz
- 13 = coffeinhaltig
- 14 = chininhaltig

Format: mit "enthält " starten und die Klartext-Bezeichnungen komma-getrennt anhängen, z. B. "enthält Geschmacksverstärker, Konservierungsstoff, Farbstoff".
Auch explizite Nennungen ("phosphathaltig", "geschwefelt", "geschwärzt", "koffeinhaltig", "chininhaltig") → hier ablegen.
Wenn nichts: "".

STRIKTE TRENNUNG:
- Buchstaben → allergens[]
- Ziffern 1-14 → additives_text
Setze NIE eine Ziffer als Allergen und NIE ein LMIV-Allergen in additives_text.

BEISPIEL — "Wiener Schnitzel (A, C, G, 2, 3)":
"allergens": ["gluten", "eier", "milch"], "additives_text": "enthält Geschmacksverstärker, Konservierungsstoff"

BEISPIEL — "Cola (11, 13)":
"allergens": [], "additives_text": "enthält Süßungsmittel, coffeinhaltig"

BEISPIEL — "Camembert paniert (A, G)":
"allergens": ["gluten", "milch"], "additives_text": ""

BEISPIEL — "Crostini 2,3,4,5" (keine Buchstaben-Kennzeichnung):
"allergens": [], "additives_text": "enthält Geschmacksverstärker, Konservierungsstoff, Antioxidationsmittel, Farbstoff"
(Nicht "gluten" ergänzen — auch wenn Brot Gluten enthält. Ohne Buchstaben-Kennzeichnung bleibt allergens leer.)

main_tab ist immer exakt eines von: speisen, getraenke, snacks (Schreibweise getraenke ohne Umlaut)
- Alle Speisen: main_tab = "speisen"
- Alle Getränke: main_tab = "getraenke"

Getränke-Bereiche die du vollständig erfassen musst:
- Weine (Rot, Weiß, Rosé, Sekt, Champagner)
- Bier (vom Fass, Flasche, alkoholfrei)
- Spirits (Whiskey, Vodka, Gin, Rum, Cognac usw.)
- Cocktails und Aperitifs
- Softdrinks, Säfte, Wasser
- Kaffee, Tee, Heißgetränke

Bei Weinen: Weinnamen als "name", Herkunft/Region/Rebsorte als "beschreibung", den kleinsten erkennbaren Glas-/Preis als "preis" (Zahl).

Getränke mit mehreren Größen und Preisen (z. B. 0,2l und 0,4l): genau EIN Item — nicht aufteilen.
- "name": nur der Getränkename (ohne Mengenangaben), z. B. "Wasser", "Cola", "Schmucker Pils vom Fass"
- "preis": numerisch der kleinste der angegebenen Preise (z. B. 2.60 bei 2,60€ und 3,60€)
- "beschreibung": alle Größen mit Preis, Format exakt mit Mittelpunkt und Euro-Zeichen, Größen durch " / " getrennt:
  "0,2l · 2,60€ / 0,4l · 3,60€"
Beispiele (Ausgabe im JSON):
- Quelle: Wasser 0,2l 2,60€ / 0,4l 3,60€ → name "Wasser", preis 2.60, beschreibung "0,2l · 2,60€ / 0,4l · 3,60€"
- Quelle: Cola 0,2l 2,80€ / 0,4l 4,00€ → name "Cola", preis 2.80, beschreibung "0,2l · 2,80€ / 0,4l · 4,00€"
- Quelle: Schmucker Pils vom Fass 0,3l 3,20€ / 0,5l 4,80€ → name "Schmucker Pils vom Fass", preis 3.20, beschreibung "0,3l · 3,20€ / 0,5l · 4,80€"
VERBOTEN: dieselbe Getränkelinie als mehrere JSON-Items; VERBOTEN: nur einen Preis in "preis" ohne die übrigen Größen/Preise in "beschreibung" zu dokumentieren.

category_confidence ist eine Zahl zwischen 0 und 1 (0 = unsicher, 1 = sehr sicher)
Preis als Zahl ohne €-Zeichen (z.B. 12.50)
Wenn kein Preis erkennbar: 0

Nutze für kategorie und main_tab zusätzlich diese Hinweise (case-insensitive, Teilstring):
- SPEISEN (main_tab speisen): Starters, Vorspeisen, Salate, Salads, Suppen, Soup, Main Course, Hauptgerichte, Fleisch, Fisch, Fish, Meat, Vegetarisch, Vegan, Pasta, Pizza, Burger, Dessert, Desserts, Nachspeisen, Frühstück, Breakfast, Lunch, Brunch, Happas, Kleinigkeiten
- GETRÄNKE (main_tab getraenke): Drinks, Getränke, Wein, Wine, Bier, Beer, Cocktails, Spirits, Spirituosen, Longdrinks, Softdrinks, Kaffee, Coffee, Tee, Tea, Aperitifs, Digestifs, Wasser, Water, Säfte, Juices, Offene Weine, Rotwein, Weißwein, Champagner, Sekt, Rosé
- SNACKS (main_tab snacks): Snacks, Fingerfood, Tapas, Snacks & Burger

Wenn die Zuordnung unsicher ist: trotzdem best guess in main_tab, aber category_confidence niedrig setzen (<= 0.45).
Wichtig: Erzeuge KEIN trailing comma nach dem letzten Item. Das JSON muss syntaktisch valide sein.
Nur JSON zurückgeben, kein Text davor oder danach.`;
