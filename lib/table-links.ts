/** Öffentliche Menü-URL pro Tisch: https://qrave.menu/[slug]/tisch-[tisch_nummer] */
export function buildTableQrUrl(slug: string, tischNummer: number): string {
  const s = slug.trim().replace(/^\/+|\/+$/g, "");
  return `https://qrave.menu/${s}/tisch-${tischNummer}`;
}
