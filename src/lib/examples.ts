import type { Category } from "@/lib/plaza";
import type { Product } from "@/lib/backend";

/**
 * Catálogo de ejemplo del diseño Plaza X. Solo se muestra cuando la plaza aún no tiene
 * productos publicados, marcado como "Ejemplo" y sin poder comprarse.
 */
export type ExampleMeta = {
  temperature: number;
  badge: string;
  badgeColor: string;
  stockLeft: number;
  rating: number;
  /** % de comisión que muestra el diseño. */
  commissionRate: number;
  type: "hoy" | "descuento" | "comision" | "top";
  isNearby: boolean;
  /** Aparece en el catálogo (los demás solo en la cinta en vivo). */
  inCatalog: boolean;
  /** Aparece en la cinta en vivo. */
  inFeed: boolean;
};

const BADGE = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";

const RAW = [
  {
    id: 1,
    title: "Zapatillas Deportivas Pro Runner",
    store: "CyberGear Store",
    category: "Calzado",
    originalPrice: 160000,
    price: 120000,
    commissionRate: 40,
    isNearby: true,
    badge: "Envío Gratis",
    stock: 4,
    rating: 4.8,
    temperature: 95,
    inCatalog: true,
    inFeed: true,
    image:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: 2,
    title: "Teclado Mecánico RGB Wireless",
    store: "CyberGear Store",
    category: "Tecnología",
    originalPrice: 130000,
    price: 90000,
    commissionRate: 35,
    isNearby: false,
    badge: "Destacado",
    stock: 8,
    rating: 4.7,
    temperature: 0,
    inCatalog: true,
    inFeed: false,
    image:
      "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: 3,
    title: "Chaqueta Térmica Impermeable Unisex",
    store: "Moda Urbana NIT",
    category: "Ropa",
    originalPrice: 180000,
    price: 135000,
    commissionRate: 30,
    isNearby: true,
    badge: "Popular",
    stock: 2,
    rating: 4.6,
    temperature: 0,
    inCatalog: true,
    inFeed: false,
    image:
      "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: 4,
    title: "Silla Gamer Ergonómica Premium",
    store: "ComfortZone",
    category: "Accesorios",
    originalPrice: 320000,
    price: 250000,
    commissionRate: 50,
    isNearby: false,
    badge: "Premium",
    stock: 0,
    rating: 5.0,
    temperature: 0,
    inCatalog: true,
    inFeed: false,
    image:
      "https://images.unsplash.com/photo-1598550476439-6847785fcea6?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: 5,
    title: "Proteína Whey Isolate 2kg",
    store: "NutriFit Colombia",
    category: "Alimentos",
    originalPrice: 180000,
    price: 145000,
    commissionRate: 25,
    isNearby: false,
    badge: "Destacado",
    stock: 5,
    rating: 4.9,
    temperature: 88,
    inCatalog: false,
    inFeed: true,
    image:
      "https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?w=300&auto=format&fit=crop&q=80",
  },
] as const;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export const EXAMPLE_PREFIX = "ejemplo-";
export const isExample = (id: string) => id.startsWith(EXAMPLE_PREFIX);

export const EXAMPLE_META = new Map<string, ExampleMeta>();

/** Todos los productos de ejemplo (catálogo y cinta en vivo). */
export const EXAMPLE_ALL: Product[] = RAW.map((r) => {
  const id = `${EXAMPLE_PREFIX}${r.id}`;
  EXAMPLE_META.set(id, {
    temperature: r.temperature,
    badge: `${r.commissionRate}% COMISIÓN`,
    badgeColor: BADGE,
    stockLeft: r.stock,
    rating: r.rating,
    commissionRate: r.commissionRate,
    type: r.originalPrice > r.price ? "descuento" : "hoy",
    isNearby: r.isNearby,
    inCatalog: r.inCatalog,
    inFeed: r.inFeed,
  });
  return {
    id,
    storeId: `${EXAMPLE_PREFIX}${slug(r.store)}`,
    name: r.title,
    description: "Producto de ejemplo del diseño de Plaza X.",
    price: r.price,
    compareAtPrice: r.originalPrice,
    category: r.category as Category,
    commission: r.commissionRate / 100,
    stock: r.stock,
    images: [r.image],
    emoji: "🛍️",
    active: true,
    soldCount: 0,
    rating: r.rating,
    ratingCount: 1,
    createdAt: new Date().toISOString(),
    promoCopy: "",
    promoImage: null,
    promoVideo: null,
    store: {
      slug: slug(r.store),
      name: r.store,
      city: r.isNearby ? "Pasto" : "Bogotá D.C.",
      emoji: "🏬",
      shipsNational: !r.isNearby,
      verified: true,
      requireApproval: false,
      kind: "empresa",
    },
  };
});

/** Catálogo de ejemplo. */
export const EXAMPLE_PRODUCTS = EXAMPLE_ALL.filter((p) => EXAMPLE_META.get(p.id)?.inCatalog);
/** Cinta en vivo de ejemplo. */
export const EXAMPLE_FEED = EXAMPLE_ALL.filter((p) => EXAMPLE_META.get(p.id)?.inFeed);

/** "120.000 COP", como en el diseño. */
export const copShort = (n: number) => `${n.toLocaleString("es-CO")} COP`;
