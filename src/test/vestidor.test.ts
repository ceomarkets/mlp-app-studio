import { describe, expect, it } from "vitest";
import { EXAMPLE_ALL } from "@/lib/examples";
import { BODIES, curve, garmentFor, palette, sym, xAt } from "@/lib/outfit";
import {
  colorFromName,
  dominantColor,
  kindOf,
  lookIds,
  parseLook,
  toggleWear,
  zoneOf,
  type Kind,
} from "@/lib/vestidor";

const p = (
  name: string,
  category: string,
  tryOn: { kind: string | null; color: string | null } | null = null,
) => ({ name, category, description: "", tryOn }) as never;

describe("vestidor virtual: prendas", () => {
  it("reconoce el tipo de prenda y su zona", () => {
    expect(kindOf(p("Ruana de lana virgen", "Ropa"))).toBe("ruana");
    expect(kindOf(p("Jean clásico azul", "Ropa"))).toBe("jeans");
    expect(kindOf(p("Zapatillas Pro Runner", "Calzado"))).toBe("sneakers");
    expect(kindOf(p("Gorro tejido andino", "Ropa"))).toBe("beanie");
    expect(kindOf(p("Bolso tejido en fique", "Artesanías"))).toBe("bag");
    expect(kindOf(p("Silla Gamer Ergonómica", "Accesorios"))).toBeNull();
    expect(kindOf(p("Café especial", "Alimentos"))).toBeNull();
    expect(zoneOf(p("Chaqueta Térmica", "Ropa"))).toBe("outer");
  });

  it("respeta el tipo y color que eligió la tienda", () => {
    const x = p("Prenda nueva", "Ropa", { kind: "dress", color: "#aa3344" });
    expect(kindOf(x)).toBe("dress");
    expect(colorFromName(x)).toBe("#aa3344");
    expect(kindOf(p("Prenda", "Ropa", { kind: "inventado", color: null }))).toBe("tshirt");
    expect(colorFromName(p("Bufanda de lana gris", "Ropa"))).toBe("#8b9099");
  });

  it("un vestido reemplaza la parte superior y la inferior", () => {
    let look = toggleWear({}, "a", "top");
    look = toggleWear(look, "b", "bottom");
    look = toggleWear(look, "c", "dress");
    expect(look).toEqual({ dress: "c" });
    expect(toggleWear(look, "c", "dress")).toEqual({});
  });

  it("arma y comparte un look por ids", () => {
    const look = parseLook("ejemplo-1,ejemplo-3,ejemplo-4", EXAMPLE_ALL);
    expect(look).toEqual({ shoes: "ejemplo-1", outer: "ejemplo-3" });
    expect(lookIds(look).split(",").sort()).toEqual(["ejemplo-1", "ejemplo-3"]);
  });

  it("lee el color de la prenda ignorando el fondo blanco", () => {
    const size = 10;
    const data = new Uint8ClampedArray(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      const x = i % size,
        y = Math.floor(i / size);
      const inside = x >= 3 && x < 7 && y >= 3 && y < 7;
      data.set(inside ? [200, 30, 40, 255] : [250, 250, 250, 255], i * 4);
    }
    expect(dominantColor(data, size)).toBe("#c81e28");
  });
});

describe("vestidor virtual: moldes ajustados al cuerpo", () => {
  it("traza curvas cerradas y simétricas", () => {
    expect(
      curve([
        [0, 0],
        [10, 0],
        [10, 10],
      ]),
    ).toMatch(/^M0 0 C.* Z$/);
    expect(
      sym([
        [150, 0],
        [100, 50],
        [150, 100],
      ]),
    ).toContain("200");
    expect(
      xAt(
        [
          [0, 0],
          [10, 10],
        ],
        5,
      ),
    ).toBe(5);
  });

  it("cada tipo de prenda tiene molde para mujer y hombre", () => {
    const kinds: Kind[] = [
      "tshirt",
      "shirt",
      "hoodie",
      "jacket",
      "coat",
      "ruana",
      "dress",
      "jeans",
      "skirt",
      "shorts",
      "sneakers",
      "boots",
      "heels",
      "beanie",
      "cap",
      "hat",
      "glasses",
      "scarf",
      "bag",
      "watch",
    ];
    for (const g of ["mujer", "hombre"] as const)
      for (const k of kinds) {
        const m = garmentFor(k, g);
        expect(m.shapes.length + m.seams.length, `${k}/${g}`).toBeGreaterThan(0);
        expect(
          m.shapes.every((s) => !s.d.includes("NaN")),
          `${k}/${g}`,
        ).toBe(true);
      }
  });

  it("el pantalón sigue las piernas del modelo (hasta el tobillo)", () => {
    for (const g of ["mujer", "hombre"] as const) {
      const d = garmentFor("jeans", g).shapes[0]!.d;
      const ys = [...d.matchAll(/[\d.]+ ([\d.]+)(?= C| Z|$)/g)].map((m) => Number(m[1]));
      expect(Math.max(...ys)).toBeGreaterThan(BODIES[g].ko[1]);
      expect(Math.max(...ys)).toBeLessThanOrEqual(BODIES[g].ao[1]);
    }
  });

  it("las costuras contrastan con telas oscuras y claras", () => {
    expect(palette("#111111").seam).not.toBe(palette("#eeeeee").seam);
  });
});

describe("vestidor virtual: prendas con material en el nombre", () => {
  it("una chaqueta de jean es chaqueta (con tela denim), no pantalón", () => {
    expect(kindOf({ name: "Chaqueta de jean azul", category: "Ropa" } as never)).toBe("jacket");
  });
});
