import type { SupabaseClient } from "@supabase/supabase-js";

/** Erzeugt einen URL-safen Slug aus einem Namen.
 *  „Mustermann's Bistro 2.0" → „mustermanns-bistro-2-0". */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Findet einen freien Slug. Wenn `mustermann` belegt: `mustermann-2`, `mustermann-3`, … */
export async function ensureUniqueSlug(
  supabase: SupabaseClient,
  baseName: string,
): Promise<string> {
  const base = slugify(baseName) || "restaurant";
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const { data, error } = await supabase
      .from("restaurants")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return candidate;
  }
  // Sehr unwahrscheinlich: 50 Kollisionen → mit Timestamp-Suffix abrunden.
  return `${base}-${Date.now()}`;
}
