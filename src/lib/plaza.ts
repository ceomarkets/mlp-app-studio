export const PLATFORM_RATE = 0.09;
export const AFFILIATE_MIN = 0.03;
export const AFFILIATE_MAX = 0.2;
export const MIN_WITHDRAWAL = 50000;

export type Split = { seller: number; affiliate: number; platform: number };

/** Reparto de una venta. Sin afiliado, el vendedor recibe la parte del afiliado. */
export function splitSale(price: number, affiliateRate: number, referred = true): Split {
  const rate = Math.min(AFFILIATE_MAX, Math.max(AFFILIATE_MIN, affiliateRate));
  const platform = Math.round(price * PLATFORM_RATE);
  const affiliate = referred ? Math.round(price * rate) : 0;
  return { seller: price - platform - affiliate, affiliate, platform };
}

export const cop = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

export type Store = { slug: string; name: string; tagline: string; city: string; emoji: string };
export type Product = {
  id: string; name: string; price: number; store: string; category: string;
  commission: number; emoji: string; rating: number; sold: number;
};

export const stores: Store[] = [
  { slug: "tejidos-galeras", name: "Tejidos Galeras", tagline: "Ruanas y lana de oveja hechas a mano", city: "Pasto", emoji: "🧶" },
  { slug: "cafe-nariño", name: "Café de Altura Nariño", tagline: "Café especial del sur de Colombia", city: "La Unión", emoji: "☕" },
  { slug: "barniz-pasto", name: "Barniz de Pasto", tagline: "Mopa-mopa, patrimonio cultural", city: "Pasto", emoji: "🎨" },
  { slug: "campo-vivo", name: "Campo Vivo", tagline: "Del campo nariñense a tu mesa", city: "Ipiales", emoji: "🥔" },
];

export const products: Product[] = [
  { id: "p1", name: "Ruana de lana virgen", price: 180000, store: "tejidos-galeras", category: "Ropa", commission: 0.12, emoji: "🧣", rating: 4.9, sold: 132 },
  { id: "p2", name: "Gorro tejido andino", price: 45000, store: "tejidos-galeras", category: "Ropa", commission: 0.1, emoji: "🧢", rating: 4.7, sold: 310 },
  { id: "p3", name: "Café especial 500 g", price: 38000, store: "cafe-nariño", category: "Alimentos", commission: 0.15, emoji: "☕", rating: 4.9, sold: 845 },
  { id: "p4", name: "Kit barista en casa", price: 120000, store: "cafe-nariño", category: "Alimentos", commission: 0.08, emoji: "🫖", rating: 4.6, sold: 64 },
  { id: "p5", name: "Plato decorativo mopa-mopa", price: 100000, store: "barniz-pasto", category: "Artesanías", commission: 0.1, emoji: "🍽️", rating: 5, sold: 47 },
  { id: "p6", name: "Caja joyero barnizada", price: 75000, store: "barniz-pasto", category: "Artesanías", commission: 0.18, emoji: "🎁", rating: 4.8, sold: 89 },
  { id: "p7", name: "Canasta de papa nativa", price: 28000, store: "campo-vivo", category: "Campo", commission: 0.05, emoji: "🥔", rating: 4.5, sold: 520 },
  { id: "p8", name: "Cuy marinado listo", price: 65000, store: "campo-vivo", category: "Campo", commission: 0.07, emoji: "🍗", rating: 4.4, sold: 203 },
];

export const storeBy = (slug: string) => stores.find((s) => s.slug === slug);
