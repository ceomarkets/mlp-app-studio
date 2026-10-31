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

/** Sorteo dentro del centro de premios: premio, autorización, bases y mis oportunidades. */
function RaffleCard({ raffle, open }: { raffle: Raffle; open: boolean }) {
  const { user } = useUser();
  const entries = useQuery({
    queryKey: ["user", "raffle-entries", raffle.id],
    queryFn: () => backend.myRaffleEntries(raffle.id),
    enabled: !!user,
  });
  const won = useQuery({
    queryKey: ["user", "raffle-won", raffle.id],
    queryFn: () => backend.iWonRaffle(raffle.id),
    enabled: !!user && !!raffle.drawnAt,
  });
  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-amber-200 bg-amber-50">
      {raffle.prizeImage && (
        <img src={raffle.prizeImage} alt={raffle.prize} className="h-36 w-full object-cover" />
      )}
      <div className="space-y-2 p-4 text-xs text-slate-700">
        <p className="text-[11px] font-bold tracking-wide text-amber-700 uppercase">
          {raffle.title}
        </p>
        <p className="text-base font-black text-slate-900">
          🎁 {raffle.prize}
          {raffle.prizeValue ? (
            <span className="ms-1 text-xs font-semibold text-slate-500">
              (valor {cop(raffle.prizeValue)})
            </span>
          ) : null}
        </p>
        <p>
          Cada compra pagada de <b>{raffle.minUnits} o más productos</b> entre el{" "}
          {fmtDate(raffle.startsAt)} y el {fmtDate(raffle.endsAt)} es una oportunidad.
        </p>
        {user && (
          <p className="font-bold text-amber-800">
            {raffle.drawnAt
              ? won.data
                ? "🎉 ¡Ganaste! Te contactaremos para entregarte el premio."
                : `Sorteo realizado el ${fmtDate(raffle.drawnAt)}. La persona ganadora ya fue notificada.`
              : `Tienes ${entries.data ?? 0} oportunidad${entries.data === 1 ? "" : "es"}${open ? "" : " (cerrado, pronto el sorteo)"}.`}
          </p>
        )}
        <p className="border-t border-amber-200 pt-2 text-[10px] text-slate-500">
          Sorteo autorizado por Coljuegos · Autorización No. {raffle.coljuegosAuth}.{" "}
          {raffle.termsUrl && (
            <a
              href={raffle.termsUrl}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-indigo-600 underline"
            >
              Ver bases del sorteo
            </a>
          )}
        </p>
      </div>
    </div>
  );
}

/** Centro de premios: solo muestra ventajas que existen de verdad. */
export function RewardsModal() {
  const open = rewardsUI.use();
  const navigate = useNavigate();
  const r = useRewards();
  const { raffle, open: raffleOpen } = useRaffle();
  return (
    <Dialog open={open} onOpenChange={rewardsUI.set}>
      <DialogContent className="max-w-lg overflow-hidden rounded-2xl border border-amber-200 bg-white p-6 text-slate-900 shadow-2xl [&>button]:text-slate-500">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-16 animate-bounce items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-3xl font-black text-slate-950 shadow-xl shadow-amber-500/20 motion-reduce:animate-none">
            <i className="fa-solid fa-gift" />
          </div>
          <DialogTitle className="text-2xl font-black text-slate-900">
            Centro de Premios Plaza X
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs text-slate-500">
            Acumula artículos en tus compras y desbloquea premios exclusivos
          </DialogDescription>
        </div>

        <div className="mb-6 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-600">Nivel de Desafío Actual:</span>
            <span className="font-black text-amber-700">
              {r.count} de {BUNDLE_MIN} Productos
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full border border-slate-200 bg-white">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${r.pct}%` }}
            />
          </div>
          <p className="text-center text-[11px] text-slate-500">
            {r.unlocked ? (
              <strong className="text-emerald-600">
                ¡Tu {r.off}% OFF ya está aplicado: ahorras {cop(r.discount)}!
              </strong>
            ) : (
              <>
                ¡Agrega {r.missing} producto(s) más para reclamar tu <strong>{r.off}% OFF</strong>!
              </>
            )}
          </p>
        </div>

        {raffle && <RaffleCard raffle={raffle} open={raffleOpen} />}

        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Tus Ventajas de Comprador:
          </h4>
          <Perk
            icon="fa-shield-halved text-indigo-600"
            title="Pago 100% Seguro"
            text="Tarjeta, PSE, Nequi o Bancolombia con Wompi"
            on
            label="ACTIVO"
          />
          <Perk
            icon="fa-ticket-simple text-amber-700"
            title={`Descuento ${r.off}% OFF Extra`}
            text={`Al completar ${BUNDLE_MIN} artículos en el carrito`}
            on={r.unlocked}
            label={r.unlocked ? "DESBLOQUEADO" : "PENDIENTE"}
          />
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => {
              rewardsUI.close();
              navigate({ to: "/" });
            }}
            className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-xs font-black uppercase tracking-wider text-slate-950 shadow-lg shadow-amber-500/20 transition hover:from-amber-400 hover:to-orange-400"
          >
            Ir al Mercado a Elegir Productos
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Perk({
  icon,
  title,
  text,
  on,
  label,
}: {
  icon: string;
  title: string;
  text: string;
  on: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-3">
        <i className={cn("fa-solid text-lg", icon)} />
        <div>
          <h5 className="text-xs font-bold text-slate-900">{title}</h5>
          <p className="text-[10px] text-slate-500">{text}</p>
        </div>
      </div>
      <span
        className={cn(
          "rounded px-2 py-0.5 text-[10px] font-bold",
          on
            ? "border border-emerald-200 bg-emerald-50 text-emerald-600"
            : "bg-slate-100 text-slate-500",
        )}
      >
        {label}
      </span>
    </div>
  );
}
