import type { Product } from "@/lib/backend";

/**
 * Vestidor virtual: cada producto de la tienda se reconoce como un tipo de prenda
 * (camiseta, jean, botas…) que luego se dibuja a la medida del cuerpo del modelo.
 */
export type Gender = "mujer" | "hombre";

/** Zonas del cuerpo: una prenda por zona. */
export type Zone =
  "head" | "face" | "neck" | "outer" | "top" | "dress" | "bottom" | "shoes" | "hand";

export type Kind =
  | "tshirt"
  | "blouse"
  | "shirt"
  | "sweater"
  | "hoodie"
  | "jacket"
  | "coat"
  | "ruana"
  | "dress"
  | "jeans"
  | "pants"
  | "joggers"
  | "leggings"
  | "shorts"
  | "skirt"
  | "sneakers"
  | "boots"
  | "heels"
  | "shoes"
  | "beanie"
  | "cap"
  | "hat"
  | "glasses"
  | "scarf"
  | "necklace"
  | "bag"
  | "watch";

export type Material = "knit" | "denim" | "leather" | "plain";

/** Reglas en orden: la primera que coincide con el nombre decide el tipo. */
const RULES: [RegExp, Kind][] = [
  [/gafas|lentes de sol|anteojos/, "glasses"],
  [/gorra\b|cachucha|visera/, "cap"],
  [/gorro|boina|beanie/, "beanie"],
  [/sombrero/, "hat"],
  [/bufanda|chal\b|pañoleta|pashmina|cuello de lana/, "scarf"],
  [/collar|cadena|colgante|gargantilla/, "necklace"],
  [/bolso|cartera|mochila|morral|carriel|bandolera/, "bag"],
  [/reloj|pulsera|manilla|brazalete/, "watch"],
  [/\bbota|botin|botín/, "boots"],
  [/tac[oó]n|tacones|sandalia|stiletto|plataforma/, "heels"],
  [/zapatilla|tenis|sneaker/, "sneakers"],
  [/zapato|mocas[ií]n|alpargata|baleta|calzado/, "shoes"],
  [/ruana|poncho/, "ruana"],
  [/abrigo|gabardina|trench/, "coat"],
  [/chaqueta|chamarra|campera|cazadora|blazer|chaleco/, "jacket"],
  [/vestido|enterizo/, "dress"],
  [/falda/, "skirt"],
  [/short|bermuda/, "shorts"],
  [/legg?ing|licra/, "leggings"],
  [/jogger|sudadera/, "joggers"],
  [/jean|denim|vaquer/, "jeans"],
  [/pantal[oó]n/, "pants"],
  [/hoodie|capucha/, "hoodie"],
  [/saco|su[eé]ter|sweater|jersey|buzo|cardigan|cárdigan/, "sweater"],
  [/camiseta|polo\b|t-?shirt|franela/, "tshirt"],
  [/camisa/, "shirt"],
  [/blusa|\btop\b|crop/, "blouse"],
];

export const ZONE_OF: Record<Kind, Zone> = {
  tshirt: "top",
  blouse: "top",
  shirt: "top",
  sweater: "top",
  hoodie: "top",
  jacket: "outer",
  coat: "outer",
  ruana: "outer",
  dress: "dress",
  jeans: "bottom",
  pants: "bottom",
  joggers: "bottom",
  leggings: "bottom",
  shorts: "bottom",
  skirt: "bottom",
  sneakers: "shoes",
  boots: "shoes",
  heels: "shoes",
  shoes: "shoes",
  beanie: "head",
  cap: "head",
  hat: "head",
  glasses: "face",
  scarf: "neck",
  necklace: "neck",
  bag: "hand",
  watch: "hand",
};

type Wearable = Pick<Product, "name" | "category"> & { tryOn?: Product["tryOn"] };

export const KIND_LABEL: Record<Kind, string> = {
  tshirt: "Camiseta",
  blouse: "Blusa",
  shirt: "Camisa",
  sweater: "Saco / suéter",
  hoodie: "Buzo con capucha",
  jacket: "Chaqueta",
  coat: "Abrigo",
  ruana: "Ruana / poncho",
  dress: "Vestido",
  jeans: "Jean",
  pants: "Pantalón",
  joggers: "Jogger / sudadera",
  leggings: "Leggings",
  shorts: "Short",
  skirt: "Falda",
  sneakers: "Tenis",
  boots: "Botas",
  heels: "Tacones / sandalias",
  shoes: "Zapatos",
  beanie: "Gorro",
  cap: "Gorra",
  hat: "Sombrero",
  glasses: "Gafas",
  scarf: "Bufanda",
  necklace: "Collar",
  bag: "Bolso",
  watch: "Reloj / pulsera",
};

const isKind = (k: unknown): k is Kind => typeof k === "string" && k in KIND_LABEL;

/** Tipo de prenda de un producto (null si no se puede vestir). */
export function kindOf(p: Wearable): Kind | null {
  if (isKind(p.tryOn?.kind)) return p.tryOn.kind;
  const n = p.name.toLowerCase();
  for (const [re, kind] of RULES) if (re.test(n)) return kind;
  const cat = p.category as string;
  if (cat === "Calzado") return "shoes";
  if (cat === "Ropa") return "tshirt";
  return null;
}

export const zoneOf = (p: Wearable): Zone | null => {
  const k = kindOf(p);
  return k ? ZONE_OF[k] : null;
};

export const isWearable = (p: Wearable) => kindOf(p) !== null;

export function materialOf(p: Pick<Product, "name" | "description">, kind: Kind): Material {
  const t = `${p.name} ${p.description ?? ""}`.toLowerCase();
  if (kind === "jeans" || /denim|jean/.test(p.name.toLowerCase())) return "denim";
  if (/cuero|piel\b|charol/.test(t)) return "leather";
  if (/lana|tejid|crochet|punto|ruana|alpaca/.test(t) || kind === "beanie") return "knit";
  return "plain";
}

