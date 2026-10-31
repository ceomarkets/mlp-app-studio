import { useNavigate } from "@tanstack/react-router";
import { useCartDetails } from "@/components/CartSheet";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { BUNDLE_MIN, BUNDLE_RATE, cop } from "@/lib/plaza";
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

/** Barra fija del desafío (debajo de la cabecera). */
export function RewardsBar() {
  const r = useRewards();
  if (BUNDLE_RATE <= 0) return null;
  return (
    <div className="sticky top-16 z-40 border-b border-amber-300/40 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-500 text-slate-950 shadow-lg shadow-orange-500/20">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-1.5 text-xs sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex shrink-0 animate-pulse items-center gap-1 rounded-full border border-amber-400/50 bg-slate-950 px-2.5 py-0.5 text-[11px] font-black text-amber-400 shadow-sm">
            <i className="fa-solid fa-fire-flame-curved text-[10px] text-orange-400" /> Desafío{" "}
            {BUNDLE_MIN}={r.off}% OFF
          </span>
          <p className="truncate text-[11px] font-extrabold tracking-tight text-slate-950 sm:text-xs">
            {r.unlocked ? (
              <span className="font-extrabold text-emerald-950">
                ¡FELICIDADES! 🎉 Tienes {r.off}% OFF en tu compra ({cop(r.discount)} menos).
              </span>
            ) : r.count === 0 ? (
              `¡Agrega ${BUNDLE_MIN} productos y llévate ${r.off}% OFF en tu compra!`
            ) : (
              `¡Solo te falta${r.missing > 1 ? "n" : ""} ${r.missing} producto${r.missing > 1 ? "s" : ""} para tu ${r.off}% OFF!`
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded bg-amber-300/60 px-1.5 py-0.5 text-[11px] font-black text-slate-950">
              {r.count} / {BUNDLE_MIN}
            </span>
            <div className="h-2 w-16 overflow-hidden rounded-full border border-amber-300/50 bg-slate-950/80 p-0.5 sm:w-24">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-yellow-300 to-emerald-300 shadow-md transition-all duration-500"
                style={{ width: `${r.pct}%` }}
              />
            </div>
          </div>
          <button
            onClick={rewardsUI.open}
            className="hidden transform rounded-md border border-slate-900 bg-slate-950 px-2.5 py-1 text-[10px] font-black text-white shadow-md transition hover:scale-105 hover:bg-slate-900 sm:block sm:text-[11px]"
          >
            Ver Premio
          </button>
        </div>
      </div>
    </div>
  );
}

/** Centro de premios: solo muestra ventajas que existen de verdad. */
export function RewardsModal() {
  const open = rewardsUI.use();
  const navigate = useNavigate();
  const r = useRewards();
  return (
    <Dialog open={open} onOpenChange={rewardsUI.set}>
      <DialogContent className="max-w-lg overflow-hidden rounded-2xl border border-amber-500/40 bg-slate-900 p-6 text-slate-100 shadow-2xl [&>button]:text-slate-400">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-16 animate-bounce items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-3xl font-black text-slate-950 shadow-xl shadow-amber-500/20 motion-reduce:animate-none">
            <i className="fa-solid fa-gift" />
          </div>
          <DialogTitle className="text-2xl font-black text-white">
            Centro de Premios Plaza X
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs text-slate-400">
            Acumula artículos en tus compras y desbloquea premios exclusivos
          </DialogDescription>
        </div>

        <div className="mb-6 space-y-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300">Nivel de Desafío Actual:</span>
            <span className="font-black text-amber-400">
              {r.count} de {BUNDLE_MIN} Productos
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full border border-slate-800 bg-slate-900">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${r.pct}%` }}
            />
          </div>
          <p className="text-center text-[11px] text-slate-400">
            {r.unlocked ? (
              <strong className="text-emerald-400">
                ¡Tu {r.off}% OFF ya está aplicado: ahorras {cop(r.discount)}!
              </strong>
            ) : (
              <>
                ¡Agrega {r.missing} producto(s) más para reclamar tu <strong>{r.off}% OFF</strong>!
              </>
            )}
          </p>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Tus Ventajas de Comprador:
          </h4>
          <Perk
            icon="fa-shield-halved text-indigo-400"
            title="Pago 100% Seguro"
            text="Tarjeta, PSE, Nequi o Bancolombia con Wompi"
            on
            label="ACTIVO"
          />
          <Perk
            icon="fa-ticket-simple text-amber-400"
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
    <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/80 p-3">
      <div className="flex items-center gap-3">
        <i className={cn("fa-solid text-lg", icon)} />
        <div>
          <h5 className="text-xs font-bold text-white">{title}</h5>
          <p className="text-[10px] text-slate-400">{text}</p>
        </div>
      </div>
      <span
        className={cn(
          "rounded px-2 py-0.5 text-[10px] font-bold",
          on
            ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-400"
            : "bg-slate-800 text-slate-400",
        )}
      >
        {label}
      </span>
    </div>
  );
}
