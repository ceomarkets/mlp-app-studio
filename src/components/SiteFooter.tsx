import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { backend } from "@/lib/backend";
import { SUPPORT_EMAIL } from "@/lib/legal";
import { relTime } from "@/lib/feed";
import { cn } from "@/lib/utils";

/** Pie de página negro y dorado con el marco legal colombiano. */
export function SiteFooter() {
  const link = "transition hover:text-amber-400";
  return (
    <footer className="mt-auto border-t border-amber-500/20 bg-slate-950 px-4 pt-10 pb-6 text-xs text-slate-400">
      <div className="mx-auto mb-8 grid max-w-7xl grid-cols-1 gap-8 md:grid-cols-3">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-lg font-black tracking-tight text-white">
            Plaza <span className="gold-gradient-text">X</span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-400">
            Mercado multitienda y red de afiliación comercial en Colombia. Recaudos y dispersiones
            automatizadas procesados mediante pasarela de pagos.
          </p>
        </div>
        <div>
          <h4 className="mb-3 text-xs font-extrabold tracking-wider text-amber-400 uppercase">
            Marco Legal & SIC
          </h4>
          <ul className="space-y-2 text-[11px]">
            <li>
              <Link to="/legal" hash="retracto" className={link}>
                Derecho de Retracto (Ley 1480 de 2011)
              </Link>
            </li>
            <li>
              <Link to="/legal" hash="habeas" className={link}>
                Habeas Data (Ley 1581 de 2012)
              </Link>
            </li>
            <li>
              <Link to="/cuenta" hash="reportes" className={link}>
                Reportar Problema / Novedad
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-xs font-extrabold tracking-wider text-amber-400 uppercase">
            Contacto & Soporte
          </h4>
          <p className="mb-1 text-[11px] text-slate-400">
            Correo:{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className={link}>
              {SUPPORT_EMAIL}
            </a>
          </p>
          <p className="text-[11px] text-slate-400">
            Cobertura: Todo el territorio nacional en Colombia
          </p>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 border-t border-slate-900 pt-5 text-[10px]">
        <p>© {new Date().getFullYear()} Plaza X Colombia. Todos los derechos reservados.</p>
        <Link to="/legal" className={link}>
          Términos y Condiciones Generales
        </Link>
      </div>
    </footer>
  );
}

const TOAST_EVERY = 25_000;
const TOAST_FOR = 6_000;

/**
 * Aviso flotante de compras recientes. Solo usa ventas pagadas reales y nunca muestra
 * quién compró: producto, ciudad y hace cuánto.
 */
export function LiveActivityToast() {
  const activity = useQuery({
    queryKey: ["catalog", "activity"],
    queryFn: () => backend.recentActivity(),
    refetchInterval: 60_000,
  });
  const recent = (activity.data ?? []).filter(
    (a) => Date.now() - new Date(a.paidAt).getTime() < 3 * 86_400_000,
  );
  const [index, setIndex] = useState(-1);
  const closed = false;

  useEffect(() => {
    if (!recent.length || closed) return;
    let hide: ReturnType<typeof setTimeout> | undefined;
    const show = (i: number) => {
      setIndex(i % recent.length);
      hide = setTimeout(() => setIndex(-1), TOAST_FOR);
    };
    const first = setTimeout(() => show(0), 8_000);
    let n = 1;
    const loop = setInterval(() => show(n++), TOAST_EVERY);
    return () => {
      clearTimeout(first);
      clearInterval(loop);
      if (hide) clearTimeout(hide);
    };
  }, [recent.length, closed]);

  const item = index >= 0 ? recent[index] : undefined;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-3 z-40 md:bottom-6 md:left-6 flex max-w-xs items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-3 shadow-xl backdrop-blur-md transition-all duration-500",
        item ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-20 opacity-0",
      )}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-sm font-bold text-amber-400">
        <i className="fa-solid fa-bag-shopping" />
      </div>
      {item && (
        <div className="overflow-hidden text-xs">
          <p className="truncate font-medium text-slate-100">
            Alguien de {item.city || "Colombia"} compró {item.productName}
          </p>
          <span className="text-[10px] font-bold text-emerald-400">
            {relTime(item.paidAt).replace(/^h/, "H")} · Compra verificada
          </span>
        </div>
      )}
    </div>
  );
}
