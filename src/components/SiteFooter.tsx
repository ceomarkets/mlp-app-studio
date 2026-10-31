import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BridgeLogo } from "@/components/BridgeLogo";
import { backend } from "@/lib/backend";
import { LEGAL_SECTIONS, SUPPORT_EMAIL } from "@/lib/legal";
import { relTime } from "@/lib/feed";
import { cn } from "@/lib/utils";

/** Pie de página con el marco legal colombiano. */
export function SiteFooter() {
  const footerLinks = LEGAL_SECTIONS.filter((s) => s.footer);
  return (
    <footer className="mt-auto border-t border-slate-800 bg-slate-900 px-4 pt-12 pb-8 text-xs text-slate-400">
      <div className="mx-auto mb-8 grid max-w-7xl grid-cols-1 gap-8 md:grid-cols-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-lg font-extrabold text-white">
            <BridgeLogo className="size-7" />
            Plaza <span className="text-indigo-400">X</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            Plataforma multitienda y red de afiliación comercial en Colombia. Conectamos
            compradores, tiendas verificadas y afiliados independientes con transparencia y
            cumplimiento normativo.
          </p>
        </div>
        <div>
          <h4 className="mb-3 text-xs font-bold tracking-wider text-white uppercase">
            Marco Legal Colombia
          </h4>
          <ul className="space-y-2 text-[11px]">
            {footerLinks.map((s) => (
              <li key={s.id}>
                <Link to="/legal" hash={s.id} className="transition hover:text-white">
                  {s.footer}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-xs font-bold tracking-wider text-white uppercase">
            Atención al Consumidor
          </h4>
          <ul className="space-y-2 text-[11px]">
            <li className="flex items-center gap-2">
              <i className="fa-solid fa-headset text-indigo-400" /> Soporte:{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-white">
                {SUPPORT_EMAIL}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <i className="fa-solid fa-location-dot text-indigo-400" /> Cobertura: todo el
              territorio nacional (Colombia)
            </li>
            <li className="flex items-center gap-2">
              <i className="fa-solid fa-building-columns text-indigo-400" /> Vigilado por la
              Superintendencia de Industria y Comercio (SIC)
            </li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-xs font-bold tracking-wider text-white uppercase">
            ¿Un problema con tu compra?
          </h4>
          <p className="mb-2 text-[11px]">
            Si pagaste en el carrito de Plaza X, tu dinero queda en custodia hasta que confirmes la
            entrega.
          </p>
          <div className="flex flex-col gap-2">
            <Link
              to="/cuenta"
              className="flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-800/80 px-3 py-2 font-bold text-white transition hover:bg-slate-800"
            >
              <i className="fa-solid fa-shield-halved text-amber-400" /> Abrir disputa / Reportar
              problema
            </Link>
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 border-t border-slate-800 pt-6 text-[11px]">
        <p>
          © {new Date().getFullYear()} Plaza X Colombia. Cumplimiento de la Ley 1480 de 2011 y la
          normativa de comercio electrónico.
        </p>
        <div className="flex items-center gap-4">
          <Link to="/legal" className="font-semibold transition hover:text-white">
            Términos y Condiciones
          </Link>
          <span>·</span>
          <Link to="/legal" hash="habeas" className="font-semibold transition hover:text-white">
            Política de Privacidad
          </Link>
        </div>
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
  const [closed, setClosed] = useState(false);

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
        "fixed bottom-20 left-4 z-40 flex max-w-xs items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-xs shadow-xl transition-all duration-500 md:bottom-6 md:left-6",
        item ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-20 opacity-0",
      )}
    >
      {item && (
        <>
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-lg">
            {item.productEmoji || "🛍️"}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-800">
              {item.qty > 1 ? `${item.qty} × ` : ""}
              {item.productName}
            </p>
            <p className="text-[10px] text-slate-500">
              <i className="fa-solid fa-circle-check text-emerald-500" /> Comprado en{" "}
              {item.city || "Colombia"} · {relTime(item.paidAt)}
            </p>
          </div>
          <button
            onClick={() => setClosed(true)}
            aria-label="Ocultar avisos de compras"
            className="ml-1 self-start text-slate-400 hover:text-slate-600"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </>
      )}
    </div>
  );
}
