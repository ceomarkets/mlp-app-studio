import { describe, expect, it } from "vitest";
import { isHeadwear, lookIds, parseLook, slotOf } from "@/lib/vestidor";
import { EXAMPLE_ALL } from "@/lib/examples";

const p = (name: string, category: string) => ({ name, category }) as never;

describe("vestidor virtual", () => {
  it("ubica cada prenda en su zona", () => {
    expect(slotOf(p("Ruana de lana virgen", "Ropa"))).toBe("top");
    expect(slotOf(p("Jean clásico", "Ropa"))).toBe("bottom");
    expect(slotOf(p("Zapatillas Pro Runner", "Calzado"))).toBe("shoes");
    expect(slotOf(p("Gorro tejido andino", "Ropa"))).toBe("accessory");
    expect(slotOf(p("Bolso en fique", "Artesanías"))).toBe("accessory");
    expect(slotOf(p("Silla Gamer Ergonómica", "Accesorios"))).toBeNull();
    expect(slotOf(p("Café especial", "Alimentos"))).toBeNull();
    expect(isHeadwear(p("Gorro tejido", "Ropa"))).toBe(true);
  });

  it("arma y comparte un look por ids", () => {
    const look = parseLook("ejemplo-1,ejemplo-3,ejemplo-4", EXAMPLE_ALL);
    expect(look).toEqual({ shoes: "ejemplo-1", top: "ejemplo-3" });
    expect(lookIds(look).split(",").sort()).toEqual(["ejemplo-1", "ejemplo-3"]);
  });
});
