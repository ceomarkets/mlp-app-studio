import { useQuery } from "@tanstack/react-query";
import { useCartDetails } from "@/components/CartSheet";
import { backend } from "@/lib/backend";
import { BUNDLE_MIN, BUNDLE_RATE } from "@/lib/plaza";

/** Progreso del premio por volumen: desde BUNDLE_MIN unidades, BUNDLE_RATE de descuento real. */
export function useRewards() {
  const { count, discount } = useCartDetails();
  const pct = Math.min(100, Math.round((count / BUNDLE_MIN) * 100));
  return {
    count,
    pct,
    discount,
    unlocked: count >= BUNDLE_MIN,
    off: Math.round(BUNDLE_RATE * 100),
    missing: Math.max(0, BUNDLE_MIN - count),
  };
}

/** Sorteo publicado (con autorización de Coljuegos). open: se puede participar ahora. */
export function useRaffle() {
  const q = useQuery({
    queryKey: ["catalog", "raffle"],
    queryFn: () => backend.currentRaffle(),
    refetchInterval: 5 * 60_000,
  });
  const r = q.data ?? null;
  const t = Date.now();
  const open = !!r && !r.drawnAt && Date.parse(r.startsAt) <= t && Date.parse(r.endsAt) > t;
  return { raffle: r, open };
}
