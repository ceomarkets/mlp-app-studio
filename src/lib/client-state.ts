import { useSyncExternalStore } from "react";
import { REF_WINDOW_DAYS } from "@/lib/plaza";
import type { CartLine } from "@/lib/backend";

/** Pequeño almacén persistente en localStorage, seguro en SSR. */
function persisted<T>(key: string, initial: T) {
  let value: T = initial;
  let loaded = false;
  const subs = new Set<() => void>();

  const load = () => {
    if (loaded || typeof window === "undefined") return;
    loaded = true;
    try {
      const raw = localStorage.getItem(key);
      if (raw) value = JSON.parse(raw) as T;
    } catch {
      /* ignorar */
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (e.key !== key) return;
      loaded = false;
      load();
      subs.forEach((s) => s());
    });
  }

  return {
    get: () => {
      load();
      return value;
    },
    set: (next: T) => {
      load();
      value = next;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* ignorar */
      }
      subs.forEach((s) => s());
    },
    subscribe: (fn: () => void) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    initial,
  };
}

// ---------------------------------------------------------------------------
// Carrito
// ---------------------------------------------------------------------------
const cartStore = persisted<CartLine[]>("plazax-cart", []);

export const cart = {
  add(productId: string, qty = 1, max = 99) {
    const lines = cartStore.get();
    const found = lines.find((l) => l.productId === productId);
    cartStore.set(
      found
        ? lines.map((l) =>
            l.productId === productId ? { ...l, qty: Math.min(max, l.qty + qty) } : l,
          )
        : [...lines, { productId, qty: Math.min(max, qty) }],
    );
  },
  setQty(productId: string, qty: number) {
    cartStore.set(
      qty <= 0
        ? cartStore.get().filter((l) => l.productId !== productId)
        : cartStore
            .get()
            .map((l) => (l.productId === productId ? { ...l, qty: Math.min(99, qty) } : l)),
    );
  },
  remove(productId: string) {
    cartStore.set(cartStore.get().filter((l) => l.productId !== productId));
  },
  clear() {
    cartStore.set([]);
  },
};

export function useCart() {
  return useSyncExternalStore(cartStore.subscribe, cartStore.get, () => cartStore.initial);
}

// ---------------------------------------------------------------------------
// Referido (atribución de afiliado por 30 días)
// ---------------------------------------------------------------------------
type Ref = { username: string; at: number; source?: string | null } | null;
const refStore = persisted<Ref>("plazax-ref", null);
const REF_COOKIE = "plazax_ref";
const live = (r: Ref) => !!r && Date.now() - r.at < REF_WINDOW_DAYS * 86_400_000;

/** Canal del enlace (src / utm_source): letras, números, - y _, en minúsculas. */
export const cleanSource = (v: string | null | undefined) =>
  (v ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 40) || null;

/** Cookie propia de 30 días con la misma atribución (sobrevive si se borra el almacenamiento). */
function writeCookie(r: Ref) {
  try {
    document.cookie = r
      ? `${REF_COOKIE}=${encodeURIComponent(`${r.username}|${r.source ?? ""}|${r.at}`)}; Max-Age=${REF_WINDOW_DAYS * 86_400}; Path=/; SameSite=Lax`
      : `${REF_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  } catch {
    /* sin cookies */
  }
}

function readCookie(): Ref {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${REF_COOKIE}=([^;]*)`));
    if (!m) return null;
    const [username, source, at] = decodeURIComponent(m[1]!).split("|");
    return username ? { username, source: source || null, at: Number(at) || Date.now() } : null;
  } catch {
    return null;
  }
}

/** Atribución del afiliado: 30 días, último clic gana. */
export const referral = {
  set(username: string, source?: string | null) {
    const r = { username: username.toLowerCase(), at: Date.now(), source: cleanSource(source) };
    refStore.set(r);
    writeCookie(r);
  },
  /** Usuario del afiliado si el clic fue en los últimos 30 días. */
  active(): string | null {
    const r = refStore.get() ?? readCookie();
    return live(r) ? r!.username : null;
  },
  /** Canal del último clic vigente. */
  source(): string | null {
    const r = refStore.get() ?? readCookie();
    return live(r) ? (r!.source ?? null) : null;
  },
  clear() {
    refStore.set(null);
    writeCookie(null);
  },
  /** Si se borró el almacenamiento pero queda la cookie, la atribución se recupera. */
  hydrate() {
    if (refStore.get()) return;
    const c = readCookie();
    if (live(c)) refStore.set(c);
  },
};

export function useReferral() {
  const r = useSyncExternalStore(refStore.subscribe, refStore.get, () => refStore.initial);
  return live(r) ? r!.username : null;
}

// ---------------------------------------------------------------------------
// Favoritos y vistos recientemente (alimentan la sección "Para ti")
// ---------------------------------------------------------------------------
const favStore = persisted<string[]>("plazax-favs", []);
const viewedStore = persisted<string[]>("plazax-viewed", []);

export const favorites = {
  toggle(productId: string) {
    const list = favStore.get();
    const has = list.includes(productId);
    favStore.set(has ? list.filter((id) => id !== productId) : [productId, ...list].slice(0, 100));
    return !has;
  },
};

export function useFavorites() {
  return useSyncExternalStore(favStore.subscribe, favStore.get, () => favStore.initial);
}

export const viewed = {
  add(productId: string) {
    viewedStore.set(
      [productId, ...viewedStore.get().filter((id) => id !== productId)].slice(0, 20),
    );
  },
};

export function useViewed() {
  return useSyncExternalStore(viewedStore.subscribe, viewedStore.get, () => viewedStore.initial);
}
