import type { Category, PayoutMethod } from "@/lib/plaza";

export type Profile = {
  id: string;
  email: string;
  fullName: string;
  username: string | null;
  phone: string | null;
};

export type Store = {
  id: string;
  ownerId: string;
  slug: string;
  name: string;
  tagline: string;
  city: string;
  emoji: string;
  whatsapp: string | null;
  active: boolean;
};

export type StoreInput = Pick<Store, "slug" | "name" | "tagline" | "city" | "emoji" | "whatsapp">;

export type Product = {
  id: string;
  storeId: string;
  name: string;
  description: string;
  price: number;
  category: Category;
  commission: number;
  stock: number;
  images: string[];
  emoji: string;
  active: boolean;
  soldCount: number;
  rating: number;
  ratingCount: number;
  createdAt: string;
  store: Pick<Store, "slug" | "name" | "city" | "emoji">;
};

export type ProductInput = Pick<
  Product,
  | "name"
  | "description"
  | "price"
  | "category"
  | "commission"
  | "stock"
  | "images"
  | "emoji"
  | "active"
> & { id?: string };

export type Shipping = {
  name: string;
  phone: string;
  city: string;
  address: string;
  notes?: string;
};

export type OrderStatus = "pending" | "paid" | "failed" | "cancelled";
export type Fulfillment = "pending" | "preparing" | "shipped" | "delivered" | "cancelled";

export type OrderItem = {
  id: string;
  orderId: string;
  productId: string | null;
  storeId: string;
  productName: string;
  productEmoji: string;
  productImage: string | null;
  unitPrice: number;
  qty: number;
  subtotal: number;
  sellerAmount: number;
  affiliateAmount: number;
  platformAmount: number;
  affiliateId: string | null;
  paidAt: string | null;
  fulfillment: Fulfillment;
  tracking: string | null;
  deliveredAt: string | null;
  createdAt: string;
};

export type Order = {
  id: string;
  reference: string;
  buyerId: string;
  status: OrderStatus;
  total: number;
  shipping: Shipping;
  createdAt: string;
  paidAt: string | null;
  items: OrderItem[];
};

export type SellerOrderItem = OrderItem & {
  reference: string;
  orderStatus: OrderStatus;
  shipping: Shipping;
};

export type Click = { id: string; productId: string | null; createdAt: string };

export type Withdrawal = {
  id: string;
  amount: number;
  method: PayoutMethod;
  account: string;
  status: "requested" | "paid" | "rejected";
  createdAt: string;
};

export type Wallet = { pending: number; available: number; withdrawn: number };

export type Review = {
  id: string;
  productId: string;
  author: string;
  rating: number;
  comment: string;
  createdAt: string;
};

export type ProductFilter = {
  q?: string;
  category?: string;
  storeSlug?: string;
  sort?: "popular" | "new" | "price-asc" | "price-desc" | "commission";
};

export type CartLine = { productId: string; qty: number };

export interface Backend {
  readonly mode: "demo" | "supabase";

  // Sesión
  getUser(): Promise<Profile | null>;
  onAuthChange(cb: (user: Profile | null) => void): () => void;
  signUp(input: {
    email: string;
    password: string;
    fullName: string;
  }): Promise<{ needsConfirmation: boolean }>;
  signIn(input: { email: string; password: string }): Promise<void>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  updateProfile(input: {
    fullName?: string;
    username?: string;
    phone?: string | null;
  }): Promise<Profile>;
  usernameAvailable(username: string): Promise<boolean>;

  // Catálogo
  listProducts(filter?: ProductFilter): Promise<Product[]>;
  getProduct(id: string): Promise<Product | null>;
  listStores(): Promise<Store[]>;
  getStore(slug: string): Promise<Store | null>;
  listReviews(productId: string): Promise<Review[]>;
  addReview(productId: string, rating: number, comment: string): Promise<void>;

  // Vendedor
  myStore(): Promise<Store | null>;
  saveStore(input: StoreInput): Promise<Store>;
  myProducts(): Promise<Product[]>;
  saveProduct(input: ProductInput): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  uploadImage(file: File): Promise<string>;
  sellerOrders(): Promise<SellerOrderItem[]>;
  setFulfillment(itemId: string, status: Fulfillment, tracking?: string): Promise<void>;

  // Comprador
  createOrder(
    lines: CartLine[],
    ref: string | null,
    shipping: Shipping,
  ): Promise<{ orderId: string; reference: string; total: number }>;
  myOrders(): Promise<Order[]>;
  getOrder(id: string): Promise<Order | null>;
  /** Devuelve la URL a la que se envía al comprador para pagar. */
  startPayment(orderId: string, returnUrl: string): Promise<string>;
  /** Solo modo demo: simula la respuesta de la pasarela. */
  simulatePayment?(orderId: string, approved: boolean): Promise<void>;

  // Afiliado
  trackClick(username: string, productId: string): Promise<void>;
  myClicks(): Promise<Click[]>;
  myAffiliateItems(): Promise<OrderItem[]>;

  // Billetera
  wallet(): Promise<Wallet>;
  myWithdrawals(): Promise<Withdrawal[]>;
  requestWithdrawal(amount: number, method: PayoutMethod, account: string): Promise<void>;
}
