import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { addToCart } from "@/components/CartSheet";
import { useRaffle } from "@/components/Rewards";
import { isExternal, isSafeLink } from "@/lib/announcements";
import { backend, type Product } from "@/lib/backend";
import { rememberCoupon } from "@/lib/coupon";
import { copShort, EXAMPLE_PRODUCTS } from "@/lib/examples";
import { discountPct } from "@/lib/feed";
import { BUNDLE_MIN, BUNDLE_RATE, cop } from "@/lib/plaza";
import { keys } from "@/lib/session";
import { cartUI, flashUI } from "@/lib/ui-state";
import { cn } from "@/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");
function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map(pad) as [
    string,
    string,
    string,
  ];
}

/** Venta flash vigente programada por la administración (o null). */
export function useFlashSale() {
  const q = useQuery({
    queryKey: ["catalog", "flash"],
    queryFn: () => backend.activeFlashSale(),
    refetchInterval: 60_000,
  });
  return q.data ?? null;
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

type StripItem = { key: string; icon: string; text: string; cta?: string; go: () => void };

/**
 * Cinta superior de anuncios (negro y dorado): rota con un desvanecido entre los anuncios
 * de la administración, la venta flash vigente, el sorteo autorizado y el descuento por volumen.
 */
export function AnnouncementStrip() {
  const navigate = useNavigate();
  const flash = useFlashSale();
  const { raffle, open: raffleOpen } = useRaffle();
  const announcements = useQuery({
    queryKey: keys.announcements,
    queryFn: () => backend.listAnnouncements(),
    refetchInterval: 60_000,
  });

  const items = useMemo<StripItem[]>(() => {
    const out: StripItem[] = [];
    if (flash)
      out.push({
        key: "flash",
        icon: "fa-bolt",
        text: `Ofertas Relámpago: ${flash.title}`,
        cta: "Ver ofertas",
        go: flashUI.open,
      });
    if (raffleOpen && raffle)
      out.push({
        key: "raffle",
        icon: "fa-gift",
        text: `Desafío ${raffle.minUnits} = Premio: compra ${raffle.minUnits} productos y participa por ${raffle.prize}`,
        cta: "Ver carrito",
        go: cartUI.open,
      });
    if (BUNDLE_RATE > 0)
      out.push({
        key: "bundle",
        icon: "fa-fire",
        text: `Compra ${BUNDLE_MIN} productos y llévate ${Math.round(BUNDLE_RATE * 100)}% OFF en tu pedido`,
        go: cartUI.open,
      });
    // Mensajes de la plataforma del diseño (siempre verdaderos en Plaza X).
    for (const [k, text] of [
      ["envios", "⚡ Envíos directos garantizados a toda Colombia con número de guía"],
      ["custodia", "🛡️ Pago protegido: custodia de fondos hasta que recibes tu pedido"],
      ["afiliados", "🚀 Gana comisiones como afiliado recomendando productos verificados"],
    ] as const)
      out.push({ key: k, icon: "", text, go: () => {} });
    for (const a of (announcements.data ?? []).slice(0, 6)) {
      const link = a.link && isSafeLink(a.link) ? a.link : null;
      out.push({
        key: a.id,
        icon: "fa-bullhorn",
        text: `${a.emoji ? `${a.emoji} ` : ""}${a.title}${a.body ? ` — ${a.body}` : ""}`,
        ...(link ? { cta: a.cta || "Ver más" } : {}),
        go: () => {
          if (!link) return;
          if (isExternal(link)) window.open(link, "_blank", "noopener,noreferrer");
          else navigate({ href: link });
        },
      });
    }
    return out;
  }, [flash, raffle, raffleOpen, announcements.data, navigate]);

  const [i, setI] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % items.length), 5000);
    return () => clearInterval(t);
  }, [items.length]);
  const it = items[i % Math.max(1, items.length)];
  if (!it) return null;

  return (
    <div className="relative z-40 flex w-full items-center justify-center overflow-hidden border-b border-amber-500/20 bg-slate-900/90 py-2 font-mono text-xs text-slate-300 shadow-sm">
      <button
        key={it.key}
        onClick={it.go}
        className="animate-fade-in-out flex min-h-0 items-center justify-center gap-2 px-4 text-center"
      >
        {it.icon && <i className={cn("fa-solid", it.icon)} />}
        <span className="line-clamp-1">{it.text}</span>
        {it.cta && <span className="shrink-0 font-bold text-amber-400 underline">{it.cta}</span>}
      </button>
    </div>
  );
}

