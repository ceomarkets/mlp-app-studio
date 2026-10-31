import { describe, expect, it } from "vitest";
import type { Activity, Product } from "@/lib/backend";
import {
  buildLeaderboard,
  buildSections,
  buildTicker,
  temperatures,
  discountPct,
  isNew,
  relTime,
  tickerSymbol,
} from "@/lib/feed";

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
    promoCopy: "",
    promoImage: null,
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

describe("leaderboard", () => {
  const store2 = { slug: "s2", name: "S2", city: "Ipiales", emoji: "🥔" };
  const products = [
    prod("n", { createdAt: ago(1) }),
    prod("d", { compareAtPrice: 20000 }),
    prod("t", { soldCount: 40, rating: 4.2, ratingCount: 3 }),
    prod("r", { rating: 5, ratingCount: 9, store: store2 }),
    prod("x", { stock: 0, compareAtPrice: 50000 }),
  ];
  const activity: Activity[] = [
    { productId: "r", productName: "r", productEmoji: "📦", city: "Pasto", qty: 3, paidAt: ago(1) },
  ];

  it("cada filtro devuelve su tabla y excluye agotados", () => {
    expect(buildLeaderboard(products, activity, "new", now).map((i) => i.key)).toEqual(["new-n"]);
    expect(buildLeaderboard(products, activity, "deals", now)[0]).toMatchObject({ badge: "−50%" });
    expect(buildLeaderboard(products, activity, "top", now)[0]).toMatchObject({
      metric: "40 vendidos",
    });
    expect(buildLeaderboard(products, activity, "rated", now).map((i) => i.key)).toEqual([
      "rated-r",
      "rated-t",
    ]);
  });

  it("comisiones: mayor % para el afiliado primero, con lo que gana en pesos", () => {
    const list = [
      prod("a", { price: 100000, commission: 0.1 }),
      prod("b", { price: 50000, commission: 0.2 }),
      prod("c", { price: 200000, commission: 0.1 }),
    ];
    const earn = buildLeaderboard(list, [], "earn", now);
    expect(earn.map((i) => i.key)).toEqual(["earn-b", "earn-c", "earn-a"]);
    expect(earn[0]).toMatchObject({ badge: "Gana 20%" });
    expect(earn[0]!.metric).toContain("10.000");
  });

  it("la mejor tienda de la semana sale de las ventas de 7 días", () => {
    const [first] = buildLeaderboard(products, activity, "stores", now);
    expect(first).toMatchObject({ kind: "store", rank: 1, metric: "3 ventas esta semana" });
  });

  it("'todo' intercala tipos", () => {
    const kinds = buildLeaderboard(products, activity, "all", now).map((i) => i.filter);
    expect(kinds.slice(0, 6)).toEqual(["deals", "earn", "top", "new", "stores", "rated"]);
  });
});

describe("temperatura", () => {
  it("el más popular marca 200° y las ventas de la semana pesan más", () => {
    const list = [prod("old", { soldCount: 20 }), prod("hot", { soldCount: 5 }), prod("cold")];
    const week: Activity[] = [
      {
        productId: "hot",
        productName: "h",
        productEmoji: "📦",
        city: "Pasto",
        qty: 4,
        paidAt: ago(2),
      },
      {
        productId: "old",
        productName: "o",
        productEmoji: "📦",
        city: "Pasto",
        qty: 9,
        paidAt: ago(30),
      },
    ];
    const t = temperatures(list, week, now);
    expect(t.get("hot")).toBe(200);
    expect(t.get("old")).toBe(160);
    expect(t.get("cold")).toBe(0);
  });
});
