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
};

const RAW = [
  {
    id: 1,
    title: "Zapatillas Deportivas Pro Runner",
    store: "CyberGear Store",
    category: "Calzado",
    price: 120000,
    commissionRate: 40,
    stockLeft: 4,
    isNearby: true,
    type: "hoy",
    rating: 4.8,
    temperature: 95,
    badge: "40% COMISIÓN",
    badgeColor: "bg-emerald-100 text-emerald-700 border-emerald-200",
    image:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: 2,
    title: "Teclado Mecánico RGB Wireless",
    store: "CyberGear Store",
    category: "Tecnología",
    price: 89990,
    commissionRate: 35,
    stockLeft: 2,
    isNearby: false,
    type: "descuento",
    rating: 4.7,
    temperature: 88,
    badge: "OFERTA RELÁMPAGO",
    badgeColor: "bg-rose-100 text-rose-700 border-rose-200",
    image:
      "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: 3,
    title: "Masterclass Ecommerce Pro",
    store: "Academia Digital",
    category: "Cursos",
    price: 49000,
    commissionRate: 80,
    stockLeft: 10,
    isNearby: true,
    type: "comision",
    rating: 4.9,
    temperature: 150,
    badge: "80% COMISIÓN",
    badgeColor: "bg-emerald-100 text-emerald-700 border-emerald-200",
    image:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: 4,
    title: "Silla Gamer Ergonómica Premium",
    store: "ComfortZone",
    category: "Accesorios",
    price: 249990,
    commissionRate: 50,
    stockLeft: 3,
    isNearby: false,
    type: "top",
    rating: 5.0,
    temperature: 200,
    badge: "TOP #1 VENTAS",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
    image:
      "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=300&auto=format&fit=crop&q=80",
  },
] as const;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export const EXAMPLE_PREFIX = "ejemplo-";
export const isExample = (id: string) => id.startsWith(EXAMPLE_PREFIX);

export const EXAMPLE_META = new Map<string, ExampleMeta>();

export const EXAMPLE_PRODUCTS: Product[] = RAW.map((r) => {
  const id = `${EXAMPLE_PREFIX}${r.id}`;
  EXAMPLE_META.set(id, {
    temperature: r.temperature,
    badge: r.badge,
    badgeColor: r.badgeColor,
    stockLeft: r.stockLeft,
    rating: r.rating,
    commissionRate: r.commissionRate,
    type: r.type,
    isNearby: r.isNearby,
  });
  return {
    id,
    storeId: `${EXAMPLE_PREFIX}${slug(r.store)}`,
    name: r.title,
    description: "Producto de ejemplo del diseño de Plaza X.",
    price: r.price,
    compareAtPrice: null,
    category: r.category as Category,
    commission: r.commissionRate / 100,
    stock: r.stockLeft,
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
      city: r.isNearby ? "Pasto" : "Bogotá",
      emoji: "🏬",
      shipsNational: !r.isNearby,
      verified: false,
      requireApproval: false,
    },
  };
});
