import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Category, PayoutMethod } from "@/lib/plaza";
import { normalizeAnnouncement, validateAnnouncement } from "@/lib/announcements";
import type {
  Announcement,
  Backend,
  Click,
  Dispute,
  DisputeAudit,
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

/**
 * Cliente sin tipos para lo que agrega la migración 20261028170000
 * (compare_at_price y recent_activity). Cuando Lovable regenere
 * src/integrations/supabase/types.ts con esa migración aplicada, se puede
 * volver a usar `supabase` directamente.
 */
const untyped = supabase as unknown as SupabaseClient;

// `stores!inner(*)`: las columnas nuevas llegan solas cuando se aplica su migración.
const PRODUCT_COLS = "*, stores!inner(*)";

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
  shipsNational: r.ships_national ?? true,
  verified: r.verified ?? false,
});

const toProduct = (r: Row): Product => ({
  id: r.id,
  storeId: r.store_id,
  name: r.name,
  description: r.description,
  price: r.price,
  compareAtPrice: r.compare_at_price ?? null,
  promoCopy: r.promo_copy ?? "",
  promoImage: r.promo_image ?? null,
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
  store: {
    slug: r.stores.slug,
    name: r.stores.name,
    city: r.stores.city,
    emoji: r.stores.emoji,
    shipsNational: r.stores.ships_national ?? true,
    verified: r.stores.verified ?? false,
  },
});

const toAnnouncement = (r: Row): Announcement => ({
  id: r.id,
  title: r.title,
  body: r.body,
  emoji: r.emoji,
  image: r.image,
  link: r.link,
  cta: r.cta,
  tone: r.tone,
  priority: r.priority,
  active: r.active,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  createdAt: r.created_at,
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
  discountAmount: r.discount_amount ?? 0,
  affiliateId: r.affiliate_id,
  paidAt: r.paid_at,
  fulfillment: r.fulfillment,
  tracking: r.tracking,
  carrier: r.carrier ?? null,
  shippedAt: r.shipped_at ?? null,
  deliveredAt: r.delivered_at,
  refundedAt: r.refunded_at ?? null,
  createdAt: r.created_at,
});

const DISPUTE_COLS = "*, stores(name), order_items(product_name)";
const toDispute = (r: Row): Dispute => ({
  id: r.id,
  kind: r.kind,
  reporterId: r.reporter_id,
  orderId: r.order_id,
  itemId: r.item_id,
  storeId: r.store_id,
  storeName: r.stores?.name ?? null,
  productName: r.order_items?.product_name ?? null,
  reportedContact: r.reported_contact,
  reason: r.reason,
  details: r.details,
  evidence: r.evidence ?? [],
  status: r.status,
  sellerResponse: r.seller_response,
  resolutionNote: r.resolution_note,
  createdAt: r.created_at,
  resolvedAt: r.resolved_at,
});

