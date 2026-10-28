import { describe, expect, it } from "vitest";
import type { Activity, Product } from "@/lib/backend";
import { buildSections, buildTicker, discountPct, isNew, relTime, tickerSymbol } from "@/lib/feed";

const now = Date.parse("2026-10-28T12:00:00Z");
const ago = (d: number) => new Date(now - d * 86_400_000).toISOString();

function prod(id: string, over: Partial<Product> = {}): Product {
  return {
    id,
    storeId: "s",
    name: `Producto ${id}`,
    description: "",
    price: 10000,
    compareAtPrice: null,
    category: "Ropa",
    commission: 0.1,
    stock: 10,
    images: [],
    emoji: "📦",
    active: true,
    soldCount: 0,
    rating: 0,
    ratingCount: 0,
    createdAt: ago(60),
    store: { slug: "s", name: "S", city: "Pasto", emoji: "🛍️" },
    ...over,
  };
}

describe("feed", () => {
  it("calcula el descuento solo si el precio antes es mayor", () => {
    expect(discountPct({ price: 80, compareAtPrice: 100 })).toBe(20);
    expect(discountPct({ price: 100, compareAtPrice: 100 })).toBe(0);
    expect(discountPct({ price: 100, compareAtPrice: null })).toBe(0);
  });

  it("marca novedades de los últimos 14 días", () => {
    expect(isNew({ createdAt: ago(3) }, now)).toBe(true);
    expect(isNew({ createdAt: ago(20) }, now)).toBe(false);
  });

  it("formatea tiempo relativo y símbolos", () => {
    expect(relTime(new Date(now - 5 * 60_000).toISOString(), now)).toBe("hace 5 min");
    expect(relTime(ago(1), now)).toBe("ayer");
    expect(tickerSymbol("Café especial 500 g")).toBe("CAFE");
  });

  it("la banda intercala tipos y no incluye agotados", () => {
    const products = [
      prod("a", { compareAtPrice: 20000 }),
      prod("b", { createdAt: ago(2) }),
      prod("c", { soldCount: 50 }),
      prod("d", { stock: 2 }),
      prod("e", { compareAtPrice: 30000, stock: 0 }),
    ];
    const activity: Activity[] = [
      {
        productId: "c",
        productName: "c",
        productEmoji: "📦",
        city: "Cali",
        qty: 1,
        paidAt: ago(0.01),
      },
    ];
    const t = buildTicker(products, activity, now);
    expect(t.map((x) => x.kind).slice(0, 5)).toEqual(["deal", "sale", "new", "hot", "low"]);
    expect(t.some((x) => x.productId === "e" && x.kind === "deal")).toBe(false);
    expect(t.find((x) => x.kind === "sale")?.value).toBe("Vendido en Cali");
  });

  it("'Para ti' prioriza categorías de interés y no repite lo ya visto", () => {
    const products = [
      prod("r1", { category: "Ropa" }),
      prod("r2", { category: "Ropa" }),
      prod("c1", { category: "Campo", soldCount: 999 }),
    ];
    const s = buildSections(products, { viewed: ["r1"], favorites: [], cart: [] }, now);
    expect(s.forYou[0]!.id).toBe("r2");
    expect(s.viewed.map((p) => p.id)).toEqual(["r1"]);
    expect(buildSections(products, { viewed: [], favorites: [], cart: [] }, now).forYou).toEqual(
      [],
    );
  });
});
