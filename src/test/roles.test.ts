import { describe, expect, it } from "vitest";
import { buildLink, statsBy } from "@/lib/affiliate-links";
import type { Click, OrderItem } from "@/lib/backend";
import { clampCommission, splitSale } from "@/lib/plaza";
import { roleOf, ROLES, sellerPanelLabel, spaces, storeKindFor } from "@/lib/roles";

describe("roles por puerta de entrada", () => {
  it("comprador, afiliado y empresa", () => {
    expect(ROLES.map((r) => [r.id, r.home])).toEqual([
      ["comprador", null],
      ["afiliado", "/afiliados"],
      ["empresa", "/vendedores"],
    ]);
  });

  it("el comprador solo compra", () => {
    expect(spaces("comprador", false)).toEqual({ sells: false, promotes: false });
    expect(roleOf(undefined).id).toBe("comprador");
  });

  it("afiliado: promociona; también quien eligió usuario", () => {
    expect(spaces("afiliado", false)).toEqual({ sells: false, promotes: true });
    expect(spaces("comprador", false, true).promotes).toBe(true);
  });

  it("empresa o emprendimiento: vende en su tienda", () => {
    expect(spaces("empresa", false).sells).toBe(true);
    expect(storeKindFor("empresa")).toBe("empresa");
    expect(sellerPanelLabel("empresa", "empresa")).toBe("Panel Empresa");
    expect(sellerPanelLabel("empresa", "persona")).toBe("Mi emprendimiento");
  });

  it("venta directa: sin comisión de afiliado", () => {
    expect(clampCommission(0)).toBe(0);
    expect(clampCommission(0.01)).toBe(0.03);
    expect(splitSale(100000, 0)).toEqual({ seller: 91000, affiliate: 0, platform: 9000 });
  });
});

describe("enlaces de afiliado", () => {
  const o = "https://plazax.co";
  it("arma enlaces con canal", () => {
    expect(buildLink(o, "laura", { kind: "product", id: "p1" }, "instagram")).toBe(
      "https://plazax.co/r/laura/p1?src=instagram",
    );
    expect(buildLink(o, "laura", { kind: "store", slug: "ruanas" }, "Whats App!")).toBe(
      "https://plazax.co/tienda/ruanas?ref=laura&src=whatsapp",
    );
    expect(buildLink(o, "laura", { kind: "plaza" })).toBe("https://plazax.co/?ref=laura");
  });

  it("clics, ventas, conversión y comisión por canal", () => {
    const c = (source: string | null, productId = "p1"): Click => ({
      id: Math.random().toString(),
      productId,
      createdAt: "",
      source,
    });
    const item = (refSource: string | null, amt: number, paid = true) =>
      ({
        productId: "p1",
        refSource,
        affiliateAmount: amt,
        paidAt: paid ? "2026-11-01" : null,
        refundedAt: null,
      }) as OrderItem;
    const rows = statsBy(
      [c("instagram"), c("instagram"), c("instagram"), c("instagram"), c(null)],
      [item("instagram", 5000), item("instagram", 1000, false)],
      "source",
    );
    expect(rows[0]).toEqual({
      key: "instagram",
      clicks: 4,
      sales: 1,
      conversion: 0.25,
      earned: 5000,
    });
    expect(rows[1]).toMatchObject({ key: "", clicks: 1, sales: 0 });
    const byProduct = statsBy([c(null), c(null, "p2")], [item(null, 3000)], "product");
    expect(byProduct.map((r) => [r.key, r.clicks, r.sales])).toEqual([
      ["p1", 1, 1],
      ["p2", 1, 0],
    ]);
  });
});

describe("contacto por WhatsApp", () => {
  it("acepta celulares colombianos", async () => {
    const { waNumber } = await import("@/lib/plaza");
    expect(waNumber("300 123 4567")).toBe("573001234567");
    expect(waNumber("+57 300-123-4567")).toBe("573001234567");
    expect(waNumber("6027201234")).toBeNull();
    expect(waNumber(null)).toBeNull();
  });
});
