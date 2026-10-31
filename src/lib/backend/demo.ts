import {
  bundleDiscount,
  CATEGORIES,
  computeWallet,
  cop,
  MIN_WITHDRAWAL,
  PLATFORM_RATE,
  splitSale,
} from "@/lib/plaza";
import {
  byPriority,
  isLive,
  normalizeAnnouncement,
  validateAnnouncement,
} from "@/lib/announcements";
import { canDispute, validateDispute } from "@/lib/disputes";
import { buildSeed, DEMO_ADMINS, seedAnnouncements, type DemoState } from "./seed";
import type { Backend, Dispute, OrderItem, Product, ProductFilter, Profile, Store } from "./types";

/**
 * Backend local para desarrollar sin credenciales.
 * Imita las reglas de la base de datos (repartos, stock, retención, retiros)
 * y guarda todo en localStorage. En el servidor usa los datos semilla.
 */
const KEY = "plazax-demo-v2";
const isBrowser = typeof window !== "undefined";
let state: DemoState | null = null;
const listeners = new Set<(u: Profile | null) => void>();

function db(): DemoState {
  if (state) return state;
  if (isBrowser) {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) state = JSON.parse(raw) as DemoState;
    } catch {
      /* almacenamiento bloqueado: se usa memoria */
    }
  }
  state ??= buildSeed();
  upgrade(state);
  return state;
}

/** Completa datos guardados con versiones anteriores sin borrar nada. */
function upgrade(s: DemoState) {
  for (const st of s.stores) {
    st.shipsNational ??= true;
    st.verified ??= st.id === "s-tejidos" || st.id === "s-cafe";
    st.requireApproval ??= st.id === "s-barniz";
    st.verificationRequestedAt ??= null;
  }
  for (const p of s.products) p.promoVideo ??= null;
  s.affiliations ??= [];
  s.coupons ??= [];
  s.flashSales ??= [];
  for (const o of s.orders) {
    o.couponDiscount ??= 0;
    o.couponId ??= null;
  }
  for (const it of s.items) {
    it.carrier ??= it.tracking?.startsWith("Servientrega") ? "Servientrega" : null;
    if (it.tracking?.startsWith("Servientrega ")) it.tracking = it.tracking.slice(13);
    it.shippedAt ??=
      it.fulfillment === "shipped" || it.fulfillment === "delivered" ? it.createdAt : null;
    it.refundedAt ??= null;
  }
  s.disputes ??= [];
  s.banned ??= [];
  s.evidenceFiles ??= {};
}

function couponUses(id: string, user?: string) {
  const hour = Date.now() - 3_600_000;
  return db().orders.filter(
    (o) =>
      o.couponId === id &&
      (!user || o.buyerId === user) &&
      (o.status === "paid" || (o.status === "pending" && Date.parse(o.createdAt) > hour)),
  ).length;
}

function usableCoupon(code: string, user: string) {
  const c = (db().coupons ?? []).find((x) => x.code === code.trim().toUpperCase());
  if (!c || !c.active) throw new Error("Cupón no válido");
  if (Date.parse(c.startsAt) > Date.now()) throw new Error("Este cupón aún no está activo");
  if (c.endsAt && Date.parse(c.endsAt) <= Date.now()) throw new Error("Este cupón ya venció");
  if (c.maxUses !== null && couponUses(c.id) >= c.maxUses) throw new Error("Este cupón se agotó");
  if (couponUses(c.id, user) > 0) throw new Error("Ya usaste este cupón");
  return c;
}

const hasOpenDispute = (itemId: string) =>
  (db().disputes ?? []).some((d) => d.itemId === itemId && d.status === "open");

function disputeView(d: Dispute & { ip: string | null }): Dispute {
  const s = db();
  const { ip: _ip, ...rest } = d;
  return {
    ...rest,
    storeName: s.stores.find((x) => x.id === d.storeId)?.name ?? null,
    productName: s.items.find((x) => x.id === d.itemId)?.productName ?? null,
  };
}

function newDispute(
  fields: Pick<
    Dispute,
    | "kind"
    | "orderId"
    | "itemId"
    | "storeId"
    | "reportedContact"
    | "reason"
    | "details"
    | "evidence"
  >,
) {
  const u = requireMe();
  const problem = validateDispute(fields);
  if (problem) throw new Error(problem);
  const d: Dispute & { ip: string | null } = {
    ...fields,
    details: fields.details.trim(),
    evidence: fields.evidence.map((e) => e.trim()).filter(Boolean),
    id: uid(),
    reporterId: u.id,
    storeName: null,
    productName: null,
    status: "open",
    sellerResponse: null,
    resolutionNote: null,
    createdAt: now(),
    resolvedAt: null,
    ip: "127.0.0.1 (demo)",
  };
  db().disputes!.push(d);
  save();
  return d.id;
}

