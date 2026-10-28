import { CATEGORIES, computeWallet, MIN_WITHDRAWAL, splitSale } from "@/lib/plaza";
import { buildSeed, type DemoState } from "./seed";
import type { Backend, OrderItem, Product, ProductFilter, Profile, Store } from "./types";

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
  return state;
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
});
function emit() {
  const u = me();
  listeners.forEach((l) => l(u ? toProfile(u) : null));
}

function withStore(p: DemoState["products"][number]): Product {
  const s = db().stores.find((x) => x.id === p.storeId)!;
  return { ...p, store: { slug: s.slug, name: s.name, city: s.city, emoji: s.emoji } };
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

  async signUp({ email, password, fullName }) {
    await wait();
    const s = db();
    email = email.trim().toLowerCase();
    if (s.users.some((u) => u.email === email))
      throw new Error("Ya existe una cuenta con ese correo");
    if (password.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres");
    const u = { id: uid(), email, password, fullName, username: null, phone: null };
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

  async setFulfillment(itemId, status, tracking) {
    const u = requireMe();
    const store = storeOf(u.id);
    const it = db().items.find((i) => i.id === itemId);
    if (
      !it ||
      it.storeId !== store?.id ||
      !it.paidAt ||
      ["delivered", "cancelled"].includes(it.fulfillment)
    ) {
      throw new Error("No puedes modificar este pedido");
    }
    it.fulfillment = status;
    if (tracking?.trim()) it.tracking = tracking.trim();
    if (status === "delivered") it.deliveredAt = now();
    save();
  },

  async createOrder(lines, ref, shipping) {
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
    for (const [productId, qty] of merged) {
      const p = s.products.find((x) => x.id === productId && x.active);
      const store = p && s.stores.find((x) => x.id === p.storeId && x.active);
      if (!p || !store) throw new Error("Un producto ya no está disponible");
      if (p.stock < qty) throw new Error(`Sin stock suficiente de "${p.name}" (quedan ${p.stock})`);
      const referred = !!aff && aff.id !== store.ownerId;
      const sub = p.price * qty;
      const split = splitSale(sub, p.commission, referred);
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
        platformAmount: split.platform,
        affiliateId: referred ? aff!.id : null,
        paidAt: null,
        fulfillment: "pending",
        tracking: null,
        deliveredAt: null,
        createdAt: now(),
      });
    }
    const total = items.reduce((t, i) => t + i.subtotal, 0);
    const d = new Date();
    const reference = `PX${d.toISOString().slice(2, 10).replace(/-/g, "")}-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;
    s.orders.push({
      id: orderId,
      reference,
      buyerId: u.id,
      status: "pending",
      total,
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
    if (!u) return { pending: 0, available: 0, withdrawn: 0 };
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
