import type { Product } from "@/lib/backend";
import { discountPct } from "@/lib/feed";
import { cop } from "@/lib/plaza";

const origin = () => (typeof window !== "undefined" ? window.location.origin : "https://plazax.co");

/**
 * Texto corto y cálido para compartir un producto. Si quien comparte es
 * afiliado, el enlace lleva su usuario para que gane la comisión.
 */
export function productShare(p: Product, username?: string | null) {
  const off = discountPct(p);
  const url = username ? `${origin()}/r/${username}/${p.id}` : `${origin()}/producto/${p.id}`;
  const text = off
    ? `😍 ${p.name} con ${off}% off: ${cop(p.price)} en Plaza X`
    : `😍 Mira esto: ${p.name} a ${cop(p.price)} en Plaza X`;
  return { title: p.name, text, url };
}

export function plazaShare() {
  return {
    title: "Plaza X",
    text: "🛍️ Lo más bonito de Nariño en un solo lugar. ¡Míralo!",
    url: origin(),
  };
}
