import type { Product } from "@/lib/backend";

/** Filtros de la portada: aplican al leaderboard y al catálogo a la vez. */
export type Browse = {
  /** "all", "city:<ciudad>" o "national" (tiendas con envíos a todo el país). */
  location: string;
  category: string;
  price: PriceBand;
  /** "all" o el slug de la tienda. */
  company: string;
};

export type PriceBand = "all" | "lt50" | "50to150" | "gt150";

export const PRICE_BANDS: { id: PriceBand; label: string; min?: number; max?: number }[] = [
  { id: "all", label: "Precio" },
  { id: "lt50", label: "Hasta $50.000", max: 50_000 },
  { id: "50to150", label: "$50.000 – $150.000", min: 50_000, max: 150_000 },
  { id: "gt150", label: "Más de $150.000", min: 150_000 },
];

export const NO_BROWSE: Browse = { location: "all", category: "all", price: "all", company: "all" };

export function isBrowsing(b: Browse) {
  return b.location !== "all" || b.category !== "all" || b.price !== "all" || b.company !== "all";
}

export function applyBrowse(products: Product[], b: Browse): Product[] {
  const band = PRICE_BANDS.find((x) => x.id === b.price);
  return products.filter((p) => {
    if (b.category !== "all" && p.category !== b.category) return false;
    if (b.company !== "all" && p.store.slug !== b.company) return false;
    if (band?.min !== undefined && p.price < band.min) return false;
    if (band?.max !== undefined && p.price > band.max) return false;
    if (b.location === "national" && !p.store.shipsNational) return false;
    if (b.location.startsWith("city:") && p.store.city !== b.location.slice(5)) return false;
    return true;
  });
}

/** Ciudades con productos activos, de la que más tiene a la que menos. */
export function citiesOf(products: Product[]): string[] {
  const n = new Map<string, number>();
  for (const p of products) if (p.store.city) n.set(p.store.city, (n.get(p.store.city) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
}

export function companiesOf(products: Product[]): { slug: string; name: string }[] {
  const m = new Map<string, string>();
  for (const p of products) m.set(p.store.slug, p.store.name);
  return [...m.entries()]
    .map(([slug, name]) => ({ slug, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}
