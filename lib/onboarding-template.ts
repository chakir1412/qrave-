/**
 * Onboarding-SQL-Generator für neue Restaurants.
 *
 * Erzeugt einen einzigen Block, der direkt im Supabase SQL Editor
 * ausführbar ist. Auth-User-Anlage bleibt manuell im Supabase-Dashboard
 * (Email/Passwort-Eintrag wird als Kommentar mitgeliefert).
 */

export type CuisineType =
  | "deutsch"
  | "italienisch"
  | "asiatisch"
  | "mediterran"
  | "international"
  | "bar"
  | "cafe"
  | "sonstiges";

export type RestaurantTyp = "restaurant" | "bar" | "cafe" | "bistro" | "imbiss";

export type OnboardingData = {
  // Restaurant Basics
  name: string;
  slug: string;
  beschreibung?: string;
  adresse?: string;
  telefon?: string;
  website?: string;

  // Stammdaten
  cuisine_type: CuisineType;
  stadtbezirk: string;
  sitzplaetze_ca?: number;
  restaurant_typ: RestaurantTyp;

  // CI
  primary_color?: string;
  accent_color?: string;
  font_family?: string;

  // Owner
  owner_email: string;
  owner_password: string;
};

/** Postgres string literal — single quotes verdoppeln. */
function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlNullableString(value: string | undefined | null): string {
  if (value === undefined || value === null) return "NULL";
  const trimmed = value.trim();
  if (trimmed.length === 0) return "NULL";
  return sqlString(trimmed);
}

function sqlNullableNumber(value: number | undefined | null): string {
  if (value === undefined || value === null) return "NULL";
  if (!Number.isFinite(value)) return "NULL";
  return String(Math.trunc(value));
}

/** Felder ohne eigene DB-Spalte landen als Klartext-Hinweis in `notiz`. */
function buildNotiz(data: OnboardingData): string | null {
  const parts: string[] = [];
  if (data.website?.trim()) parts.push(`Website: ${data.website.trim()}`);
  if (data.primary_color?.trim()) parts.push(`primary_color: ${data.primary_color.trim()}`);
  if (data.font_family?.trim()) parts.push(`font_family: ${data.font_family.trim()}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Erzeugt den fertigen SQL-Block für ein Onboarding. */
export function generateOnboardingSQL(data: OnboardingData): string {
  const notiz = buildNotiz(data);
  const lines: string[] = [];

  lines.push(`-- Onboarding: ${data.name} (${data.slug})`);
  lines.push(
    `-- Stadtbezirk: ${data.stadtbezirk} · Typ: ${data.restaurant_typ} · Küche: ${data.cuisine_type}`,
  );
  lines.push("");

  lines.push("INSERT INTO restaurants (");
  lines.push("  id, slug, name, aktiv, email, adresse, telefon, guest_note, notiz,");
  lines.push("  cuisine_type, stadtbezirk, sitzplaetze_ca, restaurant_typ, accent_color");
  lines.push(") VALUES (");
  lines.push(`  gen_random_uuid(),`);
  lines.push(`  ${sqlString(data.slug)},`);
  lines.push(`  ${sqlString(data.name)},`);
  lines.push(`  true,`);
  lines.push(`  ${sqlString(data.owner_email)},`);
  lines.push(`  ${sqlNullableString(data.adresse)},`);
  lines.push(`  ${sqlNullableString(data.telefon)},`);
  lines.push(`  ${sqlNullableString(data.beschreibung)},`);
  lines.push(`  ${sqlNullableString(notiz)},`);
  lines.push(`  ${sqlString(data.cuisine_type)},`);
  lines.push(`  ${sqlString(data.stadtbezirk)},`);
  lines.push(`  ${sqlNullableNumber(data.sitzplaetze_ca)},`);
  lines.push(`  ${sqlString(data.restaurant_typ)},`);
  lines.push(`  ${sqlNullableString(data.accent_color)}`);
  lines.push(");");
  lines.push("");

  lines.push("-- Auth User über Supabase Dashboard anlegen:");
  lines.push(`-- Email: ${data.owner_email} / Passwort: ${data.owner_password}`);
  lines.push(
    `-- Danach restaurants.auth_user_id setzen:`,
  );
  lines.push(
    `-- UPDATE restaurants SET auth_user_id = '<auth.users.id>' WHERE slug = ${sqlString(data.slug)};`,
  );
  lines.push("");

  lines.push(`SELECT id, name, slug FROM restaurants WHERE slug = ${sqlString(data.slug)};`);
  return lines.join("\n");
}

/** Bequeme CLI-Variante: `npx tsx lib/onboarding-template.ts` o. ä. */
export function printOnboardingSQL(data: OnboardingData): void {
  // eslint-disable-next-line no-console
  console.log(generateOnboardingSQL(data));
}

// Beispielaufruf:
// printOnboardingSQL({
//   name: 'Mustermann Restaurant',
//   slug: 'mustermann',
//   cuisine_type: 'deutsch',
//   stadtbezirk: 'Sachsenhausen',
//   restaurant_typ: 'restaurant',
//   owner_email: 'wirt@mustermann.de',
//   owner_password: 'temporaeres-passwort-123'
// })
