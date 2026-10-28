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

export type EarningRow = {
  amount: number;
  paidAt: string | null;
  fulfillment: "pending" | "preparing" | "shipped" | "delivered" | "cancelled";
  deliveredAt: string | null;
};

/** Mismo cálculo que la función SQL my_wallet(). */
export function computeWallet(rows: EarningRow[], withdrawn: number, now = Date.now()) {
  let pending = 0;
  let released = 0;
  for (const r of rows) {
    if (!r.paidAt || r.fulfillment === "cancelled") continue;
    const free =
      r.fulfillment === "delivered" &&
      !!r.deliveredAt &&
      Date.parse(r.deliveredAt) <= now - HOLD_DAYS * DAY;
    if (free) released += r.amount;
    else pending += r.amount;
  }
  return { pending, available: released - withdrawn, withdrawn };
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
