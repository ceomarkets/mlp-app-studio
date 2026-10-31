import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { backend } from "@/lib/backend";
import { rememberCoupon } from "@/lib/coupon";
import { isExternal, isSafeLink } from "@/lib/announcements";

const pad = (n: number) => String(n).padStart(2, "0");

export function countdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const hms = `${pad(h)} : ${pad(m)} : ${pad(s % 60)}`;
  return d > 0 ? `${d}d ${hms}` : hms;
}

/**
 * Venta flash programada por la administración. Solo aparece mientras está vigente y la
 * cuenta regresiva usa su fecha real de fin: nunca se reinicia ni se inventa.
 */
export function FlashSaleBanner() {
  const sale = useQuery({
    queryKey: ["catalog", "flash"],
    queryFn: () => backend.activeFlashSale(),
    refetchInterval: 60_000,
  });
  const navigate = useNavigate();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!sale.data) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [sale.data]);

  const f = sale.data;
  if (!f) return null;
  const left = Date.parse(f.endsAt) - now;
  if (left <= 0) return null;

  const cta = f.link && isSafeLink(f.link) ? f.link : null;
  return (
    <div className="border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex shrink-0 animate-pulse items-center gap-1 rounded-full bg-rose-600 px-2.5 py-1 text-[10px] font-black tracking-wider text-white uppercase motion-reduce:animate-none">
            <i className="fa-solid fa-bolt" /> Venta Flash
          </span>
          <span className="min-w-0">
            <b className="text-slate-800">{f.title}</b>
            {f.subtitle && <span className="ms-1 text-slate-500">{f.subtitle}</span>}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {f.couponCode && (
            <button
              onClick={() => {
                rememberCoupon(f.couponCode);
                void navigator.clipboard?.writeText(f.couponCode!).catch(() => {});
                toast.success(`Cupón ${f.couponCode} listo: se aplica al pagar`);
              }}
              className="rounded-lg border border-dashed border-rose-300 bg-rose-50 px-2.5 py-1 font-mono font-bold text-rose-700 hover:bg-rose-100"
              title="Usar este cupón"
            >
              {f.couponCode}
            </button>
          )}
          {cta &&
            (isExternal(cta) ? (
              <a href={cta} target="_blank" rel="noreferrer" className="font-bold text-indigo-600">
                Ver ofertas →
              </a>
            ) : (
              <button onClick={() => navigate({ href: cta })} className="font-bold text-indigo-600">
                Ver ofertas →
              </button>
            ))}
          <span className="text-slate-500">Termina en:</span>
          <time
            dateTime={f.endsAt}
            title={new Date(f.endsAt).toLocaleString("es-CO")}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1 font-mono text-xs font-bold tracking-wider text-amber-600 shadow-sm"
          >
            {countdown(left)}
          </time>
        </div>
      </div>
    </div>
  );
}
