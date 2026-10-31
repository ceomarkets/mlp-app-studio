import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCartDetails } from "@/components/CartSheet";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { backend, type Raffle } from "@/lib/backend";
import { BUNDLE_MIN, BUNDLE_RATE, cop } from "@/lib/plaza";
import { useUser } from "@/lib/session";
import { rewardsUI } from "@/lib/ui-state";
import { cn } from "@/lib/utils";

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

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });

/** Barra fija del desafío (debajo de la cabecera). */
export function RewardsBar() {
  const r = useRewards();
  const { raffle, open } = useRaffle();
  if (open && raffle) return <RaffleBar raffle={raffle} count={r.count} />;
  if (BUNDLE_RATE <= 0) return null;
  return (
    <div className="relative z-40 w-full bg-gradient-to-r from-orange-500 via-orange-400 to-amber-500 px-4 py-2 text-white shadow-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 text-xs font-semibold">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-black/30 px-2.5 py-1 text-[11px] font-bold tracking-wide text-yellow-200 uppercase">
            <i className="fa-solid fa-fire text-amber-200" /> Desafío {BUNDLE_MIN} = {r.off}% OFF
          </span>
          <span className="truncate text-xs font-bold sm:text-sm">
            {r.unlocked
              ? `¡Listo! 🎉 Tienes ${r.off}% OFF (${cop(r.discount)} menos)`
              : r.count === 0
                ? `¡Agrega ${BUNDLE_MIN} productos y llévate ${r.off}% OFF!`
                : `¡Te falta${r.missing > 1 ? "n" : ""} ${r.missing} para tu ${r.off}% OFF!`}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="rounded-md bg-white/40 px-2 py-0.5 text-xs font-extrabold text-slate-900">
            {Math.min(r.count, BUNDLE_MIN)}/{BUNDLE_MIN}
          </span>
          <div className="hidden h-2 w-24 overflow-hidden rounded-full border border-white/30 bg-black/20 sm:block">
            <div
              className="h-full bg-yellow-300 transition-all duration-300"
              style={{ width: `${r.pct}%` }}
            />
          </div>
          <button
            onClick={rewardsUI.open}
            className="hidden rounded-lg bg-slate-900 px-3 py-1 text-xs font-bold text-white shadow transition hover:bg-slate-800 sm:block"
          >
            Ver Premio
          </button>
        </div>
      </div>
    </div>
  );
}

/** Barra del sorteo autorizado: "Compra N productos y participa por …". */
function RaffleBar({ raffle, count }: { raffle: Raffle; count: number }) {
  const n = Math.min(count, raffle.minUnits);
  const pct = Math.round((n / raffle.minUnits) * 100);
  return (
    <div className="relative z-40 w-full bg-gradient-to-r from-orange-500 via-orange-400 to-amber-500 px-4 py-2 text-white shadow-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 text-xs font-semibold">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-black/30 px-2.5 py-1 text-[11px] font-bold tracking-wide text-yellow-200 uppercase">
            <i className="fa-solid fa-fire text-amber-200" /> Desafío {raffle.minUnits} = Premio
          </span>
          <span className="truncate text-xs font-bold sm:text-sm">
            {count >= raffle.minUnits
              ? `¡Listo! Al pagar participas por ${raffle.prize}`
              : `¡Compra ${raffle.minUnits} productos y participa por ${raffle.prize}!`}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="rounded-md bg-white/40 px-2 py-0.5 text-xs font-extrabold text-slate-900">
            {n}/{raffle.minUnits}
          </span>
          <div className="hidden h-2 w-24 overflow-hidden rounded-full border border-white/30 bg-black/20 sm:block">
            <div
              className="h-full bg-yellow-300 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <button
            onClick={rewardsUI.open}
            className="hidden rounded-lg bg-slate-900 px-3 py-1 text-xs font-bold text-white shadow transition hover:bg-slate-800 sm:block"
          >
            Ver Premio
          </button>
        </div>
      </div>
    </div>
  );
}