function save() {
  if (!isBrowser) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* lleno o bloqueado: los cambios viven solo en memoria */
  }
}

export function resetDemo() {
  state = buildSeed();
  upgrade(state);
  save();
  emit();
}

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) as string;
const now = () => new Date().toISOString();

function me() {
  const s = db();
  return s.users.find((u) => u.id === s.session) ?? null;
}
/** Datos guardados antes de existir los anuncios: se completan sin borrar nada. */
function announcements() {
  const s = db();
  if (!s.announcements) {
    s.announcements = seedAnnouncements();
    s.admins ??= DEMO_ADMINS;
    save();
  }
  return s.announcements;
}

function requireAdmin() {
  const u = requireMe();
  if (!(db().admins ?? DEMO_ADMINS).includes(u.id)) throw new Error("Solo administradores");
  return u;
}

function requireMe() {
  const u = me();
  if (!u) throw new Error("Inicia sesión para continuar");
  return u;
}
const toProfile = (u: NonNullable<ReturnType<typeof me>>): Profile => ({
  id: u.id,
  email: u.email,
  fullName: u.fullName,
  username: u.username,
  phone: u.phone,
  accountType: u.accountType ?? "comprador",
  payoutMethod: u.payoutMethod ?? null,
  banned: !!db().banned?.includes(u.id),
});
function emit() {
  const u = me();
  listeners.forEach((l) => l(u ? toProfile(u) : null));
}

function withStore(p: DemoState["products"][number]): Product {
  const s = db().stores.find((x) => x.id === p.storeId)!;
  return {
    ...p,
    store: {
      slug: s.slug,
      name: s.name,
      city: s.city,
      emoji: s.emoji,
      shipsNational: s.shipsNational,
      verified: s.verified,
      requireApproval: s.requireApproval,
    },
  };
}
function storeOf(userId: string): Store | null {
  return db().stores.find((s) => s.ownerId === userId) ?? null;
}

