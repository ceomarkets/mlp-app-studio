import { daysAgo, splitSale, type PayoutMethod } from "@/lib/plaza";
import type {
  AccountType,
  AffiliateStatus,
  Announcement,
  Click,
  Dispute,
  Order,
  OrderItem,
  Product,
  Review,
  Store,
  Withdrawal,
} from "./types";

export type DemoUser = {
  id: string;
  email: string;
  password: string;
  fullName: string;
  username: string | null;
  phone: string | null;
  accountType?: AccountType;
  payoutMethod?: PayoutMethod | null;
};

export type DemoAffiliation = {
  id: string;
  storeId: string;
  affiliateId: string;
  status: AffiliateStatus;
  message: string | null;
  createdAt: string;
};

export type DemoState = {
  version: 1;
  session: string | null;
  users: DemoUser[];
  stores: Store[];
  products: Omit<Product, "store">[];
  orders: Omit<Order, "items">[];
  items: OrderItem[];
  clicks: (Click & { affiliateId: string })[];
  withdrawals: (Withdrawal & { userId: string })[];
  reviews: (Review & { userId: string })[];
  /** Anuncios de la plataforma (agregado después: puede faltar en datos viejos). */
  announcements?: Announcement[];
  /** Usuarios que pueden publicar anuncios. */
  admins?: string[];
  disputes?: (Dispute & { ip: string | null })[];
  affiliations?: DemoAffiliation[];
  /** Usuarios suspendidos. */
  banned?: string[];
  /** Archivos de evidencia del modo demo (referencia → data URL). */
  evidenceFiles?: Record<string, string>;
};

/** La cuenta demo administra los anuncios para poder probar la pantalla. */
export const DEMO_ADMINS = ["u-demo"];

export function seedAnnouncements(now = Date.now()): Announcement[] {
  const base = { image: null, active: true, endsAt: null as string | null };
  return [
    {
      ...base,
      id: "a-fundadoras",
      title: "Tiendas fundadoras: 0% de comisión",
      body: "Abre tu tienda este mes y no pagas comisión de la plataforma.",
      emoji: "🎉",
      link: "/vendedores",
      cta: "Abrir mi tienda",
      tone: "promo",
      priority: 90,
      startsAt: daysAgo(3, now),
      endsAt: daysAgo(-27, now),
      createdAt: daysAgo(3, now),
    },
    {
      ...base,
      id: "a-feria",
      title: "Feria artesanal de Pasto este sábado",
      body: "Barniz, tejidos y café de la región. ¡Te esperamos!",
      emoji: "🎪",
      link: "/tienda/barniz-pasto",
      cta: "Ver artesanías",
      tone: "event",
      priority: 70,
      startsAt: daysAgo(1, now),
      createdAt: daysAgo(1, now),
    },
    {
      ...base,
      id: "a-afiliados",
      title: "Comparte y gana hasta 20%",
      body: "Elige un producto, comparte tu enlace y cobra en Nequi.",
      emoji: "💸",
      link: "/afiliados",
      cta: "Activar mi enlace",
      tone: "news",
      priority: 50,
      startsAt: daysAgo(5, now),
      createdAt: daysAgo(5, now),
    },
    {
      ...base,
      id: "a-pausado",
      title: "Mantenimiento programado",
      body: "Este anuncio está pausado: no se muestra al público.",
      emoji: "🛠️",
      link: null,
      cta: "Ver más",
      tone: "info",
      priority: 10,
      active: false,
      startsAt: daysAgo(2, now),
      createdAt: daysAgo(2, now),
    },
  ];
}

export const DEMO_EMAIL = "demo@plazax.co";
export const DEMO_PASSWORD = "demo1234";

