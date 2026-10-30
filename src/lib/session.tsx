import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { backend, type Profile } from "@/lib/backend";

export const keys = {
  me: ["me"] as const,
  products: (f: object) => ["catalog", "products", f] as const,
  product: (id: string) => ["catalog", "product", id] as const,
  stores: ["catalog", "stores"] as const,
  store: (slug: string) => ["catalog", "store", slug] as const,
  reviews: (id: string) => ["catalog", "reviews", id] as const,
  myStore: ["user", "store"] as const,
  myProducts: ["user", "products"] as const,
  sellerOrders: ["user", "seller-orders"] as const,
  myOrders: ["user", "orders"] as const,
  order: (id: string) => ["user", "order", id] as const,
  clicks: ["user", "clicks"] as const,
  affItems: ["user", "aff-items"] as const,
  wallet: ["user", "wallet"] as const,
  withdrawals: ["user", "withdrawals"] as const,
  announcements: ["catalog", "announcements"] as const,
  allAnnouncements: ["user", "announcements"] as const,
  isAdmin: ["user", "admin"] as const,
};

export function useUser(): { user: Profile | null; loading: boolean } {
  const q = useQuery({ queryKey: keys.me, queryFn: () => backend.getUser(), staleTime: Infinity });
  return { user: q.data ?? null, loading: q.isPending };
}

/** Mantiene la sesión sincronizada y limpia los datos privados al cambiar de usuario. */
export function SessionSync() {
  const qc = useQueryClient();
  useEffect(
    () =>
      backend.onAuthChange((u) => {
        const prev = qc.getQueryData<Profile | null>(keys.me);
        qc.setQueryData(keys.me, u);
        if (prev?.id !== u?.id) qc.removeQueries({ queryKey: ["user"] });
      }),
    [qc],
  );
  return null;
}

/** Redirige a /entrar si no hay sesión. Devuelve el usuario cuando está listo. */
export function useRequireUser(to: string) {
  const { user, loading } = useUser();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/entrar", search: { to } });
  }, [loading, user, navigate, to]);
  return { user, loading };
}
