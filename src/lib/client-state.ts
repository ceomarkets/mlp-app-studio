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
type Ref = { username: string; at: number } | null;
const refStore = persisted<Ref>("plazax-ref", null);

export const referral = {
  set(username: string) {
    refStore.set({ username: username.toLowerCase(), at: Date.now() });
  },
  /** Usuario del afiliado si el clic fue en los últimos 30 días. */
  active(): string | null {
    const r = refStore.get();
    return r && Date.now() - r.at < REF_WINDOW_DAYS * 86_400_000 ? r.username : null;
  },
  clear() {
    refStore.set(null);
  },
};

export function useReferral() {
  const r = useSyncExternalStore(refStore.subscribe, refStore.get, () => refStore.initial);
  return r && Date.now() - r.at < REF_WINDOW_DAYS * 86_400_000 ? r.username : null;
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
