import { describe, expect, it } from "vitest";
import { clampCommission, splitSale } from "@/lib/plaza";
import { roleOf, ROLES, sellerPanelLabel, spaces, storeKindFor } from "@/lib/roles";

describe("registro general", () => {
  it("tres tipos: 1 compra y venta, 2 afiliados, 3 empresas", () => {
    expect(ROLES.map((r) => [r.n, r.label])).toEqual([
      [1, "Compra y venta"],
      [2, "Afiliados"],
      [3, "Empresas"],
    ]);
  });

  it("1. Compra y venta: compra y puede abrir su tienda como persona", () => {
    expect(spaces("comprador", false)).toEqual({ sells: false, canSell: true, promotes: false });
    expect(spaces("comprador", true).sells).toBe(true);
    expect(storeKindFor("comprador")).toBe("persona");
    expect(sellerPanelLabel("comprador")).toBe("Mi tienda");
    expect(roleOf("comprador").home).toBeNull();
  });

  it("2. Afiliados: su panel; no vende salvo que abra tienda", () => {
    expect(spaces("afiliado", false)).toEqual({ sells: false, canSell: false, promotes: true });
    expect(roleOf("afiliado").home).toBe("/afiliados");
    // Quien eligió usuario de afiliado también promociona.
    expect(spaces("comprador", false, true).promotes).toBe(true);
  });

  it("3. Empresas: panel de empresa", () => {
    expect(spaces("empresa", false).sells).toBe(true);
    expect(storeKindFor("empresa")).toBe("empresa");
    expect(sellerPanelLabel("empresa")).toBe("Panel Empresa");
    expect(roleOf("empresa").home).toBe("/vendedores");
  });

  it("venta directa: sin comisión de afiliado", () => {
    expect(clampCommission(0)).toBe(0);
    expect(clampCommission(0.01)).toBe(0.03);
    expect(splitSale(100000, 0)).toEqual({ seller: 91000, affiliate: 0, platform: 9000 });
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
