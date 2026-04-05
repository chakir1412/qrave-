/** URL-Slug aus Restaurantname: lowercase, Sonderzeichen raus, Leerzeichen → Bindestrich. */
export function slugifyRestaurantName(name: string): string {
  const stripped = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return stripped
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
