/**
 * Organización inteligente de la vitrina y de la banda de la cabecera.
 * Todo es puro (sin efectos) para poder probarlo y reutilizarlo.
 */
import type { Activity, Product } from "@/lib/backend";
import { cop } from "@/lib/plaza";

const DAY = 86_400_000;
export const NEW_DAYS = 14;
export const LOW_STOCK = 5;

export function discountPct(p: Pick<Product, "price" | "compareAtPrice">) {
  if (!p.compareAtPrice || p.compareAtPrice <= p.price) return 0;
  return Math.round((1 - p.price / p.compareAtPrice) * 100);
}

export const isNew = (p: Pick<Product, "createdAt">, now = Date.now()) =>
  now - Date.parse(p.createdAt) < NEW_DAYS * DAY;

export function relTime(iso: string, now = Date.now()) {
  const m = Math.max(1, Math.round((now - Date.parse(iso)) / 60_000));
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}

export type TickerKind = "deal" | "new" | "hot" | "low" | "sale";
export type TickerItem = {
  key: string;
  kind: TickerKind;
  productId: string;
  symbol: string;
  name: string;
  value: string;
  change: string;
  /** up = sube (popularidad), down = baja (precio), flat = informativo */
  trend: "up" | "down" | "flat";
};

/** Símbolo corto tipo bolsa: "CAFÉ ESPECIAL" → "CAFE". */
export function tickerSymbol(name: string) {
  const word =
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toUpperCase()
      .split(/[^A-Z0-9]+/)
      .find((w) => w.length >= 3) ?? name.toUpperCase();
  return word.slice(0, 5);
}

/**
 * Arma la banda: ofertas, novedades, lo más vendido, últimas unidades y
 * ventas recientes, intercaladas para que no se repita el mismo tipo seguido.
 */
export function buildTicker(
  products: Product[],
  activity: Activity[],
  now = Date.now(),
): TickerItem[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const base = (p: Product) => ({ productId: p.id, symbol: tickerSymbol(p.name), name: p.name });

  const deals = products
    .filter((p) => discountPct(p) > 0 && p.stock > 0)
    .sort((a, b) => discountPct(b) - discountPct(a))
    .map<TickerItem>((p) => ({
      ...base(p),
      key: `deal-${p.id}`,
      kind: "deal",
      value: cop(p.price),
      change: `▼ ${discountPct(p)}%`,
      trend: "down",
    }));

  const fresh = products
    .filter((p) => isNew(p, now) && p.stock > 0)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map<TickerItem>((p) => ({
      ...base(p),
      key: `new-${p.id}`,
      kind: "new",
      value: cop(p.price),
      change: "NUEVO",
      trend: "flat",
    }));

  const hot = [...products]
    .filter((p) => p.soldCount > 0)
    .sort((a, b) => b.soldCount - a.soldCount)
    .slice(0, 4)
    .map<TickerItem>((p) => ({
      ...base(p),
      key: `hot-${p.id}`,
      kind: "hot",
      value: cop(p.price),
      change: `▲ ${p.soldCount} vendidos`,
      trend: "up",
    }));

  const low = products
    .filter((p) => p.stock > 0 && p.stock <= LOW_STOCK)
    .map<TickerItem>((p) => ({
      ...base(p),
      key: `low-${p.id}`,
      kind: "low",
      value: cop(p.price),
      change: `¡Quedan ${p.stock}!`,
      trend: "flat",
    }));

  const sales = activity
    .filter((a) => a.productId && byId.has(a.productId))
    .slice(0, 8)
    .map<TickerItem>((a, i) => {
      const p = byId.get(a.productId!)!;
      return {
        ...base(p),
        key: `sale-${i}-${a.paidAt}`,
        kind: "sale",
        value: a.city ? `Vendido en ${a.city}` : "Vendido",
        change: relTime(a.paidAt, now),
        trend: "up",
      };
    });

  // Intercala las listas en ronda.
  const lists = [deals, sales, fresh, hot, low];
  const out: TickerItem[] = [];
  for (let i = 0; lists.some((l) => i < l.length); i++)
    for (const l of lists) if (l[i]) out.push(l[i]!);
  return out;
}

export type Sections = {
  deals: Product[];
  best: Product[];
  fresh: Product[];
  forYou: Product[];
  viewed: Product[];
};

/**
 * Secciones de la portada. "Para ti" usa las categorías de lo que la persona
 * vio, guardó o tiene en el carrito, y prioriza lo que aún no ha visto.
 */
export function buildSections(
  products: Product[],
  signals: { viewed: string[]; favorites: string[]; cart: string[] },
  now = Date.now(),
): Sections {
  const available = products.filter((p) => p.stock > 0);
  const byId = new Map(products.map((p) => [p.id, p]));
  const viewed = signals.viewed.map((id) => byId.get(id)).filter((p): p is Product => !!p);

  const weights = new Map<string, number>();
  const bump = (ids: string[], w: number) =>
    ids.forEach((id) => {
      const c = byId.get(id)?.category;
      if (c) weights.set(c, (weights.get(c) ?? 0) + w);
    });
  bump(signals.viewed, 1);
  bump(signals.favorites, 2);
  bump(signals.cart, 3);

  const seen = new Set([...signals.viewed, ...signals.cart]);
  const score = (p: Product) =>
    (weights.get(p.category) ?? 0) * 10 +
    (seen.has(p.id) ? -20 : 0) +
    discountPct(p) / 5 +
    Math.log1p(p.soldCount) +
    p.rating;

  return {
    deals: available
      .filter((p) => discountPct(p) > 0)
      .sort((a, b) => discountPct(b) - discountPct(a)),
    best: [...available].sort((a, b) => b.soldCount - a.soldCount).slice(0, 8),
    fresh: available
      .filter((p) => isNew(p, now))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    forYou: weights.size ? [...available].sort((a, b) => score(b) - score(a)).slice(0, 8) : [],
    viewed: viewed.slice(0, 8),
  };
}
