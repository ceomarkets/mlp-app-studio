/**
 * Enlaces de afiliado estilo Hotmart: un destino (la plaza, una tienda o un producto) + el
 * usuario del afiliado + un canal opcional (src) para saber de dónde vienen clics y ventas.
 */
import type { Click, OrderItem } from "@/lib/backend";

export type LinkTarget =
  { kind: "plaza" } | { kind: "store"; slug: string } | { kind: "product"; id: string };

export const CHANNELS = [
  { id: "whatsapp", label: "WhatsApp", icon: "fa-brands fa-whatsapp" },
  { id: "instagram", label: "Instagram", icon: "fa-brands fa-instagram" },
  { id: "tiktok", label: "TikTok", icon: "fa-brands fa-tiktok" },
  { id: "facebook", label: "Facebook", icon: "fa-brands fa-facebook-f" },
  { id: "youtube", label: "YouTube", icon: "fa-brands fa-youtube" },
  { id: "email", label: "Correo", icon: "fa-solid fa-envelope" },
] as const;

const cleanSrc = (s: string | null | undefined) =>
  (s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 40);

/** Enlace corto para compartir. Producto: /r/usuario/id · resto: ?ref=usuario. */
export function buildLink(
  origin: string,
  username: string,
  target: LinkTarget,
  source?: string | null,
): string {
  const src = cleanSrc(source);
  if (target.kind === "product")
    return `${origin}/r/${username}/${target.id}${src ? `?src=${src}` : ""}`;
  const path = target.kind === "store" ? `/tienda/${target.slug}` : "/";
  return `${origin}${path}?ref=${username}${src ? `&src=${src}` : ""}`;
}

export type LinkStats = {
  key: string;
  clicks: number;
  sales: number;
  /** Ventas / clics (0 a 1). */
  conversion: number;
  earned: number;
};

/** Clics, ventas pagadas, conversión y comisión agrupadas por producto o por canal. */
export function statsBy(
  clicks: Click[],
  items: OrderItem[],
  by: "product" | "source",
): LinkStats[] {
  const key = (v: {
    productId?: string | null | undefined;
    source?: string | null | undefined;
    refSource?: string | null | undefined;
  }) => (by === "product" ? v.productId : (v.source ?? v.refSource)) || "";
  const map = new Map<string, LinkStats>();
  const get = (k: string) => {
    let s = map.get(k);
    if (!s) map.set(k, (s = { key: k, clicks: 0, sales: 0, conversion: 0, earned: 0 }));
    return s;
  };
  for (const c of clicks) get(key(c)).clicks++;
  for (const i of items) {
    if (!i.paidAt || i.refundedAt) continue;
    const s = get(key({ productId: i.productId, refSource: i.refSource }));
    s.sales++;
    s.earned += i.affiliateAmount;
  }
  return [...map.values()]
    .map((s) => ({ ...s, conversion: s.clicks ? s.sales / s.clicks : 0 }))
    .sort((a, b) => b.earned - a.earned || b.clicks - a.clicks);
}
