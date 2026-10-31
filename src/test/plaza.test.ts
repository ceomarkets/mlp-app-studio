import { describe, expect, it } from "vitest";
import { computeWallet, dailySeries, HOLD_DAYS, slugify, splitSale } from "@/lib/plaza";

const DAY = 86_400_000;

describe("splitSale", () => {
  it("reparte $100.000 con 10% afiliado como 81k/10k/9k", () => {
    expect(splitSale(100000, 0.1)).toEqual({ seller: 81000, affiliate: 10000, platform: 9000 });
  });
  it("limita la comisión de afiliado al 20%", () => {
    expect(splitSale(100000, 0.5).affiliate).toBe(20000);
  });
  it("aplica mínimo 3% de comisión de afiliado", () => {
    expect(splitSale(100000, 0.01).affiliate).toBe(3000);
  });
  it("sin referido, el vendedor recibe 91k", () => {
    expect(splitSale(100000, 0.1, false).seller).toBe(91000);
  });
  it("las tres partes siempre suman el total", () => {
    for (const amount of [1000, 38000, 45000 * 3, 1234567]) {
      const s = splitSale(amount, 0.137);
      expect(s.seller + s.affiliate + s.platform).toBe(amount);
    }
  });
});

describe("computeWallet", () => {
  const now = Date.parse("2026-10-28T12:00:00Z");
  const iso = (d: number) => new Date(now - d * DAY).toISOString();

  it("retiene lo entregado hace menos de 7 días y libera lo anterior", () => {
    const w = computeWallet(
      [
        { amount: 100, paidAt: iso(20), fulfillment: "delivered", deliveredAt: iso(HOLD_DAYS + 1) },
        { amount: 50, paidAt: iso(5), fulfillment: "delivered", deliveredAt: iso(2) },
        { amount: 30, paidAt: iso(1), fulfillment: "shipped", deliveredAt: null },
        { amount: 999, paidAt: null, fulfillment: "pending", deliveredAt: null },
        { amount: 999, paidAt: iso(3), fulfillment: "cancelled", deliveredAt: null },
      ],
      40,
      now,
    );
    expect(w).toEqual({ pending: 80, available: 60, withdrawn: 40, frozen: 0 });
  });
});

describe("utilidades", () => {
  it("slugify quita tildes y símbolos", () => {
    expect(slugify("  Café de Altura · Nariño! ")).toBe("cafe-de-altura-narino");
  });
  it("dailySeries agrupa por día", () => {
    const now = Date.parse("2026-10-28T15:00:00");
    const s = dailySeries(
      [
        { at: new Date(now).toISOString() },
        { at: new Date(now).toISOString() },
        { at: new Date(now - DAY).toISOString() },
      ],
      (r) => r.at,
      () => 1,
      7,
      now,
    );
    expect(s).toHaveLength(7);
    expect(s.at(-1)!.value).toBe(2);
    expect(s.at(-2)!.value).toBe(1);
  });
});

describe("affiliateLevel", () => {
  it("sube de nivel con ventas reales", async () => {
    const { affiliateLevel } = await import("@/lib/plaza");
    expect(affiliateLevel(0)).toMatchObject({ name: "Principiante", missing: 10 });
    expect(affiliateLevel(23)).toMatchObject({ name: "Activo", missing: 27 });
    expect(affiliateLevel(78)).toMatchObject({ name: "Líder", missing: 22 });
    expect(affiliateLevel(150)).toMatchObject({ name: "Leyenda", next: null, progress: 1 });
  });
});
