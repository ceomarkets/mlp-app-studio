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
      shipsNational: true,
      requireApproval: false,
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
      compareAtPrice: null,
      promoCopy: "",
      promoImage: null,
      promoVideo: null,
    });
    await expect(
      b.saveStore({
        slug: "tejidos-galeras",
        name: "X",
        tagline: "",
        city: "",
        emoji: "x",
        whatsapp: null,
        shipsNational: true,
        requireApproval: false,
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
    await expect(b.setFulfillment(sale!.id, "delivered" as never)).rejects.toThrow(/inválido/);
    await b.setFulfillment(sale!.id, "shipped", "9841203", "Servientrega");
    const w = await b.wallet();
    expect(w).toEqual({ pending: 152000, available: 0, withdrawn: 0, frozen: 0 }); // retenido
    await expect(b.requestWithdrawal(60000, "nequi", "3001234567")).rejects.toThrow(/insuficiente/);
  });

  it("disputa: congela el pago, reembolsa y suspende al vendedor", async () => {
    await b.signUp({ email: "v@x.co", password: "secreto1", fullName: "Vendedor" });
    await b.saveStore({
      slug: "dudosa",
      name: "Dudosa",
      tagline: "",
      city: "Pasto",
      emoji: "🛍️",
      whatsapp: null,
      shipsNational: true,
      requireApproval: false,
    });
    const p = await b.saveProduct({
      name: "Reloj",
      description: "",
      price: 100000,
      category: "Artesanías",
      commission: 0.1,
      stock: 5,
      images: [],
      emoji: "⌚",
      active: true,
      compareAtPrice: null,
      promoCopy: "",
      promoImage: null,
      promoVideo: null,
    });
    await b.signOut();
    await b.signUp({ email: "c@x.co", password: "secreto1", fullName: "Cliente" });
    const order = await b.createOrder([{ productId: p.id, qty: 1 }], null, ship);
    await b.simulatePayment!(order.orderId, true);
    const item = (await b.getOrder(order.orderId))!.items[0]!;
    await expect(
      b.openDispute(item.id, { reason: "different", details: "corto", evidence: [] }),
    ).rejects.toThrow(/mínimo/);
    await b.openDispute(item.id, {
      reason: "different",
      details: "Llegó un reloj distinto al de la foto",
      evidence: ["https://x.co/foto.jpg"],
    });
    await expect(
      b.openDispute(item.id, {
        reason: "damaged",
        details: "Otra disputa sobre lo mismo",
        evidence: [],
      }),
    ).rejects.toThrow(/abierta/);
    await expect(b.confirmReceipt(item.id)).rejects.toThrow(/confirmar/); // aún sin despachar

    await b.signOut();
    await b.signIn({ email: "v@x.co", password: "secreto1" });
    expect((await b.wallet()).frozen).toBe(91000);
    const [d] = await b.storeDisputes();
    await b.respondDispute(d!.id, "Enviamos el correcto, adjunto guía");
    await expect(b.resolveDispute(d!.id, "refund", "x", false)).rejects.toThrow(/administradores/);

    await b.signOut();
    await b.signIn({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    await b.resolveDispute(d!.id, "refund", "Fotos confirman la diferencia", true);
    expect((await b.allDisputes()).find((x) => x.id === d!.id)?.status).toBe("refunded");
    expect((await b.getProduct(p.id))?.stock).toBe(5);
    expect((await b.listStores()).some((s) => s.slug === "dudosa")).toBe(false);
    expect((await b.disputeAudit(d!.id))?.reporterEmail).toBe("c@x.co");

    await b.signOut();
    await b.signIn({ email: "v@x.co", password: "secreto1" });
    expect(await b.wallet()).toMatchObject({ frozen: 0, pending: 0 });
  });

  it("tienda con aprobación: sin aprobar no hay comisión", async () => {
    await b.signUp({ email: "t@x.co", password: "secreto1", fullName: "Tienda" });
    await b.saveStore({
      slug: "selecta",
      name: "Selecta",
      tagline: "",
      city: "Pasto",
      emoji: "🛍️",
      whatsapp: null,
      shipsNational: true,
      requireApproval: true,
    });
    const p = await b.saveProduct({
      name: "Bolso",
      description: "",
      price: 100000,
      category: "Artesanías",
      commission: 0.1,
      stock: 9,
      images: [],
      emoji: "👜",
      active: true,
      compareAtPrice: null,
      promoCopy: "",
      promoImage: null,
      promoVideo: "https://youtu.be/demo",
    });
    await b.signOut();
    await b.signUp({ email: "c2@x.co", password: "secreto1", fullName: "Cliente" });
    const o1 = await b.createOrder([{ productId: p.id, qty: 1 }], "laura", ship);
    expect((await b.getOrder(o1.orderId))!.items[0]).toMatchObject({
      affiliateId: null,
      affiliateAmount: 0,
      sellerAmount: 91000,
    });
    await b.signOut();
    await b.signIn({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    expect(await b.requestAffiliation("selecta", "Hola")).toBe("pending");
    await b.signOut();
    await b.signIn({ email: "t@x.co", password: "secreto1" });
    const [req] = await b.storeAffiliateRequests();
    expect(req).toMatchObject({ username: "laura", status: "pending" });
    await b.decideAffiliation(req!.id, true);
    await b.signOut();
    await b.signIn({ email: "c2@x.co", password: "secreto1" });
    const o2 = await b.createOrder([{ productId: p.id, qty: 1 }], "laura", ship);
    expect((await b.getOrder(o2.orderId))!.items[0]!.affiliateAmount).toBe(10000);
  });

  it("cupón real: valida, aplica una vez y respeta el mínimo", async () => {
    await b.signUp({ email: "cup@x.co", password: "secreto1", fullName: "Cupón" });
    expect(await b.activeFlashSale()).toMatchObject({ couponCode: "BIENVENIDA" });
    await expect(b.checkCoupon("NOEXISTE")).rejects.toThrow(/no válido/);
    expect((await b.checkCoupon("bienvenida")).value).toBe(5);
    // p4 = Kit barista 120.000 → 5% = 6.000
    const o = await b.createOrder([{ productId: "p4", qty: 1 }], null, ship, "BIENVENIDA");
    const order = await b.getOrder(o.orderId);
    expect(order).toMatchObject({ total: 114000, couponDiscount: 6000 });
    await expect(b.checkCoupon("BIENVENIDA")).rejects.toThrow(/Ya usaste/);
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

  it("descuento por volumen: 3 unidades pagan 5% menos y Plaza X lo absorbe", async () => {
    await b.signIn({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    const two = await b.createOrder([{ productId: "p3", qty: 2 }], null, ship);
    expect(two.total).toBe(76000);
    const three = await b.createOrder(
      [
        { productId: "p3", qty: 2 },
        { productId: "p7", qty: 1 },
      ],
      null,
      ship,
    );
    expect(three.total).toBe(Math.round((76000 + 28000) * 0.95));
    const o = await b.getOrder(three.orderId);
    expect(o?.discount).toBe(5200);
    const cafe = o!.items.find((i) => i.productId === "p3")!;
    expect(cafe).toMatchObject({ sellerAmount: 69160, discountAmount: 3800, platformAmount: 3040 });
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
