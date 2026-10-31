/**
 * Reglas del negocio de Plaza X.
 * Estos valores están duplicados a propósito en la base de datos
 * (supabase/migrations/*_plaza_x_core.sql), que es la fuente de verdad
 * al cobrar. Aquí se usan para mostrar cálculos en la interfaz y en el modo demo.
 */
export const PLATFORM_RATE = 0.09;
export const AFFILIATE_MIN = 0.03;
export const AFFILIATE_MAX = 0.2;
export const MIN_WITHDRAWAL = 50000;
/** Descuento por volumen: desde BUNDLE_MIN unidades, BUNDLE_RATE menos (lo absorbe Plaza X). */
export const BUNDLE_MIN = 3;
export const BUNDLE_RATE = 0.05;

/** Descuento por volumen de una línea, igual que create_order() en la base de datos. */
export function bundleDiscount(subtotal: number, totalUnits: number) {
  if (BUNDLE_RATE <= 0 || totalUnits < BUNDLE_MIN) return 0;
  return Math.min(Math.round(subtotal * PLATFORM_RATE), Math.round(subtotal * BUNDLE_RATE));
}
/** Días que se retienen las ganancias después de la entrega. */
export const HOLD_DAYS = 7;
/** Ventana de atribución de un enlace de afiliado. */
export const REF_WINDOW_DAYS = 30;

export const CATEGORIES = [
  "Ropa",
  "Alimentos",
  "Artesanías",
  "Campo",
  "Hogar",
  "Belleza",
  "Tecnología",
  "Otros",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const PAYOUT_METHODS = [
  { id: "nequi", label: "Nequi" },
  { id: "daviplata", label: "Daviplata" },
  { id: "bancolombia", label: "Bancolombia" },
] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number]["id"];

export type Split = { seller: number; affiliate: number; platform: number };

export const clampCommission = (rate: number) =>
  Math.min(AFFILIATE_MAX, Math.max(AFFILIATE_MIN, rate));

/** Reparto de una venta (sobre el subtotal). Sin afiliado, el vendedor recibe la parte del afiliado. */
export function splitSale(amount: number, affiliateRate: number, referred = true): Split {
  const platform = Math.round(amount * PLATFORM_RATE);
  const affiliate = referred ? Math.round(amount * clampCommission(affiliateRate)) : 0;
  return { seller: amount - platform - affiliate, affiliate, platform };
}

export const cop = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);

export const compact = (n: number) =>
  new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

const DAY = 86_400_000;

/** Días tras el despacho en que la entrega se confirma sola (igual que la base de datos). */
export const AUTO_CONFIRM_DAYS = 10;

export type EarningRow = {
  amount: number;
  paidAt: string | null;
  fulfillment: "pending" | "preparing" | "shipped" | "delivered" | "cancelled";
  deliveredAt: string | null;
  shippedAt?: string | null;
  /** Tiene una disputa abierta: el dinero queda congelado. */
  frozen?: boolean;
};

/** Mismo cálculo que la función SQL my_wallet(). */
export function computeWallet(rows: EarningRow[], withdrawn: number, now = Date.now()) {
  let pending = 0;
  let released = 0;
  let frozen = 0;
  for (const r of rows) {
    if (!r.paidAt || r.fulfillment === "cancelled") continue;
    if (r.frozen) {
      frozen += r.amount;
      continue;
    }
    const delivered =
      r.fulfillment === "delivered" && r.deliveredAt
        ? Date.parse(r.deliveredAt)
        : r.fulfillment === "shipped" && r.shippedAt
          ? Date.parse(r.shippedAt) + AUTO_CONFIRM_DAYS * DAY
          : null;
    if (delivered !== null && delivered <= now - HOLD_DAYS * DAY) released += r.amount;
    else pending += r.amount;
  }
  return { pending, available: released - withdrawn, withdrawn, frozen };
}

/** Agrupa fechas ISO en una serie diaria de los últimos `days` días (incluye hoy). */
export function dailySeries<T>(
  rows: T[],
  date: (r: T) => string | null,
  value: (r: T) => number,
  days = 30,
  now = Date.now(),
) {
  const start = new Date(now - (days - 1) * DAY);
  start.setHours(0, 0, 0, 0);
  const out = Array.from({ length: days }, (_, i) => {
    const d = new Date(start.getTime() + i * DAY);
    return {
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("es-CO", { day: "numeric", month: "short" }),
      value: 0,
    };
  });
  for (const r of rows) {
    const iso = date(r);
    if (!iso) continue;
    const idx = Math.floor((Date.parse(iso) - start.getTime()) / DAY);
    if (idx >= 0 && idx < days) out[idx]!.value += value(r);
  }
  return out;
}

export const daysAgo = (n: number, now = Date.now()) => new Date(now - n * DAY).toISOString();

export const FULFILLMENT_LABEL: Record<EarningRow["fulfillment"], string> = {
  pending: "Por preparar",
  preparing: "Preparando",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

/** Niveles de afiliado por ventas referidas reales (pagadas y no canceladas). */
export const AFFILIATE_LEVELS = [
  { name: "Principiante", min: 0 },
  { name: "Activo", min: 10 },
  { name: "Líder", min: 50 },
  { name: "Leyenda", min: 100 },
] as const;

export function affiliateLevel(sales: number) {
  let i = 0;
  while (i + 1 < AFFILIATE_LEVELS.length && sales >= AFFILIATE_LEVELS[i + 1]!.min) i++;
  const level = AFFILIATE_LEVELS[i]!;
  const next = AFFILIATE_LEVELS[i + 1] ?? null;
  const progress = next ? (sales - level.min) / (next.min - level.min) : 1;
  return { name: level.name, sales, next, missing: next ? next.min - sales : 0, progress };
}