export const demoBackend: Backend = {
  mode: "demo",

  async getUser() {
    const u = me();
    return u ? toProfile(u) : null;
  },

  onAuthChange(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },

  async signUp({ email, password, fullName, accountType, payoutMethod }) {
    await wait();
    const s = db();
    email = email.trim().toLowerCase();
    if (s.users.some((u) => u.email === email))
      throw new Error("Ya existe una cuenta con ese correo");
    if (password.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres");
    const u = {
      id: uid(),
      email,
      password,
      fullName,
      username: null,
      phone: null,
      accountType: accountType ?? "comprador",
      payoutMethod: payoutMethod ?? null,
    };
    s.users.push(u);
    s.session = u.id;
    save();
    emit();
    return { needsConfirmation: false };
  },

  async signIn({ email, password }) {
    await wait();
    const s = db();
    const u = s.users.find(
      (x) => x.email === email.trim().toLowerCase() && x.password === password,
    );
    if (!u) throw new Error("Correo o contraseña incorrectos");
    s.session = u.id;
    save();
    emit();
  },

  async signOut() {
    db().session = null;
    save();
    emit();
  },

  async resetPassword() {
    await wait();
  },

  async updateProfile(input) {
    const u = requireMe();
    if (input.username !== undefined) {
      const name = input.username.toLowerCase();
      if (!/^[a-z0-9-]{3,30}$/.test(name))
        throw new Error("Usuario: 3 a 30 letras, números o guiones");
      if (db().users.some((x) => x.username === name && x.id !== u.id))
        throw new Error("Ese usuario ya está en uso");
      u.username = name;
    }
    if (input.fullName !== undefined) u.fullName = input.fullName;
    if (input.phone !== undefined) u.phone = input.phone || null;
    if (input.payoutMethod !== undefined) u.payoutMethod = input.payoutMethod;
    save();
    emit();
    return toProfile(u);
  },

  async usernameAvailable(username) {
    const u = me();
    return !db().users.some((x) => x.username === username.toLowerCase() && x.id !== u?.id);
  },

  async listProducts(f: ProductFilter = {}) {
    await wait(60);
    const s = db();
    const q = (f.q ?? "").trim().toLowerCase();
    let list = s.products
      .filter((p) => p.active && s.stores.find((x) => x.id === p.storeId)?.active)
      .map(withStore)
      .filter(
        (p) =>
          (!f.category || f.category === "Todo" || p.category === f.category) &&
          (!f.storeSlug || p.store.slug === f.storeSlug) &&
          (!q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)),
      );
    const sorters: Record<
      NonNullable<ProductFilter["sort"]>,
      (a: Product, b: Product) => number
    > = {
      popular: (a, b) => b.soldCount - a.soldCount,
      new: (a, b) => b.createdAt.localeCompare(a.createdAt),
      "price-asc": (a, b) => a.price - b.price,
      "price-desc": (a, b) => b.price - a.price,
      commission: (a, b) => b.commission - a.commission,
    };
    list = list.sort(sorters[f.sort ?? "popular"]);
    return list;
  },

  async getProduct(id) {
    const p = db().products.find((x) => x.id === id);
    return p ? withStore(p) : null;
  },

  async listStores() {
    return db().stores.filter((s) => s.active);
  },

  async getStore(slug) {
    return db().stores.find((s) => s.slug === slug) ?? null;
  },

  async listAnnouncements() {
    const now = Date.now();
    return announcements()
      .filter((a) => isLive(a, now))
      .sort(byPriority);
  },

  async isAdmin() {
    const u = me();
    return !!u && (db().admins ?? []).includes(u.id);
  },

  async adminStores() {
    requireAdmin();
    const s = db();
    return s.stores
      .map((st) => ({
        id: st.id,
        ownerId: st.ownerId,
        slug: st.slug,
        name: st.name,
        city: st.city,
        emoji: st.emoji,
        active: st.active,
        verified: st.verified,
        verificationRequestedAt: st.verificationRequestedAt,
        ownerEmail: s.users.find((u) => u.id === st.ownerId)?.email ?? "",
        ownerBanned: !!s.banned?.includes(st.ownerId),
        products: s.products.filter((p) => p.storeId === st.id && p.active).length,
        sold: s.products.filter((p) => p.storeId === st.id).reduce((t, p) => t + p.soldCount, 0),
        openDisputes: (s.disputes ?? []).filter((d) => d.storeId === st.id && d.status === "open")
          .length,
        createdAt: s.products.find((p) => p.storeId === st.id)?.createdAt ?? now(),
      }))
      .sort((a, b) =>
        (b.verificationRequestedAt ?? "").localeCompare(a.verificationRequestedAt ?? ""),
      );
  },

  async setStoreVerified(storeId, verified) {
    await wait();
    requireAdmin();
    const st = db().stores.find((x) => x.id === storeId);
    if (!st) throw new Error("Tienda no encontrada");
    st.verified = verified;
    if (verified) st.verificationRequestedAt = null;
    save();
  },

  async setStoreActive(storeId, active) {
    await wait();
    requireAdmin();
    const s = db();
    const st = s.stores.find((x) => x.id === storeId);
    if (!st) throw new Error("Tienda no encontrada");
    st.active = active && !s.banned?.includes(st.ownerId);
    save();
  },

  async setUserBanned(userId, banned) {
    await wait();
    const admin = requireAdmin();
    if (userId === admin.id) throw new Error("No puedes suspender tu propia cuenta");
    const s = db();
    s.banned = banned
      ? [...new Set([...(s.banned ?? []), userId])]
      : (s.banned ?? []).filter((x) => x !== userId);
    if (banned) s.stores.forEach((x) => x.ownerId === userId && (x.active = false));
    save();
  },

  async allDisputes() {
    requireAdmin();
    return (db().disputes ?? [])
      .map(disputeView)
      .sort(
        (a, b) =>
          Number(b.status === "open") - Number(a.status === "open") ||
          b.createdAt.localeCompare(a.createdAt),
      );
  },

  async resolveDispute(id, outcome, note, ban) {
    await wait();
    const admin = requireAdmin();
    const s = db();
    const d = s.disputes?.find((x) => x.id === id);
    if (!d || d.status !== "open") throw new Error("La disputa no está abierta");
    if (outcome === "refund" && d.kind !== "plazax_pay")
      throw new Error("Los tratos externos no tienen reembolso por Plaza X");
    if (outcome === "refund") {
      const it = s.items.find((i) => i.id === d.itemId);
      if (it) {
        it.fulfillment = "cancelled";
        it.refundedAt = now();
        const p = s.products.find((x) => x.id === it.productId);
        if (p) {
          p.stock += it.qty;
          p.soldCount = Math.max(0, p.soldCount - it.qty);
        }
      }
    }
    if (ban) {
      const store = s.stores.find((x) => x.id === d.storeId);
      if (!store) throw new Error("No hay una tienda que suspender");
      if (store.ownerId === admin.id) throw new Error("No puedes suspender tu propia cuenta");
      s.banned = [...new Set([...(s.banned ?? []), store.ownerId])];
      s.stores.forEach((x) => x.ownerId === store.ownerId && (x.active = false));
    }
    d.status = outcome === "refund" ? "refunded" : outcome === "reject" ? "rejected" : "closed";
    d.resolutionNote = note.trim() || null;
    d.resolvedAt = now();
    save();
  },

  async disputeAudit(id) {
    requireAdmin();
    const s = db();
    const d = s.disputes?.find((x) => x.id === id);
    if (!d) return null;
    const owner = s.stores.find((x) => x.id === d.storeId)?.ownerId;
    return {
      reporterEmail: s.users.find((u) => u.id === d.reporterId)?.email ?? "",
      reporterIp: d.ip,
      reporterAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      createdAt: d.createdAt,
      ownerEmail: s.users.find((u) => u.id === owner)?.email ?? null,
      ownerBannedAt: owner && s.banned?.includes(owner) ? d.resolvedAt : null,
    };
  },

  async allAnnouncements() {
    requireAdmin();
    return [...announcements()].sort(byPriority);
  },

  async saveAnnouncement(input) {
    await wait();
    requireAdmin();
    const clean = normalizeAnnouncement(input);
    const problem = validateAnnouncement(clean);
    if (problem) throw new Error(problem);
    const list = announcements();
    const { id, ...fields } = clean;
    let a = id ? list.find((x) => x.id === id) : undefined;
    if (id && !a) throw new Error("Anuncio no encontrado");
    if (a) Object.assign(a, fields);
    else {
      a = { ...fields, id: uid(), createdAt: now() };
      list.push(a);
    }
    save();
    return { ...a };
  },

  async deleteAnnouncement(id) {
    requireAdmin();
    const s = db();
    s.announcements = announcements().filter((a) => a.id !== id);
    save();
  },

  async recentActivity() {
    const s = db();
    const since = Date.now() - 7 * 86_400_000;
    return s.items
      .filter(
        (i) =>
          i.paidAt &&
          Date.parse(i.paidAt) > since &&
          s.products.some((p) => p.id === i.productId && p.active),
      )
      .sort((a, b) => b.paidAt!.localeCompare(a.paidAt!))
      .slice(0, 20)
      .map((i) => ({
        productId: i.productId,
        productName: i.productName,
        productEmoji: i.productEmoji,
        city: s.orders.find((o) => o.id === i.orderId)?.shipping.city ?? "",
        qty: i.qty,
        paidAt: i.paidAt!,
      }));
  },

  async listReviews(productId) {
    return db()
      .reviews.filter((r) => r.productId === productId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async addReview(productId, rating, comment) {
    const u = requireMe();
    const s = db();
    const bought = s.items.some(
      (i) =>
        i.productId === productId &&
        i.fulfillment === "delivered" &&
        s.orders.find((o) => o.id === i.orderId)?.buyerId === u.id,
    );
    if (!bought) throw new Error("Solo puedes reseñar productos que ya recibiste");
    s.reviews = s.reviews.filter((r) => !(r.productId === productId && r.userId === u.id));
    s.reviews.push({
      id: uid(),
      productId,
      userId: u.id,
      author: u.fullName.split(" ")[0] || "Comprador",
      rating,
      comment,
      createdAt: now(),
    });
    const p = s.products.find((x) => x.id === productId)!;
    const mine = s.reviews.filter((r) => r.productId === productId);
    p.rating = Math.round((mine.reduce((t, r) => t + r.rating, 0) / mine.length) * 10) / 10;
    p.ratingCount = mine.length;
    save();
  },

  async myStore() {
    const u = me();
    return u ? storeOf(u.id) : null;
  },

  async saveStore(input) {
    await wait();
    const u = requireMe();
    const s = db();
    if (!/^[a-z0-9-]{3,40}$/.test(input.slug))
      throw new Error("La dirección debe tener 3 a 40 letras, números o guiones");
    if (s.stores.some((x) => x.slug === input.slug && x.ownerId !== u.id))
      throw new Error("Esa dirección de tienda ya está en uso");
    let store = storeOf(u.id);
    if (store) Object.assign(store, input, { whatsapp: input.whatsapp || null });
    else {
      store = {
        id: uid(),
        ownerId: u.id,
        active: true,
        verified: false,
        verificationRequestedAt: null,
        ...input,
        whatsapp: input.whatsapp || null,
      };
      s.stores.push(store);
    }
    save();
    return store;
  },

  async myProducts() {
    const u = me();
    const store = u && storeOf(u.id);
    if (!store) return [];
    return db()
      .products.filter((p) => p.storeId === store.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(withStore);
  },

  async saveProduct({ id, ...input }) {
    await wait();
    const u = requireMe();
    const store = storeOf(u.id);
    if (!store) throw new Error("Primero crea tu tienda");
    if (!CATEGORIES.includes(input.category)) throw new Error("Categoría inválida");
    if (input.price < 1000) throw new Error("El precio mínimo es $1.000");
    // Igual que en la base de datos: un "precio antes" menor o igual al precio no es descuento.
    if (input.compareAtPrice !== null && input.compareAtPrice <= input.price)
      input.compareAtPrice = null;
    const s = db();
    let p = id ? s.products.find((x) => x.id === id && x.storeId === store.id) : undefined;
    if (id && !p) throw new Error("Producto no encontrado");
    if (p) Object.assign(p, input);
    else {
      p = {
        ...input,
        id: uid(),
        storeId: store.id,
        soldCount: 0,
        rating: 0,
        ratingCount: 0,
        createdAt: now(),
      };
      s.products.push(p);
    }
    save();
    return withStore(p);
  },

  async deleteProduct(id) {
    const u = requireMe();
    const store = storeOf(u.id);
    const s = db();
    s.products = s.products.filter((p) => !(p.id === id && p.storeId === store?.id));
    save();
  },

  async uploadImage(file) {
    if (file.size > 5 * 1024 * 1024) throw new Error("La imagen supera 5 MB");
    return downscale(file, 900);
  },

  async sellerOrders() {
    const u = me();
    const store = u && storeOf(u.id);
    if (!store) return [];
    const s = db();
    return s.items
      .filter((i) => i.storeId === store.id && i.paidAt)
      .map((i) => {
        const o = s.orders.find((x) => x.id === i.orderId)!;
        return { ...i, reference: o.reference, orderStatus: o.status, shipping: o.shipping };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async setFulfillment(itemId, status, tracking, carrier) {
    const u = requireMe();
    const store = storeOf(u.id);
    const it = db().items.find((i) => i.id === itemId);
    if (!["preparing", "shipped", "cancelled"].includes(status)) throw new Error("Estado inválido");
    if (
      !it ||
      it.storeId !== store?.id ||
      !it.paidAt ||
      ["delivered", "cancelled"].includes(it.fulfillment)
    ) {
      throw new Error("No puedes modificar este pedido");
    }
    if (status === "cancelled" && hasOpenDispute(itemId))
      throw new Error("Hay una disputa abierta: la resuelve la administración");
    it.fulfillment = status;
    if (tracking?.trim()) it.tracking = tracking.trim();
    if (carrier?.trim()) it.carrier = carrier.trim();
    if (status === "shipped") it.shippedAt ??= now();
    save();
  },

  async storeAffiliateRequests() {
    const u = me();
    const store = u && storeOf(u.id);
    if (!store) return [];
    const s = db();
    return (s.affiliations ?? [])
      .filter((a) => a.storeId === store.id)
      .map((a) => {
        const aff = s.users.find((x) => x.id === a.affiliateId);
        return {
          id: a.id,
          affiliateId: a.affiliateId,
          username: aff?.username ?? null,
          fullName: aff?.fullName ?? "",
          status: a.status,
          message: a.message,
          createdAt: a.createdAt,
          sales: s.items.filter(
            (i) => i.storeId === store.id && i.affiliateId === a.affiliateId && i.paidAt,
          ).length,
        };
      })
      .sort(
        (a, b) =>
          Number(b.status === "pending") - Number(a.status === "pending") ||
          b.createdAt.localeCompare(a.createdAt),
      );
  },

  async decideAffiliation(id, approve) {
    await wait();
    const u = requireMe();
    const a = db().affiliations?.find((x) => x.id === id);
    if (!a || a.storeId !== storeOf(u.id)?.id) throw new Error("No puedes decidir esta solicitud");
    a.status = approve ? "approved" : "rejected";
    save();
  },

  async requestVerification() {
    await wait();
    const u = requireMe();
    const store = storeOf(u.id);
    if (!store) throw new Error("Primero crea tu tienda");
    store.verificationRequestedAt = now();
    save();
  },

  async storeDisputes() {
    const u = me();
    const store = u && storeOf(u.id);
    if (!store) return [];
    return (db().disputes ?? [])
      .filter((d) => d.storeId === store.id && d.kind === "plazax_pay")
      .map(disputeView)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async respondDispute(id, response) {
    await wait();
    const u = requireMe();
    const d = db().disputes?.find((x) => x.id === id);
    const store = storeOf(u.id);
    if (!d || d.status !== "open" || d.kind !== "plazax_pay" || d.storeId !== store?.id)
      throw new Error("No puedes responder esta disputa");
    d.sellerResponse = response.trim().slice(0, 2000);
    save();
  },

  async confirmReceipt(itemId) {
    await wait();
    const u = requireMe();
    const s = db();
    const it = s.items.find((i) => i.id === itemId);
    const o = it && s.orders.find((x) => x.id === it.orderId);
    if (
      !it ||
      o?.buyerId !== u.id ||
      !it.paidAt ||
      !["preparing", "shipped"].includes(it.fulfillment)
    )
      throw new Error("No puedes confirmar este artículo");
    it.fulfillment = "delivered";
    it.deliveredAt = now();
    save();
  },

  async openDispute(itemId, input) {
    await wait();
    const u = requireMe();
    const s = db();
    const it = s.items.find((i) => i.id === itemId);
    const o = it && s.orders.find((x) => x.id === it.orderId);
    if (!it || o?.buyerId !== u.id) throw new Error("Este artículo no es de tus pedidos");
    if (!canDispute(it)) throw new Error("Este artículo ya no admite disputas");
    if (hasOpenDispute(itemId)) throw new Error("Ya hay una disputa abierta para este artículo");
    return newDispute({
      kind: "plazax_pay",
      orderId: it.orderId,
      itemId,
      storeId: it.storeId,
      reportedContact: null,
      ...input,
    });
  },

  async reportExternal(input) {
    await wait();
    const store = db().stores.find((x) => x.slug === input.storeSlug.trim());
    if (!store && !input.contact.trim())
      throw new Error("Indica la tienda o el contacto que denuncias");
    return newDispute({
      kind: "external_deal",
      orderId: null,
      itemId: null,
      storeId: store?.id ?? null,
      reportedContact: input.contact.trim().slice(0, 120) || null,
      reason: input.reason,
      details: input.details,
      evidence: input.evidence,
    });
  },

  async myDisputes() {
    const u = me();
    if (!u) return [];
    return (db().disputes ?? [])
      .filter((d) => d.reporterId === u.id)
      .map(disputeView)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async uploadEvidence(file) {
    requireMe();
    if (!file.type.startsWith("image/"))
      throw new Error("En el modo demo solo se pueden subir fotos");
    const data = await downscale(file, 700);
    const ref = `evidence:demo/${uid()}`;
    db().evidenceFiles![ref] = data;
    save();
    return ref;
  },

  async evidenceUrl(ref) {
    if (ref.startsWith("https://")) return ref;
    return db().evidenceFiles?.[ref] ?? null;
  },

  async createOrder(lines, ref, shipping, couponCode) {
    await wait(300);
    const u = me();
    if (!u) throw new Error("Debes iniciar sesión para comprar");
    if (!lines.length) throw new Error("El carrito está vacío");
    if (
      !shipping.name?.trim() ||
      !shipping.phone?.trim() ||
      !shipping.city?.trim() ||
      !shipping.address?.trim()
    ) {
      throw new Error("Completa los datos de envío");
    }
    const s = db();
    const aff = ref
      ? s.users.find((x) => x.username === ref.toLowerCase() && x.id !== u.id)
      : undefined;
    const orderId = uid();
    const items: OrderItem[] = [];
    const merged = new Map<string, number>();
    lines.forEach((l) =>
      merged.set(l.productId, Math.min(99, (merged.get(l.productId) ?? 0) + Math.max(1, l.qty))),
    );
    const units = [...merged.values()].reduce((t, q) => t + q, 0);
    const coupon = couponCode?.trim() ? usableCoupon(couponCode, u.id) : null;
    // Mismo reparto que create_order(): volumen y cupón salen de la parte de Plaza X.
    const priced = new Map<string, { bundle: number; coupon: number }>();
    {
      const sorted = [...merged.keys()].sort();
      const subs = sorted.map((id) => ({
        productId: id,
        subtotal: (s.products.find((x) => x.id === id)?.price ?? 0) * merged.get(id)!,
      }));
      const gross = subs.reduce((t, l) => t + l.subtotal, 0);
      if (coupon && gross < coupon.minSubtotal)
        throw new Error(`Este cupón aplica desde ${cop(coupon.minSubtotal)} en productos`);
      let left = coupon?.kind === "fixed" ? coupon.value : 0;
      for (const l of subs) {
        const plat = Math.round(l.subtotal * PLATFORM_RATE);
        const b = bundleDiscount(l.subtotal, units);
        let c = 0;
        if (coupon?.kind === "percent")
          c = Math.min(plat - b, Math.round((l.subtotal * coupon.value) / 100));
        else if (coupon) {
          c = Math.min(plat - b, left);
          left -= c;
        }
        priced.set(l.productId, { bundle: b, coupon: c });
      }
    }
    for (const [productId, qty] of merged) {
      const p = s.products.find((x) => x.id === productId && x.active);
      const store = p && s.stores.find((x) => x.id === p.storeId && x.active);
      if (!p || !store || s.banned?.includes(store.ownerId))
        throw new Error("Un producto ya no está disponible");
      if (p.stock < qty) throw new Error(`Sin stock suficiente de "${p.name}" (quedan ${p.stock})`);
      // Tienda con aprobación: sin solicitud aprobada, la comisión vuelve a la tienda.
      const approved =
        !store.requireApproval ||
        (s.affiliations ?? []).some(
          (a) => a.storeId === store.id && a.affiliateId === aff?.id && a.status === "approved",
        );
      const referred = !!aff && aff.id !== store.ownerId && approved;
      const sub = p.price * qty;
      const split = splitSale(sub, p.commission, referred);
      const pr = priced.get(productId)!;
      const disc = pr.bundle + pr.coupon;
      items.push({
        id: uid(),
        orderId,
        productId,
        storeId: p.storeId,
        productName: p.name,
        productEmoji: p.emoji,
        productImage: p.images[0] ?? null,
        unitPrice: p.price,
        qty,
        subtotal: sub,
        sellerAmount: split.seller,
        affiliateAmount: split.affiliate,
        platformAmount: split.platform - disc,
        discountAmount: disc,
        affiliateId: referred ? aff!.id : null,
        paidAt: null,
        fulfillment: "pending",
        tracking: null,
        carrier: null,
        shippedAt: null,
        deliveredAt: null,
        refundedAt: null,
        createdAt: now(),
      });
    }
    const discount = items.reduce((t, i) => t + i.discountAmount, 0);
    const total = items.reduce((t, i) => t + i.subtotal, 0) - discount;
    const d = new Date();
    const reference = `PX${d.toISOString().slice(2, 10).replace(/-/g, "")}-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;
    s.orders.push({
      id: orderId,
      reference,
      buyerId: u.id,
      status: "pending",
      total,
      discount,
      couponDiscount: [...priced.values()].reduce((t, x) => t + x.coupon, 0),
      couponId: coupon?.id ?? null,
      shipping,
      createdAt: now(),
      paidAt: null,
    });
    s.items.push(...items);
    save();
    return { orderId, reference, total };
  },

  async startPayment(orderId) {
    return `/pedido/${orderId}?pago=demo`;
  },

  async simulatePayment(orderId, approved) {
    await wait(900);
    const s = db();
    const o = s.orders.find((x) => x.id === orderId);
    if (!o || o.status !== "pending") return;
    if (!approved) {
      o.status = "failed";
    } else {
      o.status = "paid";
      o.paidAt = now();
      for (const it of s.items.filter((i) => i.orderId === o.id)) {
        it.paidAt = o.paidAt;
        const p = s.products.find((x) => x.id === it.productId);
        if (p) {
          p.stock = Math.max(0, p.stock - it.qty);
          p.soldCount += it.qty;
        }
      }
    }
    save();
  },

  async myOrders() {
    const u = me();
    if (!u) return [];
    const s = db();
    return s.orders
      .filter((o) => o.buyerId === u.id)
      .map((o) => ({ ...o, items: s.items.filter((i) => i.orderId === o.id) }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getOrder(id) {
    const u = me();
    const s = db();
    const o = s.orders.find((x) => x.id === id && x.buyerId === u?.id);
    return o ? { ...o, items: s.items.filter((i) => i.orderId === o.id) } : null;
  },

  async checkCoupon(code) {
    await wait();
    const u = me();
    if (!u) throw new Error("Inicia sesión para usar cupones");
    const {
      id: _id,
      uses: _u,
      maxUses: _m,
      startsAt: _s,
      active: _a,
      createdAt: _c,
      ...rule
    } = usableCoupon(code, u.id);
    return rule;
  },

  async activeFlashSale() {
    const t = Date.now();
    return (
      (db().flashSales ?? [])
        .filter((f) => f.active && Date.parse(f.startsAt) <= t && Date.parse(f.endsAt) > t)
        .sort((a, b) => a.endsAt.localeCompare(b.endsAt))[0] ?? null
    );
  },

  async listCoupons() {
    requireAdmin();
    return (db().coupons ?? []).map((c) => ({
      ...c,
      uses: db().orders.filter((o) => o.couponId === c.id && o.status === "paid").length,
    }));
  },

  async saveCoupon({ id, ...input }) {
    await wait();
    requireAdmin();
    const s = db();
    const code = input.code.trim().toUpperCase();
    if (!/^[A-Z0-9-]{3,20}$/.test(code))
      throw new Error("Código: 3 a 20 letras, números o guiones");
    if (input.value <= 0 || (input.kind === "percent" && input.value > 50))
      throw new Error("Valor inválido");
    if (input.endsAt && Date.parse(input.endsAt) <= Date.parse(input.startsAt))
      throw new Error("La fecha de fin debe ser posterior al inicio");
    if (s.coupons!.some((c) => c.code === code && c.id !== id))
      throw new Error("Ya existe un cupón con ese código");
    const row = { ...input, code, description: input.description.trim() };
    const prev = id ? s.coupons!.find((c) => c.id === id) : undefined;
    if (prev) Object.assign(prev, row);
    else s.coupons!.unshift({ ...row, id: uid(), uses: 0, createdAt: now() });
    save();
  },

  async listFlashSales() {
    requireAdmin();
    return [...(db().flashSales ?? [])].sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  },

  async saveFlashSale({ id, ...input }) {
    await wait();
    requireAdmin();
    const s = db();
    if (input.title.trim().length < 3) throw new Error("Título: mínimo 3 caracteres");
    if (Date.parse(input.endsAt) <= Date.parse(input.startsAt))
      throw new Error("La fecha de fin debe ser posterior al inicio");
    const row = {
      ...input,
      title: input.title.trim(),
      subtitle: input.subtitle.trim(),
      couponCode: input.couponCode?.trim().toUpperCase() || null,
      link: input.link?.trim() || null,
    };
    const prev = id ? s.flashSales!.find((f) => f.id === id) : undefined;
    if (prev) Object.assign(prev, row);
    else s.flashSales!.unshift({ ...row, id: uid() });
    save();
  },

  async deleteFlashSale(id) {
    requireAdmin();
    const s = db();
    s.flashSales = (s.flashSales ?? []).filter((f) => f.id !== id);
    save();
  },

  async myAffiliations() {
    const u = me();
    if (!u) return [];
    return (db().affiliations ?? [])
      .filter((a) => a.affiliateId === u.id)
      .map(({ id, storeId, status, createdAt }) => ({ id, storeId, status, createdAt }));
  },

  async requestAffiliation(storeSlug, message) {
    await wait();
    const u = requireMe();
    const s = db();
    if (s.banned?.includes(u.id)) throw new Error("Tu cuenta está suspendida");
    const store = s.stores.find((x) => x.slug === storeSlug && x.active);
    if (!store) throw new Error("Tienda no encontrada");
    if (store.ownerId === u.id) throw new Error("No puedes afiliarte a tu propia tienda");
    if (!u.username) throw new Error("Primero elige tu usuario de afiliado");
    const prev = s.affiliations!.find((a) => a.storeId === store.id && a.affiliateId === u.id);
    if (prev?.status === "approved") return "approved";
    if (prev?.status === "rejected") throw new Error("La tienda no aprobó tu solicitud");
    const status = store.requireApproval ? "pending" : "approved";
    if (prev) prev.message = message?.trim().slice(0, 300) || null;
    else
      s.affiliations!.push({
        id: uid(),
        storeId: store.id,
        affiliateId: u.id,
        status,
        message: message?.trim().slice(0, 300) || null,
        createdAt: now(),
      });
    save();
    return status;
  },

  async trackClick(username, productId) {
    const s = db();
    const aff = s.users.find((x) => x.username === username.toLowerCase());
    if (!aff || aff.id === me()?.id) return;
    s.clicks.push({
      id: uid(),
      affiliateId: aff.id,
      productId: s.products.some((p) => p.id === productId) ? productId : null,
      createdAt: now(),
    });
    save();
  },

  async myClicks() {
    const u = me();
    return u ? db().clicks.filter((c) => c.affiliateId === u.id) : [];
  },

  async myAffiliateItems() {
    const u = me();
    return u ? db().items.filter((i) => i.affiliateId === u.id) : [];
  },

  async wallet() {
    const u = me();
    if (!u) return { pending: 0, available: 0, withdrawn: 0, frozen: 0 };
    const s = db();
    const store = storeOf(u.id);
    const rows = s.items
      .filter((i) => i.storeId === store?.id || i.affiliateId === u.id)
      .map((i) => ({
        amount:
          (i.storeId === store?.id ? i.sellerAmount : 0) +
          (i.affiliateId === u.id ? i.affiliateAmount : 0),
        paidAt: i.paidAt,
        fulfillment: i.fulfillment,
        deliveredAt: i.deliveredAt,
        shippedAt: i.shippedAt,
        frozen: hasOpenDispute(i.id),
      }));
    const withdrawn = s.withdrawals
      .filter((w) => w.userId === u.id && w.status !== "rejected")
      .reduce((t, w) => t + w.amount, 0);
    return computeWallet(rows, withdrawn);
  },

  async myWithdrawals() {
    const u = me();
    return u
      ? db()
          .withdrawals.filter((w) => w.userId === u.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      : [];
  },

  async requestWithdrawal(amount, method, account) {
    await wait();
    const u = requireMe();
    if (db().banned?.includes(u.id))
      throw new Error("Tu cuenta está suspendida. Escríbenos a soporte");
    const w = await this.wallet();
    if (amount < MIN_WITHDRAWAL) throw new Error("El retiro mínimo es $50.000");
    if (amount > w.available) throw new Error("Saldo disponible insuficiente");
    if (account.trim().length < 7) throw new Error("Cuenta inválida");
    db().withdrawals.push({
      id: uid(),
      userId: u.id,
      amount,
      method,
      account: account.trim(),
      status: "requested",
      createdAt: now(),
    });
    save();
  },
};

/** Reduce una imagen y la devuelve como data URL (para no llenar localStorage). */
function downscale(file: File, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => reject(new Error("No se pudo leer la imagen"));
    img.src = URL.createObjectURL(file);
  });
}
