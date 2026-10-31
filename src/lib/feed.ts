/**
 * Organización inteligente de la vitrina y de la banda de la cabecera.
 * Todo es puro (sin efectos) para poder probarlo y reutilizarlo.
 */
import { byPriority, isLive, toneBadge } from "@/lib/announcements";
import type { Activity, Announcement, Product } from "@/lib/backend";
import { clampCommission, cop, splitSale } from "@/lib/plaza";

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

export type TickerKind = "news" | "deal" | "new" | "hot" | "low" | "sale";
export type TickerItem = {
  key: string;
  kind: TickerKind;
  /** Producto al que lleva; null en los anuncios (usan `link`). */
  productId: string | null;
  link?: string | null;
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
  announcements: Announcement[] = [],
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
  // Anuncios de la plataforma: van primero en la ronda.
  const news = announcements
    .filter((a) => isLive(a, now))
    .sort(byPriority)
    .map<TickerItem>((a) => ({
      key: `news-${a.id}`,
      kind: "news",
      productId: null,
      link: a.link,
      symbol: toneBadge(a.tone),
      name: a.title,
      value: a.body,
      change: a.link ? `${a.cta} →` : "",
      trend: "flat",
    }));

  const lists = [news, deals, sales, fresh, hot, low];
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

// ---------------------------------------------------------------------------
// Leaderboard de la portada
// ---------------------------------------------------------------------------
export type BoardFilter =
  "all" | "news" | "today" | "viewed" | "new" | "deals" | "earn" | "top" | "rated" | "stores";
type ProductBoard = Exclude<BoardFilter, "all" | "stores" | "news">;

type StoreInfo = Product["store"];
export type BoardItem =
  | {
      kind: "product";
      key: string;
      filter: ProductBoard;
      rank: number;
      badge: string;
      metric: string;
      product: Product;
    }
  | {
      kind: "store";
      key: string;
      filter: "stores";
      rank: number;
      badge: string;
      metric: string;
      store: StoreInfo;
      weekUnits: number;
      products: number;
    }
  | {
      kind: "announcement";
      key: string;
      filter: "news";
      rank: number;
      badge: string;
      metric: string;
      announcement: Announcement;
    };

/**
 * Arma el leaderboard: anuncios de la plataforma, novedades, promociones, comisiones para afiliados
 * (lo que gana quien trae al comprador), top ventas, mejor valorados y
 * mejores tiendas de la semana (por unidades vendidas en 7 días, con el
 * histórico como desempate). "all" intercala todo.
 */
export function buildLeaderboard(
  products: Product[],
  activity: Activity[],
  filter: BoardFilter = "all",
  now = Date.now(),
  size = 8,
  announcements: Announcement[] = [],
  /** Ids vistos por esta persona, del más reciente al más antiguo. */
  viewed: string[] = [],
): BoardItem[] {
  const live = products.filter((p) => p.active && p.stock > 0);
  const item = (
    filter: ProductBoard,
    p: Product,
    i: number,
    badge: string,
    metric: string,
  ): BoardItem => ({
    kind: "product",
    key: `${filter}-${p.id}`,
    filter,
    rank: i + 1,
    badge,
    metric,
    product: p,
  });

  const fresh = [...live]
    .filter((p) => isNew(p, now))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, size)
    .map((p, i) => item("new", p, i, "Nuevo", relTime(p.createdAt, now)));

  const today = [...live]
    .filter((p) => now - Date.parse(p.createdAt) < DAY)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, size)
    .map((p, i) => item("today", p, i, "Hoy", relTime(p.createdAt, now)));

  const liveById = new Map(live.map((p) => [p.id, p]));
  const seen = viewed
    .map((id) => liveById.get(id))
    .filter((p): p is Product => !!p)
    .slice(0, size)
    .map((p, i) => item("viewed", p, i, "Visto", "Lo viste hace poco"));

  const deals = live
    .filter((p) => discountPct(p) > 0)
    .sort((a, b) => discountPct(b) - discountPct(a))
    .slice(0, size)
    .map((p, i) =>
      item("deals", p, i, `−${discountPct(p)}%`, `Ahorras ${cop(p.compareAtPrice! - p.price)}`),
    );

  // Comisiones: mayor % para el afiliado primero; a igual %, más pesos por venta.
  const earn = [...live]
    .map((p) => ({ p, amount: splitSale(p.price, p.commission).affiliate }))
    .sort((a, b) => b.p.commission - a.p.commission || b.amount - a.amount)
    .slice(0, size)
    .map(({ p, amount }, i) =>
      item(
        "earn",
        p,
        i,
        `Gana ${Math.round(clampCommission(p.commission) * 100)}%`,
        `Ganas ${cop(amount)} por venta`,
      ),
    );

  const top = [...live]
    .filter((p) => p.soldCount > 0)
    .sort((a, b) => b.soldCount - a.soldCount)
    .slice(0, size)
    .map((p, i) => item("top", p, i, `#${i + 1}`, `${p.soldCount} vendidos`));

  const rated = [...live]
    .filter((p) => p.ratingCount > 0)
    .sort((a, b) => b.rating - a.rating || b.ratingCount - a.ratingCount)
    .slice(0, size)
    .map((p, i) => item("rated", p, i, `★ ${p.rating.toFixed(1)}`, `${p.ratingCount} reseñas`));

  const byId = new Map(products.map((p) => [p.id, p]));
  const stores = new Map<
    string,
    { store: StoreInfo; week: number; total: number; products: number }
  >();
  for (const p of products) {
    const s = stores.get(p.store.slug) ?? { store: p.store, week: 0, total: 0, products: 0 };
    s.total += p.soldCount;
    if (p.active) s.products++;
    stores.set(p.store.slug, s);
  }
  for (const a of activity) {
    const p = a.productId ? byId.get(a.productId) : undefined;
    if (!p || now - Date.parse(a.paidAt) > 7 * DAY) continue;
    stores.get(p.store.slug)!.week += a.qty;
  }
  const bestStores = [...stores.values()]
    .filter((s) => s.products > 0)
    .sort((a, b) => b.week - a.week || b.total - a.total)
    .slice(0, size)
    .map<BoardItem>((s, i) => ({
      kind: "store",
      key: `store-${s.store.slug}`,
      filter: "stores",
      rank: i + 1,
      badge: `Top ${i + 1}`,
      metric: s.week ? `${s.week} ventas esta semana` : `${s.total} ventas`,
      store: s.store,
      weekUnits: s.week,
      products: s.products,
    }));

  // Anuncios vigentes de la plataforma, por prioridad.
  const news = announcements
    .filter((a) => isLive(a, now))
    .sort(byPriority)
    .slice(0, size)
    .map<BoardItem>((a, i) => ({
      kind: "announcement",
      key: `news-${a.id}`,
      filter: "news",
      rank: i + 1,
      badge: toneBadge(a.tone),
      metric: a.cta,
      announcement: a,
    }));

  const lists: Record<Exclude<BoardFilter, "all">, BoardItem[]> = {
    news,
    today,
    viewed: seen,
    new: fresh,
    deals,
    earn,
    top,
    rated,
    stores: bestStores,
  };
  if (filter !== "all") return lists[filter];
  const order = [news, deals, earn, top, fresh, bestStores, rated];
  const out: BoardItem[] = [];
  for (let i = 0; order.some((l) => i < l.length); i++)
    for (const l of order) if (l[i]) out.push(l[i]!);
  return out;
}

/**
 * Temperatura (estilo Hotmart): popularidad relativa calculada con datos reales
 * — ventas totales, ventas de los últimos 7 días (pesan más) y reseñas.
 * El producto más caliente de la plaza marca 200°; sin actividad, 0°.
 */
export const MAX_TEMP = 200;
export function temperatures(products: Product[], activity: Activity[], now = Date.now()) {
  const week = new Map<string, number>();
  for (const a of activity) {
    if (!a.productId || now - Date.parse(a.paidAt) > 7 * DAY) continue;
    week.set(a.productId, (week.get(a.productId) ?? 0) + a.qty);
  }
  const heat = new Map(
    products.map((p) => [p.id, p.soldCount + 5 * (week.get(p.id) ?? 0) + p.ratingCount]),
  );
  const max = Math.max(0, ...heat.values());
  return new Map(
    products.map((p) => [p.id, max ? Math.round((heat.get(p.id)! / max) * MAX_TEMP) : 0]),
  );
}
