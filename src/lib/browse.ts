import type { Product } from "@/lib/backend";
import { EXAMPLE_META } from "@/lib/examples";

/** Filtros de la portada: aplican al leaderboard y al catálogo a la vez. */
export type Browse = {
  /** "all", "local" (cobertura local), "national" (envíos a todo el país) o "city:<ciudad>". */
  location: string;
  category: string;
  price: PriceBand;
  /** "all" o el slug de la tienda. */
  company: string;
  /** Tipo de oferta: todas, relámpago (con descuento), con comisión o venta directa. */
  offer: OfferType;
};

export type OfferType = "all" | "flash" | "affiliate" | "direct";

export const OFFER_TYPES: { id: OfferType; label: string }[] = [
  { id: "all", label: "Todas las Ofertas" },
  { id: "flash", label: "Solo Ofertas Relámpago ⚡" },
  { id: "affiliate", label: "Con Comisión para Afiliados" },
  { id: "direct", label: "Venta Directa (Sin Comisión)" },
];

export type PriceBand = "all" | "under100k" | "100k-250k" | "above250k";

export const PRICE_BANDS: { id: PriceBand; label: string; min?: number; max?: number }[] = [
  { id: "all", label: "Todos los Precios" },
  { id: "under100k", label: "Hasta $100.000 COP", max: 100_000 },
  { id: "100k-250k", label: "$100.000 - $250.000 COP", min: 100_000, max: 250_000 },
  { id: "above250k", label: "Más de $250.000 COP", min: 250_000 },
];

export const NO_BROWSE: Browse = {
  location: "all",
  category: "all",
  price: "all",
  company: "all",
  offer: "all",
};

export function isBrowsing(b: Browse) {
  return (
    b.location !== "all" ||
    b.category !== "all" ||
    b.price !== "all" ||
    b.company !== "all" ||
    b.offer !== "all"
  );
}

export function applyBrowse(products: Product[], b: Browse): Product[] {
  const band = PRICE_BANDS.find((x) => x.id === b.price);
  return products.filter((p) => {
    if (b.category !== "all" && p.category !== b.category) return false;
    if (b.company !== "all" && p.store.slug !== b.company) return false;
    if (band?.min !== undefined && p.price < band.min) return false;
    if (band?.max !== undefined && p.price > band.max) return false;
    if (b.location === "national" && !p.store.shipsNational) return false;
    if (b.location === "local" && p.store.shipsNational) return false;
    if (b.location.startsWith("city:") && p.store.city !== b.location.slice(5)) return false;
    if (
      b.offer === "flash" &&
      !(p.compareAtPrice && p.compareAtPrice > p.price) &&
      EXAMPLE_META.get(p.id)?.type !== "descuento"
    )
      return false;
    if (b.offer === "affiliate" && !(p.commission > 0)) return false;
    if (b.offer === "direct" && p.commission > 0) return false;
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