const toOrder = (r: Row): Order => ({
  id: r.id,
  reference: r.reference,
  buyerId: r.buyer_id,
  status: r.status,
  total: r.total,
  discount: r.discount ?? 0,
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
  if (msg.includes("disputes_details_check")) return "Cuéntanos qué pasó (mínimo 20 caracteres)";
  if (msg.includes("disputes_one_open_per_item"))
    return "Ya hay una disputa abierta para este artículo";
  if (/function .*(open_dispute|confirm_receipt|report_external|resolve_dispute)/.test(msg))
    return "Falta aplicar la migración de disputas en la base de datos";
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
    const { data } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      // Diferido: no se deben llamar otras funciones de Supabase dentro del callback.
      setTimeout(async () => cb(session?.user ? await loadProfile(session.user) : null), 0);
    });
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
      ok(await supabase.from("stores").select("*").eq("active", true).order("created_at")) as Row[]
    ).map(toStore);
  },

  async getStore(slug) {
    const r = ok(await supabase.from("stores").select("*").eq("slug", slug).maybeSingle());
    return r ? toStore(r) : null;
  },

  async listAnnouncements() {
    const nowIso = new Date().toISOString();
    const rows = ok(
      await untyped
        .from("announcements")
        .select("*")
        .eq("active", true)
        .lte("starts_at", nowIso)
        .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(20),
    ) as Row[];
    return rows.map(toAnnouncement);
  },

  async isAdmin() {
    if (!(await currentUser())) return false;
    const { data, error } = await untyped.rpc("is_admin");
    return !error && data === true;
  },

  async allDisputes() {
    const rows = ok(
      await untyped
        .from("disputes")
        .select(DISPUTE_COLS)
        .order("status", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(500),
    ) as Row[];
    return rows.map(toDispute);
  },

  async resolveDispute(id, outcome, note, ban) {
    ok(
      await untyped.rpc("resolve_dispute", {
        p_id: id,
        p_outcome: outcome,
        p_note: note,
        p_ban: ban,
      }),
    );
  },

  async disputeAudit(id) {
    const rows = ok(await untyped.rpc("dispute_audit", { p_id: id })) as Row[];
    const r = rows[0];
    return r
      ? ({
          reporterEmail: r.reporter_email,
          reporterIp: r.reporter_ip,
          reporterAgent: r.reporter_agent,
          createdAt: r.created_at,
          ownerEmail: r.owner_email,
          ownerBannedAt: r.owner_banned_at,
        } satisfies DisputeAudit)
      : null;
  },

  async allAnnouncements() {
    const rows = ok(
      await untyped
        .from("announcements")
        .select("*")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false }),
    ) as Row[];
    return rows.map(toAnnouncement);
  },

  async saveAnnouncement(input) {
    const clean = normalizeAnnouncement(input);
    const problem = validateAnnouncement(clean);
    if (problem) throw new Error(problem);
    const { id, ...a } = clean;
    const row = {
      title: a.title,
      body: a.body,
      emoji: a.emoji,
      image: a.image,
      link: a.link,
      cta: a.cta,
      tone: a.tone,
      priority: a.priority,
      active: a.active,
      starts_at: a.startsAt,
      ends_at: a.endsAt,
    };
    const res = id
      ? await untyped.from("announcements").update(row).eq("id", id).select().single()
      : await untyped.from("announcements").insert(row).select().single();
    if (res.error?.message.includes("row-level security")) throw new Error("Solo administradores");
    return toAnnouncement(ok(res));
  },

  async deleteAnnouncement(id) {
    ok(await untyped.from("announcements").delete().eq("id", id));
  },

  async recentActivity() {
    const rows = ok(await untyped.rpc("recent_activity", { p_limit: 20 })) as Row[];
    return rows.map((r) => ({
      productId: r.product_id,
      productName: r.product_name,
      productEmoji: r.product_emoji,
      city: r.city,
      qty: r.qty,
      paidAt: r.paid_at,
    }));
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
    const res = await supabase.from("reviews").upsert(
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
    const { shipsNational, ...rest } = input;
    const row = {
      ...rest,
      owner_id: u.id,
      whatsapp: input.whatsapp || null,
      ships_national: shipsNational,
    };
    const upsert = (data: Row) =>
      untyped.from("stores").upsert(data, { onConflict: "owner_id" }).select().single();
    let res = await upsert(row);
    // Base de datos sin la migración de perfil de tienda: se guarda sin el campo nuevo.
    if (res.error?.message.includes("ships_national")) {
      const { ships_national: _skip, ...legacy } = row;
      res = await upsert(legacy);
    }
    return toStore(ok(res));
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
    const { compareAtPrice, promoCopy, promoImage, ...rest } = p;
    const row = {
      ...rest,
      compare_at_price: compareAtPrice,
      promo_copy: promoCopy,
      promo_image: promoImage || null,
      store_id: store.id,
    };
    const q = id
      ? untyped.from("products").update(row).eq("id", id).select(PRODUCT_COLS).single()
      : untyped.from("products").insert(row).select(PRODUCT_COLS).single();
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
      await supabase.storage
        .from("product-images")
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

  async setFulfillment(itemId, status, tracking, carrier) {
    ok(
      await untyped.rpc("set_fulfillment", {
        p_item_id: itemId,
        p_status: status,
        ...(tracking !== undefined ? { p_tracking: tracking } : {}),
        ...(carrier !== undefined ? { p_carrier: carrier } : {}),
      }),
    );
  },

  async storeDisputes() {
    const store = await this.myStore();
    if (!store) return [];
    const rows = ok(
      await untyped
        .from("disputes")
        .select(DISPUTE_COLS)
        .eq("store_id", store.id)
        .eq("kind", "plazax_pay")
        .order("created_at", { ascending: false }),
    ) as Row[];
    return rows.map(toDispute);
  },

  async respondDispute(id, response) {
    ok(await untyped.rpc("respond_dispute", { p_id: id, p_response: response }));
  },

  async confirmReceipt(itemId) {
    ok(await untyped.rpc("confirm_receipt", { p_item_id: itemId }));
  },

  async openDispute(itemId, input) {
    return ok(
      await untyped.rpc("open_dispute", {
        p_item_id: itemId,
        p_reason: input.reason,
        p_details: input.details,
        p_evidence: input.evidence,
      }),
    ) as string;
  },

  async reportExternal(input) {
    return ok(
      await untyped.rpc("report_external", {
        p_store_slug: input.storeSlug,
        p_contact: input.contact,
        p_reason: input.reason,
        p_details: input.details,
        p_evidence: input.evidence,
      }),
    ) as string;
  },

  async myDisputes() {
    const u = await currentUser();
    if (!u) return [];
    const rows = ok(
      await untyped
        .from("disputes")
        .select(DISPUTE_COLS)
        .eq("reporter_id", u.id)
        .order("created_at", { ascending: false }),
    ) as Row[];
    return rows.map(toDispute);
  },

  async uploadEvidence(file) {
    const u = await requireUser();
    if (file.size > 10 * 1024 * 1024) throw new Error("El archivo supera 10 MB");
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${u.id}/${crypto.randomUUID()}.${ext}`;
    ok(
      await supabase.storage
        .from("dispute-evidence")
        .upload(path, file, { contentType: file.type }),
    );
    return `evidence:${path}`;
  },

  async evidenceUrl(ref) {
    if (ref.startsWith("https://")) return ref;
    if (!ref.startsWith("evidence:")) return null;
    const { data } = await supabase.storage
      .from("dispute-evidence")
      .createSignedUrl(ref.slice("evidence:".length), 600);
    return data?.signedUrl ?? null;
  },

  async createOrder(lines, ref, shipping) {
    const data = ok(
      await supabase.rpc("create_order", {
        p_items: lines.map((l) => ({ product_id: l.productId, qty: l.qty })),
        p_ref: ref ?? "",
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
    const r = rows[0] ?? { pending: 0, available: 0, withdrawn: 0, frozen: 0 };
    return {
      pending: r.pending,
      available: r.available,
      withdrawn: r.withdrawn,
      frozen: r.frozen ?? 0,
    };
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