/** Generador pseudoaleatorio determinista para que la demo se vea igual siempre. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildSeed(now = Date.now()): DemoState {
  const rand = rng(2026);
  const users: DemoUser[] = [
    {
      id: "u-demo",
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      fullName: "Laura Benavides",
      username: "laura",
      phone: "3001234567",
    },
    {
      id: "u-cafe",
      email: "cafe@plazax.co",
      password: DEMO_PASSWORD,
      fullName: "Andrés Rosero",
      username: null,
      phone: null,
    },
    {
      id: "u-barniz",
      email: "barniz@plazax.co",
      password: DEMO_PASSWORD,
      fullName: "Rosa Erazo",
      username: null,
      phone: null,
    },
    {
      id: "u-campo",
      email: "campo@plazax.co",
      password: DEMO_PASSWORD,
      fullName: "Jhon Pantoja",
      username: null,
      phone: null,
    },
    {
      id: "u-buyer",
      email: "comprador@plazax.co",
      password: DEMO_PASSWORD,
      fullName: "Camila Ortiz",
      username: "cami",
      phone: "3109876543",
    },
  ];

  const stores: Store[] = [
    {
      id: "s-tejidos",
      ownerId: "u-demo",
      slug: "tejidos-galeras",
      name: "Tejidos Galeras",
      tagline: "Ruanas y lana de oveja hechas a mano",
      city: "Pasto",
      emoji: "🧶",
      whatsapp: "3001234567",
      active: true,
      verified: true,
      shipsNational: true,
      requireApproval: false,
      verificationRequestedAt: null,
    },
    {
      id: "s-cafe",
      ownerId: "u-cafe",
      slug: "cafe-narino",
      name: "Café de Altura Nariño",
      tagline: "Café especial del sur de Colombia",
      city: "La Unión",
      emoji: "☕",
      whatsapp: null,
      active: true,
      verified: true,
      shipsNational: true,
      requireApproval: false,
      verificationRequestedAt: null,
    },
    {
      id: "s-barniz",
      ownerId: "u-barniz",
      slug: "barniz-pasto",
      name: "Barniz de Pasto",
      tagline: "Mopa-mopa, patrimonio cultural",
      city: "Pasto",
      emoji: "🎨",
      whatsapp: null,
      active: true,
      verified: false,
      shipsNational: true,
      requireApproval: true,
      verificationRequestedAt: null,
    },
    {
      id: "s-campo",
      ownerId: "u-campo",
      slug: "campo-vivo",
      name: "Campo Vivo",
      tagline: "Del campo nariñense a tu mesa",
      city: "Ipiales",
      emoji: "🥔",
      whatsapp: null,
      active: true,
      verified: false,
      shipsNational: false,
      requireApproval: false,
      verificationRequestedAt: daysAgo(2, now),
    },
  ];

  const base = {
    images: [] as string[],
    active: true,
    rating: 0,
    ratingCount: 0,
    soldCount: 0,
    compareAtPrice: null as number | null,
    promoCopy: "",
    promoImage: null as string | null,
    promoVideo: null as string | null,
  };
  const products: DemoState["products"] = [
    {
      ...base,
      id: "p1",
      storeId: "s-tejidos",
      name: "Ruana de lana virgen",
      description:
        "Tejida en telar por artesanas de Pasto. Lana de oveja sin tinturar, ideal para el frío andino.",
      price: 180000,
      category: "Ropa",
      commission: 0.12,
      stock: 14,
      emoji: "🧣",
      compareAtPrice: 220000,
      promoCopy:
        "🧣 Ruana de lana virgen tejida a mano en Pasto. Abrigo de verdad para el frío andino. ¡Pídela hoy!",
      createdAt: daysAgo(60, now),
    },
    {
      ...base,
      id: "p2",
      storeId: "s-tejidos",
      name: "Gorro tejido andino",
      description: "Gorro a mano con orejeras y forro suave.",
      price: 45000,
      category: "Ropa",
      commission: 0.1,
      stock: 40,
      emoji: "🧢",
      createdAt: daysAgo(58, now),
    },
    {
      ...base,
      id: "p3",
      storeId: "s-cafe",
      name: "Café especial 500 g",
      description: "Notas de panela y cítricos. Tostión media, cultivado a 1.900 m.",
      price: 38000,
      category: "Alimentos",
      commission: 0.15,
      stock: 120,
      emoji: "☕",
      promoCopy:
        "☕ Café especial de La Unión, Nariño: notas de panela y cítricos. Tu mañana merece este sabor.",
      createdAt: daysAgo(55, now),
    },
    {
      ...base,
      id: "p4",
      storeId: "s-cafe",
      name: "Kit barista en casa",
      description: "Prensa francesa, molino manual y 250 g de café de origen.",
      price: 120000,
      category: "Alimentos",
      commission: 0.08,
      stock: 9,
      emoji: "🫖",
      compareAtPrice: 150000,
      createdAt: daysAgo(50, now),
    },
    {
      ...base,
      id: "p5",
      storeId: "s-barniz",
      name: "Plato decorativo mopa-mopa",
      description: "Pieza única decorada con la técnica ancestral del barniz de Pasto.",
      price: 100000,
      category: "Artesanías",
      commission: 0.1,
      stock: 6,
      emoji: "🍽️",
      createdAt: daysAgo(48, now),
    },
    {
      ...base,
      id: "p6",
      storeId: "s-barniz",
      name: "Caja joyero barnizada",
      description: "Madera tallada y barniz de colores. Perfecta para regalo.",
      price: 75000,
      category: "Artesanías",
      commission: 0.18,
      stock: 11,
      emoji: "🎁",
      compareAtPrice: 95000,
      promoCopy: "🎁 Caja joyero en barniz de Pasto (mopa-mopa). El regalo único que sí sorprende.",
      createdAt: daysAgo(9, now),
    },
    {
      ...base,
      id: "p7",
      storeId: "s-campo",
      name: "Canasta de papa nativa",
      description: "5 kg de papas nativas de colores, recién cosechadas.",
      price: 28000,
      category: "Campo",
      commission: 0.05,
      stock: 60,
      emoji: "🥔",
      createdAt: daysAgo(6, now),
    },
    {
      ...base,
      id: "p8",
      storeId: "s-campo",
      name: "Cuy marinado listo",
      description: "Marinado tradicional, listo para asar. Se entrega refrigerado.",
      price: 65000,
      category: "Campo",
      commission: 0.07,
      stock: 25,
      emoji: "🍗",
      createdAt: daysAgo(3, now),
    },
  ];

  const orders: DemoState["orders"] = [];
  const items: OrderItem[] = [];
  const buyers = [
    "María",
    "Juan",
    "Daniela",
    "Carlos",
    "Valentina",
    "Felipe",
    "Sofía",
    "Andrés",
    "Paula",
    "Diego",
  ];
  const cities = ["Pasto", "Ipiales", "Tumaco", "Cali", "Bogotá", "Popayán"];

  // Historial de 45 días: ventas de la tienda de Laura y ventas referidas por Laura.
  for (let i = 0; i < 46; i++) {
    const p = products[Math.floor(rand() * products.length)]!;
    const own = p.storeId === "s-tejidos";
    // Ventas referidas por Laura en otras tiendas; en su propia tienda, parte
    // de las ventas llegan por otra afiliada (@cami). Nunca hay autorreferidos.
    const affiliate = own ? (rand() < 0.4 ? "u-buyer" : null) : "u-demo";
    const referred = affiliate !== null;
    const age = Math.floor(rand() * 45) + 1;
    const created = daysAgo(age + 0.3, now);
    const qty = rand() < 0.8 ? 1 : 2;
    const sub = p.price * qty;
    const split = splitSale(sub, p.commission, referred);
    const id = `o-seed-${i}`;
    const fulfillment =
      age > 10 ? "delivered" : age > 4 ? "shipped" : age > 2 ? "preparing" : "pending";
    const buyer = buyers[i % buyers.length]!;
    orders.push({
      id,
      reference: `PX${created.slice(2, 10).replace(/-/g, "")}-${(1000 + i).toString(16).toUpperCase()}`,
      buyerId: "u-buyer",
      status: "paid",
      total: sub,
      discount: 0,
      shipping: {
        name: `${buyer} ${["G.", "M.", "R.", "L."][i % 4]!}`,
        phone: "3000000000",
        city: cities[i % cities.length]!,
        address: "Dirección de ejemplo",
      },
      createdAt: created,
      paidAt: created,
    });
    items.push({
      id: `i-seed-${i}`,
      orderId: id,
      productId: p.id,
      storeId: p.storeId,
      productName: p.name,
      productEmoji: p.emoji,
      productImage: null,
      unitPrice: p.price,
      qty,
      subtotal: sub,
      sellerAmount: split.seller,
      affiliateAmount: split.affiliate,
      platformAmount: split.platform,
      discountAmount: 0,
      affiliateId: affiliate,
      paidAt: created,
      fulfillment,
      tracking:
        fulfillment === "shipped" || fulfillment === "delivered" ? `${7000000 + i * 37}` : null,
      carrier: fulfillment === "shipped" || fulfillment === "delivered" ? "Servientrega" : null,
      shippedAt:
        fulfillment === "shipped" || fulfillment === "delivered" ? daysAgo(age - 1, now) : null,
      deliveredAt: fulfillment === "delivered" ? daysAgo(age - 3, now) : null,
      refundedAt: null,
      createdAt: created,
    });
    p.soldCount += qty;
  }

  // Clics de los últimos 30 días (unos 18 por cada venta referida).
  const clicks: DemoState["clicks"] = [];
  const promotable = products.filter((x) => x.storeId !== "s-tejidos");
  for (let i = 0; i < 520; i++) {
    const p = promotable[Math.floor(Math.pow(rand(), 1.4) * promotable.length)]!;
    clicks.push({
      id: `c${i}`,
      affiliateId: "u-demo",
      productId: p.id,
      createdAt: daysAgo(rand() * 30, now),
    });
  }

  const reviews: DemoState["reviews"] = [];
  const comments = [
    "Llegó rapidísimo y muy bien empacado.",
    "Excelente calidad, se nota lo artesanal.",
    "Tal cual la foto. Volvería a comprar.",
    "Muy bueno, aunque tardó un poco el envío.",
  ];
  products.forEach((p, idx) => {
    const n = 2 + (idx % 3);
    for (let k = 0; k < n; k++) {
      const rating = k === n - 1 && idx % 2 ? 4 : 5;
      reviews.push({
        id: `r-${p.id}-${k}`,
        productId: p.id,
        userId: `u-r${k}`,
        author: buyers[(idx + k) % buyers.length]!,
        rating,
        comment: comments[(idx + k) % comments.length]!,
        createdAt: daysAgo(3 + k * 4 + idx, now),
      });
    }
    const mine = reviews.filter((r) => r.productId === p.id);
    p.rating = Math.round((mine.reduce((t, r) => t + r.rating, 0) / mine.length) * 10) / 10;
    p.ratingCount = mine.length;
  });

  const withdrawals: DemoState["withdrawals"] = [
    {
      id: "w1",
      userId: "u-demo",
      amount: 120000,
      method: "nequi",
      account: "3001234567",
      status: "paid",
      createdAt: daysAgo(20, now),
    },
  ];

  return {
    version: 1,
    session: null,
    announcements: seedAnnouncements(now),
    admins: DEMO_ADMINS,
    // @laura (u-demo) ya trabaja con Café de Altura; @cami (u-buyer) pidió entrar a Tejidos.
    affiliations: [
      {
        id: "a-seed-1",
        storeId: "s-cafe",
        affiliateId: "u-demo",
        status: "approved" as const,
        message: null,
        createdAt: daysAgo(40, now),
      },
      {
        id: "a-seed-2",
        storeId: "s-tejidos",
        affiliateId: "u-buyer",
        status: "approved" as const,
        message: "Comparto artesanía nariñense en mi Instagram",
        createdAt: daysAgo(44, now),
      },
    ],
    // Una disputa abierta de ejemplo sobre una venta despachada de Tejidos Galeras.
    disputes: (() => {
      const it = items.find((x) => x.storeId === "s-tejidos" && x.fulfillment === "shipped");
      return it
        ? [
            {
              id: "d-seed-1",
              kind: "plazax_pay" as const,
              reporterId: "u-buyer",
              orderId: it.orderId,
              itemId: it.id,
              storeId: it.storeId,
              storeName: null,
              productName: null,
              reportedContact: null,
              reason: "damaged" as const,
              details:
                "La prenda llegó con una costura abierta en la manga. Adjunto foto del empaque.",
              evidence: [],
              status: "open" as const,
              sellerResponse: null,
              resolutionNote: null,
              createdAt: daysAgo(1, now),
              resolvedAt: null,
              ip: "190.0.0.1 (demo)",
            },
          ]
        : [];
    })(),
    users,
    stores,
    products,
    orders,
    items,
    clicks,
    withdrawals,
    reviews,
  };
}