/** Ventana de Ofertas Relámpago: productos con descuento real y cuenta regresiva real. */
export function FlashDealsModal() {
  const open = flashUI.use();
  const flash = useFlashSale();
  const now = useNow(open && !!flash);
  const products = useQuery({
    queryKey: keys.products({}),
    queryFn: () => backend.listProducts(),
    enabled: open,
  });
  const list = products.data ?? [];
  const deals = list.length
    ? list.filter((p) => discountPct(p) > 0).sort((a, b) => discountPct(b) - discountPct(a))
    : EXAMPLE_PRODUCTS;
  const left = flash ? Date.parse(flash.endsAt) - now : 0;
  const [h, m, s] = parts(left);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
      onClick={flashUI.close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ofertas Relámpago"
        onClick={(e) => e.stopPropagation()}
        className="gold-border-glow relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-3xl border border-amber-500/40 bg-slate-900 p-5 text-white shadow-2xl sm:p-6"
      >
        <button
          onClick={flashUI.close}
          aria-label="Cerrar"
          data-tip="Cerrar"
          className="absolute top-4 right-4 flex size-8 items-center justify-center rounded-full bg-slate-800 text-lg text-slate-400 transition hover:text-white"
        >
          <i className="fa-solid fa-xmark" />
        </button>

        <div className="mb-4 flex flex-col items-start justify-between gap-3 border-b border-slate-800 pr-8 pb-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 animate-pulse items-center justify-center rounded-xl border border-amber-400/40 bg-amber-500/20 text-lg text-amber-400">
              <i className="fa-solid fa-bolt" />
            </div>
            <div>
              <h2 className="flex flex-wrap items-center gap-2 text-base font-black tracking-tight text-white sm:text-lg">
                Ofertas Relámpago <span className="gold-gradient-text">⚡</span>
                {flash && (
                  <span className="me-1 animate-bounce rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black tracking-wider text-slate-950 uppercase">
                    ¡Por tiempo limitado!
                  </span>
                )}
              </h2>
              <p className="text-xs font-medium text-slate-400">
                {flash ? flash.title : "Oportunidades exclusivas con inventario limitado"}
              </p>
            </div>
          </div>

          {flash && left > 0 && (
            <div className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-slate-950 px-3.5 py-1.5 font-mono text-xs shadow-inner">
              <span className="me-1 font-sans text-[11px] font-bold text-slate-400 uppercase">
                Termina en:
              </span>
              {[h, m, s].map((v, k) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className="rounded-md border border-amber-500/20 bg-slate-800 px-2 py-0.5 font-extrabold text-amber-400">
                    {v}
                  </span>
                  {k < 2 && ":"}
                </span>
              ))}
            </div>
          )}
        </div>

        {flash?.couponCode && (
          <button
            onClick={() => rememberCoupon(flash.couponCode)}
            className="mb-4 self-start rounded-xl border border-dashed border-amber-400/60 bg-amber-500/10 px-3 py-1.5 font-mono text-xs font-bold text-amber-300"
          >
            Cupón {flash.couponCode} · se aplica al pagar
          </button>
        )}

        {deals.length ? (
          <div className="grid max-h-[60vh] grid-cols-1 gap-4 overflow-y-auto pr-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {deals.map((p) => (
              <DealCard key={p.id} p={p} />
            ))}
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-slate-400">
            <i className="fa-solid fa-box-open mb-2 block text-3xl text-slate-600" />
            Aún no hay productos en oferta. Quien vende (persona o empresa) puede poner un “precio
            antes” en sus productos desde su tienda.
          </p>
        )}
      </div>
    </div>
  );
}

function DealCard({ p }: { p: Product }) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-950 p-3">
      {p.images[0] ? (
        <img
          src={p.images[0]}
          alt=""
          loading="lazy"
          className="mb-2 h-28 w-full rounded-xl object-cover"
        />
      ) : (
        <span className="mb-2 grid h-28 place-items-center rounded-xl bg-slate-800 text-5xl">
          {p.emoji}
        </span>
      )}
      <h5 className="truncate text-xs font-bold text-white">{p.name}</h5>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs font-extrabold text-amber-400">{copShort(p.price)}</span>
        <button
          onClick={() => addToCart(p)}
          disabled={p.stock < 1}
          className="min-h-0 rounded-lg bg-amber-500 px-2.5 py-1 text-[10px] font-black text-slate-950 disabled:opacity-50"
        >
          {p.stock < 1 ? "Agotado" : "Añadir"}
        </button>
      </div>
    </div>
  );
}
