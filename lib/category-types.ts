/**
 * Restaurant-Kategorien, die als reine Getränkekategorien gelten.
 * Wird vom Wirtshaus-Template für den Diät-Filter genutzt UND vom
 * Operator-Dashboard, um Tages-Special- und Mittagsangebot-Auswahl
 * sauber in Speisen vs. Getränke zu trennen.
 *
 * Schreibweise muss zur in der DB gespeicherten `kategorie`-Spalte
 * passen (case-sensitiv).
 */
export const DRINK_CATEGORY_NAMES = [
  "Aperitif",
  "Softdrinks",
  "Säfte",
  "Biere vom Fass",
  "Flaschenbiere",
  "Apfelwein",
  "Weine",
  "Spirituosen",
  "Longdrinks",
  "Rum",
  "Whiskey",
  "Heissgetränke",
  "Fruchtiges von Rapps",
] as const;

export const DRINK_CATEGORIES: ReadonlySet<string> = new Set(DRINK_CATEGORY_NAMES);

export function isDrinkCategory(kategorie: string | null | undefined): boolean {
  if (!kategorie) return false;
  return DRINK_CATEGORIES.has(kategorie.trim());
}
