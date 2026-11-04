import type { Product } from "@/lib/backend";

/** Zonas del cuerpo en el vestidor virtual. */
export type Slot = "top" | "bottom" | "shoes" | "accessory";
export type Gender = "mujer" | "hombre";

export const SLOTS: { id: Slot; label: string; icon: string }[] = [
  { id: "top", label: "Parte superior", icon: "fa-shirt" },
  { id: "bottom", label: "Parte inferior", icon: "fa-person-half-dress" },
  { id: "shoes", label: "Calzado", icon: "fa-shoe-prints" },
  { id: "accessory", label: "Accesorios", icon: "fa-hat-cowboy" },
];

const SHOES = /zapat|tenis|bota|botín|sandal|calzado|mocas|alpargat|chancl/i;
const BOTTOM = /pantal|jean|falda|short|bermuda|legg?in|jogger|sudadera de pierna/i;
const ACCESSORY =
  /gorr|sombr|boin|bufanda|chal|collar|arete|pulsera|reloj|gafas|bolso|cartera|mochila|cintur|mochila|manilla|anillo/i;
const HEAD = /gorr|sombr|boin|gafas/i;

/** En qué zona se pone un producto (null si no es para vestir). */
export function slotOf(p: Pick<Product, "name" | "category">): Slot | null {
  const n = p.name;
  if ((p.category as string) === "Calzado" || SHOES.test(n)) return "shoes";
  if (ACCESSORY.test(n)) return "accessory";
  if (p.category === "Ropa") return BOTTOM.test(n) ? "bottom" : "top";
  return null;
}

export const isWearable = (p: Pick<Product, "name" | "category">) => slotOf(p) !== null;

/** Los accesorios de cabeza van arriba; los demás, en la mano. */
export const isHeadwear = (p: Pick<Product, "name">) => HEAD.test(p.name);

export type Look = Partial<Record<Slot, string>>;

/** "id1,id2" → look (cada producto en su zona). */
export function parseLook(ids: string | undefined, products: Product[]): Look {
  const look: Look = {};
  for (const id of (ids ?? "").split(",").filter(Boolean)) {
    const p = products.find((x) => x.id === id);
    const slot = p && slotOf(p);
    if (slot) look[slot] = id;
  }
  return look;
}

export const lookIds = (look: Look) => Object.values(look).filter(Boolean).join(",");
