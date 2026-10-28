import { beforeEach, describe, expect, it } from "vitest";
import { demoBackend as b, resetDemo } from "@/lib/backend/demo";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/backend/seed";

const ship = { name: "Ana", phone: "3001234567", city: "Pasto", address: "Cra 24 # 18-30" };

describe("backend demo: flujo completo", () => {
  beforeEach(() => {
    localStorage.clear();
    resetDemo();
  });

  it("catálogo, búsqueda y orden", async () => {
    expect((await b.listProducts()).length).toBe(8);
    expect((await b.listProducts({ q: "café" })).map((p) => p.id)).toContain("p3");
    const byPrice = await b.listProducts({ sort: "price-asc" });
    expect(byPrice[0]!.price).toBeLessThanOrEqual(byPrice[1]!.price);
  });

  it("la cuenta demo tiene saldo disponible para retirar", async () => {
    await b.signIn({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    const w = await b.wallet();
    expect(w.available).toBeGreaterThanOrEqual(50000);
    expect(w.pending).toBeGreaterThan(0);
  });

  it("vendedor nuevo → producto → compra referida → pago → entrega", async () => {
    await b.signUp({ email: "nueva@tienda.co", password: "secreto1", fullName: "Nueva Vendedora" });
    await b.saveStore({
      slug: "la-nueva",
      name: "La Nueva",
      tagline: "",
      city: "Pasto",
      emoji: "🌽",
      whatsapp: null,
    });
    const p = await b.saveProduct({
      name: "Mochila",
      description: "",
      price: 100000,
      category: "Artesanías",
      commission: 0.15,
      stock: 3,
      images: [],
      emoji: "🎒",
      active: true,
    });
    await expect(
      b.saveStore({
        slug: "tejidos-galeras",
        name: "X",
        tagline: "",
        city: "",
        emoji: "x",
        whatsapp: null,
      }),
    ).rejects.toThrow(/en uso/);

    await b.signOut();
    await b.signUp({ email: "cliente@x.co", password: "secreto1", fullName: "Cliente" });
    await expect(b.createOrder([{ productId: p.id, qty: 5 }], "laura", ship)).rejects.toThrow(
      /stock/,
    );
    const order = await b.createOrder(
      [
        { productId: p.id, qty: 1 },
        { productId: p.id, qty: 1 },
      ],
      "laura",
      ship,
    );
    expect(order.total).toBe(200000);
    await b.simulatePayment!(order.orderId, true);
    const o = await b.getOrder(order.orderId);
    expect(o?.status).toBe("paid");
    expect(o?.items[0]).toMatchObject({
      qty: 2,
      sellerAmount: 152000,
      affiliateAmount: 30000,
      platformAmount: 18000,
    });
    expect((await b.getProduct(p.id))?.stock).toBe(1);

    await b.signOut();
    await b.signIn({ email: "nueva@tienda.co", password: "secreto1" });
    const [sale] = await b.sellerOrders();
    expect(sale?.shipping.city).toBe("Pasto");
    await b.setFulfillment(sale!.id, "delivered");
    const w = await b.wallet();
    expect(w).toEqual({ pending: 152000, available: 0, withdrawn: 0 }); // retenido 7 días
    await expect(b.requestWithdrawal(60000, "nequi", "3001234567")).rejects.toThrow(/insuficiente/);
  });

  it("no hay autorreferidos ni clics propios", async () => {
    await b.signIn({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    const before = (await b.myClicks()).length;
    await b.trackClick("laura", "p1");
    expect((await b.myClicks()).length).toBe(before);
    const order = await b.createOrder([{ productId: "p3", qty: 1 }], "laura", ship);
    await b.simulatePayment!(order.orderId, true);
    expect((await b.getOrder(order.orderId))?.items[0]?.affiliateAmount).toBe(0);
  });

  it("pago rechazado no descuenta stock", async () => {
    await b.signIn({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    const stock = (await b.getProduct("p5"))!.stock;
    const order = await b.createOrder([{ productId: "p5", qty: 1 }], null, ship);
    await b.simulatePayment!(order.orderId, false);
    expect((await b.getOrder(order.orderId))?.status).toBe("failed");
    expect((await b.getProduct("p5"))?.stock).toBe(stock);
  });
});
