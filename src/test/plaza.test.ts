import { describe, expect, it } from "vitest";
import { splitSale } from "@/lib/plaza";

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
});