/** Pestañas del selector. */
export type Tab = "superior" | "inferior" | "calzado" | "accesorios";
export const TABS: { id: Tab; label: string; icon: string; zones: Zone[] }[] = [
  { id: "superior", label: "Superior", icon: "fa-shirt", zones: ["top", "outer", "dress"] },
  { id: "inferior", label: "Inferior", icon: "fa-person-half-dress", zones: ["bottom"] },
  { id: "calzado", label: "Calzado", icon: "fa-shoe-prints", zones: ["shoes"] },
  {
    id: "accesorios",
    label: "Accesorios",
    icon: "fa-glasses",
    zones: ["head", "face", "neck", "hand"],
  },
];
export const tabOf = (z: Zone): Tab => TABS.find((t) => t.zones.includes(z))!.id;

export const ZONE_LABEL: Record<Zone, string> = {
  head: "Cabeza",
  face: "Gafas",
  neck: "Cuello",
  outer: "Abrigo",
  top: "Parte superior",
  dress: "Vestido",
  bottom: "Parte inferior",
  shoes: "Calzado",
  hand: "Bolso / reloj",
};

export type Look = Partial<Record<Zone, string>>;

/** Pone una prenda (o la quita si ya estaba). Un vestido reemplaza superior e inferior. */
export function toggleWear(look: Look, id: string, zone: Zone): Look {
  const next = { ...look };
  if (next[zone] === id) {
    delete next[zone];
    return next;
  }
  next[zone] = id;
  if (zone === "dress") {
    delete next.top;
    delete next.bottom;
  }
  if (zone === "top" || zone === "bottom") delete next.dress;
  return next;
}

/** "id1,id2" → look. */
export function parseLook(ids: string | undefined, products: Product[]): Look {
  let look: Look = {};
  for (const id of (ids ?? "").split(",").filter(Boolean)) {
    const p = products.find((x) => x.id === id);
    const zone = p && zoneOf(p);
    if (zone && look[zone] !== id) look = toggleWear(look, id, zone);
  }
  return look;
}

export const lookIds = (look: Look) => Object.values(look).filter(Boolean).join(",");

/* ---------- Color de la prenda ---------- */

const COLOR_WORDS: [RegExp, string][] = [
  [/azul (oscuro|marino|navy)|navy/, "#1f2f55"],
  [/celeste|azul claro/, "#8ab8e6"],
  [/vino|burdeos|borgo/, "#6e1f2c"],
  [/mostaza/, "#c9962b"],
  [/oliva|militar/, "#5f6338"],
  [/caqui|khaki/, "#b59a6a"],
  [/negr/, "#1f2229"],
  [/blanc/, "#f1f0eb"],
  [/gris/, "#8b9099"],
  [/roj/, "#b8322a"],
  [/azul/, "#2f5aa8"],
  [/verde/, "#2f7a4d"],
  [/amarill/, "#e3b52f"],
  [/naranja/, "#e07b2c"],
  [/rosad|rosa\b|fucsia/, "#e48aa6"],
  [/morad|lila|violeta/, "#7d4fa3"],
  [/caf[eé]|marr[oó]n|chocolate|cuero/, "#6b4429"],
  [/beige|crema|arena|hueso|natural|fique|lino/, "#d6c19c"],
  [/dorad/, "#c99a2e"],
  [/plateado/, "#b9bec7"],
];

/** Color elegido por la tienda o nombrado en el producto (los más fiables). */
export function colorFromName(
  p: Pick<Product, "name" | "description"> & { tryOn?: Product["tryOn"] },
): string | null {
  if (p.tryOn?.color && /^#[0-9a-f]{6}$/i.test(p.tryOn.color)) return p.tryOn.color;
  const t = p.name.toLowerCase();
  for (const [re, hex] of COLOR_WORDS) if (re.test(t)) return hex;
  const d = (p.description ?? "").toLowerCase();
  for (const [re, hex] of COLOR_WORDS) if (re.test(d)) return hex;
  return null;
}

export const DEFAULT_COLOR: Partial<Record<Kind, string>> = {
  jeans: "#3d5a80",
  sneakers: "#e9e7e2",
  boots: "#5a3a24",
  shoes: "#3a2a20",
  watch: "#c9a227",
  necklace: "#d4af37",
  glasses: "#1c1c1c",
};

/**
 * Color dominante de la foto: se ignoran el fondo blanco/gris claro y los bordes.
 * Devuelve null si la imagen no permite leer sus píxeles.
 */
export function dominantColor(data: Uint8ClampedArray, size: number): string | null {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  const m = Math.floor(size * 0.2);
  for (let y = m; y < size - m; y++)
    for (let x = m; x < size - m; x++) {
      const i = (y * size + x) * 4;
      const r = data[i]!,
        g = data[i + 1]!,
        b = data[i + 2]!,
        a = data[i + 3]!;
      if (a < 200) continue;
      const max = Math.max(r, g, b),
        min = Math.min(r, g, b);
      if (min > 222) continue; // fondo blanco
      if (max - min < 12 && min > 190) continue; // fondo gris claro
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const sat = max === 0 ? 0 : (max - min) / max;
      const w = 1 + sat; // los tonos saturados suelen ser la prenda
      const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      e.n += w;
      e.r += r * w;
      e.g += g * w;
      e.b += b * w;
      buckets.set(key, e);
    }
  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const e of buckets.values()) if (!best || e.n > best.n) best = e;
  if (!best) return null;
  const hex = (v: number) =>
    Math.round(v / best!.n)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(best.r)}${hex(best.g)}${hex(best.b)}`;
}
