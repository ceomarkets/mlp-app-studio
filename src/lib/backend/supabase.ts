import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Category, PayoutMethod } from "@/lib/plaza";
import type {
  Backend,
  Click,
  Order,
  OrderItem,
  Product,
  ProductFilter,
  Profile,
  Review,
  SellerOrderItem,
  Store,
  Withdrawal,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any -- filas crudas de PostgREST */
type Row = any;

const PRODUCT_COLS = "*, stores!inner(slug, name, city, emoji, active)";

const toStore = (r: Row): Store => ({
  id: r.id,
  ownerId: r.owner_id,
  slug: r.slug,
  name: r.name,
  tagline: r.tagline,
  city: r.city,
  emoji: r.emoji,
  whatsapp: r.whatsapp,
  active: r.active,
});

const toProduct = (r: Row): Product => ({
  id: r.id,
  storeId: r.store_id,
  name: r.name,
  description: r.description,
  price: r.price,
  category: r.category as Category,
  commission: Number(r.commission),
  stock: r.stock,
  images: r.images ?? [],
  emoji: r.emoji,
  active: r.active,
  soldCount: r.sold_count,
  rating: Number(r.rating),
  ratingCount: r.rating_count,
  createdAt: r.created_at,
  store: { slug: r.stores.slug, name: r.stores.name, city: r.stores.city, emoji: r.stores.emoji },
});

const toItem = (r: Row): OrderItem => ({
  id: r.id,
  orderId: r.order_id,
  productId: r.product_id,
  storeId: r.store_id,
  productName: r.product_name,
  productEmoji: r.product_emoji,
  productImage: r.product_image,
  unitPrice: r.unit_price,
  qty: r.qty,
  subtotal: r.subtotal,
  sellerAmount: r.seller_amount,
  affiliateAmount: r.affiliate_amount,
  platformAmount: r.platform_amount,
  affiliateId: r.affiliate_id,
  paidAt: r.paid_at,
  fulfillment: r.fulfillment,
  tracking: r.tracking,
  deliveredAt: r.delivered_at,
  createdAt: r.created_at,
});

const toOrder = (r: Row): Order => ({
  id: r.id,
  reference: r.reference,
  buyerId: r.buyer_id,
  status: r.status,
  total: r.total,
  shipping: r.shipping,
  createdAt: r.created_at,
  paidAt: r.paid_at,
  items: (r.order_items ?? []).map(toItem),
});

function ok<T>(res: { data: T; error: any }): T {
  if (res.error) throw new Error(humanize(res.error.message));
  return res.data;
}

function humanize(msg: string) {
  if (msg.includes("stores_slug_key")) return "Esa dirección de tienda ya está en uso";
  if (msg.includes("profiles_username_key")) return "Ese usuario ya está en uso";
  if (msg.includes("Invalid login credentials")) return "Correo o contraseña incorrectos";
  if (msg.includes("User already registered")) return "Ya existe una cuenta con ese correo";
  if (msg.includes("Email not confirmed")) return "Confirma tu correo antes de entrar";
  if (msg.includes("Password should be")) return "La contraseña debe tener al menos 6 caracteres";
  return msg;
}

const sanitize = (q: string) => q.replace(/[%,()*\\]/g, " ").trim();

async function currentUser(): Promise<User | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) throw new Error("Inicia sesión para continuar");
  return u;
}

async function loadProfile(u: User): Promise<Profile> {
  const { data } = await supabase.from("profiles").select("*").eq("id", u.id).maybeSingle();
  return {
    id: u.id,
    email: u.email ?? "",
    fullName: data?.full_name || (u.user_metadata?.["full_name"] as string) || "",
    username: data?.username ?? null,
    phone: data?.phone ?? null,
  };
}

export const supabaseBackend: Backend = {
  mode: "supabase",

  async getUser() {
    const u = await currentUser();
    return u ? loadProfile(u) : null;
  },

  onAuthChange(cb) {
    const { data } = supabase.auth.onAuthStateChange(
      (_event: string, session: Session | null) => {
      // Diferido: no se deben llamar otras funciones de Supabase dentro del callback.
      setTimeout(async () => cb(session?.user ? await loadProfile(session.user) : null), 0);
      },
    );
    return () => data.subscription.unsubscribe();
  },

  async signUp({ email, password, fullName }) {
    const res = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        ...(typeof window !== "undefined" && {
          emailRedirectTo: `${window.location.origin}/cuenta`,
        }),
      },
    });
    ok(res);
    return { needsConfirmation: !res.data.session };
  },

  async signIn({ email, password }) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(humanize(error.message));
  },

  async signOut() {
    await supabase.auth.signOut();
  },

  async resetPassword(email) {
    ok(
      await supabase.auth.resetPasswordForEmail(
        email,
        typeof window !== "undefined" ? { redirectTo: `${window.location.origin}/cuenta` } : {},
      ),
    );
  },

  async updateProfile(input) {
    const u = await requireUser();
    const patch: Row = {};
    if (input.fullName !== undefined) patch.full_name = input.fullName;
    if (input.username !== undefined) patch.username = input.username.toLowerCase();
    if (input.phone !== undefined) patch.phone = input.phone || null;
    ok(await supabase.from("profiles").update(patch).eq("id", u.id));
    return loadProfile(u);
  },

  async usernameAvailable(username) {
    return ok(await supabase.rpc("username_available", { p_username: username })) as boolean;
  },

  async listProducts(f: ProductFilter = {}) {
    let q = supabase
      .from("products")
      .select(PRODUCT_COLS)
      .eq("active", true)
      .eq("stores.active", true);
    if (f.category && f.category !== "Todo") q = q.eq("category", f.category);
    if (f.storeSlug) q = q.eq("stores.slug", f.storeSlug);
    const term = f.q ? sanitize(f.q) : "";
    if (term) q = q.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
    const order: Record<NonNullable<ProductFilter["sort"]>, [string, boolean]> = {
      popular: ["sold_count", false],
      new: ["created_at", false],
      "price-asc": ["price", true],
      "price-desc": ["price", false],
      commission: ["commission", false],
    };
    const [col, asc] = order[f.sort ?? "popular"];
    return (ok(await q.order(col, { ascending: asc }).limit(200)) as Row[]).map(toProduct);
  },

  async getProduct(id) {
    const r = ok(await supabase.from("products").select(PRODUCT_COLS).eq("id", id).maybeSingle());
    return r ? toProduct(r) : null;
  },

  async listStores() {
    return (
      ok(
        await supabase.from("stores").select("*").eq("active", true).order("created_at"),
      ) as Row[]
    ).map(toStore);
  },

  async getStore(slug) {
    const r = ok(await supabase.from("stores").select("*").eq("slug", slug).maybeSingle());
    return r ? toStore(r) : null;
  },

  async listReviews(productId) {
    const rows = ok(
      await supabase
        .from("reviews")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: false }),
    ) as Row[];
    return rows.map((r): Review => ({
      id: r.id,
      productId: r.product_id,
      author: r.author,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.created_at,
    }));
  },

  async addReview(productId, rating, comment) {
    const u = await requireUser();
    const p = await loadProfile(u);
    const res = await supabase
      .from("reviews")
      .upsert(
        {
          product_id: productId,
          user_id: u.id,
          rating,
          comment,
          author: p.fullName.split(" ")[0] || "Comprador",
        },
        { onConflict: "product_id,user_id" },
      );
    if (res.error?.message.includes("row-level security"))
      throw new Error("Solo puedes reseñar productos que ya recibiste");
    ok(res);
  },

  async myStore() {
    const u = await currentUser();
    if (!u) return null;
    const r = ok(await supabase.from("stores").select("*").eq("owner_id", u.id).maybeSingle());
    return r ? toStore(r) : null;
  },

  async saveStore(input) {
    const u = await requireUser();
    const row = { ...input, owner_id: u.id, whatsapp: input.whatsapp || null };
    const r = ok(
      await supabase.from("stores").upsert(row, { onConflict: "owner_id" }).select().single(),
    );
    return toStore(r);
  },

  async myProducts() {
    const store = await this.myStore();
    if (!store) return [];
    const rows = ok(
      await supabase
        .from("products")
        .select(PRODUCT_COLS)
        .eq("store_id", store.id)
        .order("created_at", { ascending: false }),
    ) as Row[];
    return rows.map(toProduct);
  },

  async saveProduct({ id, ...p }) {
    const store = await this.myStore();
    if (!store) throw new Error("Primero crea tu tienda");
    const row = { ...p, store_id: store.id };
    const q = id
      ? supabase.from("products").update(row).eq("id", id).select(PRODUCT_COLS).single()
      : supabase.from("products").insert(row).select(PRODUCT_COLS).single();
    return toProduct(ok(await q));
  },

  async deleteProduct(id) {
    const res = await supabase.from("products").delete().eq("id", id);
    if (res.error?.message.includes("foreign key")) {
      // Tiene ventas: se desactiva en lugar de borrarse.
      ok(await supabase.from("products").update({ active: false }).eq("id", id));
      return;
    }
    ok(res);
  },

  async uploadImage(file) {
    const u = await requireUser();
    if (file.size > 5 * 1024 * 1024) throw new Error("La imagen supera 5 MB");
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${u.id}/${crypto.randomUUID()}.${ext}`;
    ok(
      await supabase
        .storage.from("product-images")
        .upload(path, file, { contentType: file.type, cacheControl: "31536000" }),
    );
    return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
  },

  async sellerOrders() {
    const store = await this.myStore();
    if (!store) return [];
    const rows = ok(
      await supabase
        .from("order_items")
        .select("*, orders(reference, status, shipping)")
        .eq("store_id", store.id)
        .not("paid_at", "is", null)
        .order("created_at", { ascending: false })
        .limit(500),
    ) as Row[];
    return rows.map((r): SellerOrderItem => ({
      ...toItem(r),
      reference: r.orders.reference,
      orderStatus: r.orders.status,
      shipping: r.orders.shipping,
    }));
  },

  async setFulfillment(itemId, status, tracking) {
    ok(
      await supabase.rpc("set_fulfillment", {
        p_item_id: itemId,
        p_status: status,
        p_tracking: tracking ?? null,
      }),
    );
  },

  async createOrder(lines, ref, shipping) {
    const data = ok(
      await supabase.rpc("create_order", {
        p_items: lines.map((l) => ({ product_id: l.productId, qty: l.qty })),
        p_ref: ref,
        p_shipping: shipping,
      }),
    ) as Row[];
    const r = data[0];
    return { orderId: r.order_id, reference: r.reference, total: r.total };
  },

  async startPayment(orderId, returnUrl) {
    const { data, error } = await supabase.functions.invoke("wompi-checkout", {
      body: { orderId, redirectUrl: returnUrl },
    });
    if (error || !data?.url) {
      let msg = "No se pudo iniciar el pago";
      try {
        msg = (await error?.context?.json())?.error ?? msg;
      } catch {
        /* sin cuerpo */
      }
      throw new Error(msg);
    }
    return data.url as string;
  },

  async myOrders() {
    const u = await currentUser();
    if (!u) return [];
    const rows = ok(
      await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("buyer_id", u.id)
        .order("created_at", { ascending: false }),
    ) as Row[];
    return rows.map(toOrder);
  },

  async getOrder(id) {
    const r = ok(
      await supabase.from("orders").select("*, order_items(*)").eq("id", id).maybeSingle(),
    );
    return r ? toOrder(r) : null;
  },

  async trackClick(username, productId) {
    await supabase.rpc("track_click", { p_username: username, p_product_id: productId });
  },

  async myClicks() {
    const u = await currentUser();
    if (!u) return [];
    const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const rows = ok(
      await supabase
        .from("referral_clicks")
        .select("id, product_id, created_at")
        .eq("affiliate_id", u.id)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(10000),
    ) as Row[];
    return rows.map((r): Click => ({
      id: String(r.id),
      productId: r.product_id,
      createdAt: r.created_at,
    }));
  },

  async myAffiliateItems() {
    const u = await currentUser();
    if (!u) return [];
    const rows = ok(
      await supabase
        .from("order_items")
        .select("*")
        .eq("affiliate_id", u.id)
        .order("created_at", { ascending: false })
        .limit(2000),
    ) as Row[];
    return rows.map(toItem);
  },

  async wallet() {
    const rows = ok(await supabase.rpc("my_wallet")) as Row[];
    const r = rows[0] ?? { pending: 0, available: 0, withdrawn: 0 };
    return { pending: r.pending, available: r.available, withdrawn: r.withdrawn };
  },

  async myWithdrawals() {
    const rows = ok(
      await supabase.from("withdrawals").select("*").order("created_at", { ascending: false }),
    ) as Row[];
    return rows.map((r): Withdrawal => ({
      id: r.id,
      amount: r.amount,
      method: r.method as PayoutMethod,
      account: r.account,
      status: r.status,
      createdAt: r.created_at,
    }));
  },

  async requestWithdrawal(amount, method, account) {
    ok(
      await supabase.rpc("request_withdrawal", {
        p_amount: amount,
        p_method: method,
        p_account: account,
      }),
    );
  },
};
