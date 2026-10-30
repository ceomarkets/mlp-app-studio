import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Flame,
  HandCoins,
  LayoutGrid,
  Megaphone,
  Pause,
  Play,
  Sparkles,
  Star,
  Store,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  AnnouncementCard,
  AnnouncementDialog,
  useOpenAnnouncement,
} from "@/components/AnnouncementCard";
import { QuickView } from "@/components/QuickView";
import { ProductImage } from "@/components/Shell";
import { backend, type Announcement, type Product } from "@/lib/backend";
import {
  buildLeaderboard,
  discountPct,
  temperatures,
  type BoardFilter,
  type BoardItem,
} from "@/lib/feed";
import { clampCommission, cop, splitSale } from "@/lib/plaza";
import { keys } from "@/lib/session";
import { cn } from "@/lib/utils";

const FILTERS: { id: BoardFilter; label: string; icon: LucideIcon }[] = [
  { id: "all", label: "Todos", icon: LayoutGrid },
  { id: "news", label: "Anuncios", icon: Megaphone },
  { id: "deals", label: "Descuentos", icon: Flame },
  { id: "earn", label: "Comisiones", icon: HandCoins },
  { id: "new", label: "Recientes", icon: Sparkles },
  { id: "top", label: "Top Ventas", icon: Trophy },
  { id: "rated", label: "Mejor valorados", icon: Star },
  { id: "stores", label: "Tiendas top", icon: Store },
];

/** Insignias translúcidas con borde: mismos colores que el código de referencia. */
const BADGE: Record<Exclude<BoardFilter, "all">, string> = {
  news: "border-indigo-500/30 bg-indigo-500/20 text-indigo-400",
  deals: "border-red-500/30 bg-red-500/20 text-red-400",
  earn: "border-emerald-500/30 bg-emerald-500/20 text-emerald-400",
  new: "border-indigo-500/30 bg-indigo-500/20 text-indigo-400",
  top: "border-amber-500/30 bg-amber-500/20 text-amber-400",
  rated: "border-purple-500/30 bg-purple-500/20 text-purple-400",
  stores: "border-sky-500/30 bg-sky-500/20 text-sky-400",
};

function badgeText(it: BoardItem) {
  switch (it.filter) {
    case "news":
      return it.badge;
    case "deals":
      return it.kind === "product" ? `OFERTA −${discountPct(it.product)}%` : "OFERTA";
    case "earn":
      return it.kind === "product"
        ? `${Math.round(clampCommission(it.product.commission) * 100)}% COMISIÓN`
        : "COMISIÓN";
    case "new":
      return "RECIÉN LANZADO";
    case "top":
      return `TOP #${it.rank} VENTAS`;
    case "rated":
      return "MEJOR VALORADO";
    case "stores":
      return `TIENDA TOP #${it.rank}`;
  }
}

/**
 * Cinta dinámica de la portada (leaderboard en vivo): corre de derecha a izquierda
 * con los anuncios de la administración, descuentos, comisiones para afiliados, recientes, top ventas, mejor
 * valorados y tiendas top.
 * Se pausa al pasar el cursor, con el foco del teclado o con el botón de pausa;
 * al hacer clic abre la vista rápida del producto (o la tienda).
 */
export function Leaderboard({ products }: { products: Product[] }) {
  const [filter, setFilter] = useState<BoardFilter>("all");
  const [paused, setPaused] = useState(false);
  const [open, setOpen] = useState<Product | null>(null);
  const [notice, setNotice] = useState<Announcement | null>(null);
  const navigate = useNavigate();
  const openAnnouncement = useOpenAnnouncement();
  // Anuncios publicados por la administración: se refrescan cada minuto.
  const announcements = useQuery({
    queryKey: keys.announcements,
    queryFn: () => backend.listAnnouncements(),
    refetchInterval: 60_000,
  });
  const hasNews = (announcements.data?.length ?? 0) > 0;
  const activity = useQuery({
    queryKey: ["catalog", "activity"],
    queryFn: () => backend.recentActivity(),
    refetchInterval: 60_000,
  });
  const items = useMemo(
    () =>
      buildLeaderboard(products, activity.data ?? [], filter, Date.now(), 8, announcements.data),
    [products, activity.data, filter, announcements.data],
  );

  const temps = useMemo(
    () => temperatures(products, activity.data ?? []),
    [products, activity.data],
  );

  // Se repite la lista hasta llenar la pista; luego se duplica para el bucle sin cortes.
  const loop = useMemo(() => {
    if (!items.length) return [];
    const out: BoardItem[] = [];
    while (out.length < 10) out.push(...items);
    return out;
  }, [items]);
  const duration = `${Math.max(35, loop.length * 4)}s`;

  const select = (it: BoardItem) => {
    if (it.kind === "product") return setOpen(it.product);
    if (it.kind === "store")
      return navigate({ to: "/tienda/$slug", params: { slug: it.store.slug } });
    // Anuncio: va a su enlace; si no tiene, se muestra completo.
    if (!openAnnouncement(it.announcement)) setNotice(it.announcement);
  };

  return (
    <section
      aria-labelledby="board-title"
      className="w-full border-y border-slate-800 bg-slate-900 py-4 font-sans text-slate-100"
    >
      {/* Encabezado con filtros */}
      <div className="mx-auto mb-3 flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-2">
          <span className="relative flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75 motion-reduce:hidden" />
            <span className="relative inline-flex size-3 rounded-full bg-red-500" />
          </span>
          <h2
            id="board-title"
            className="text-xs font-bold uppercase tracking-widest text-slate-300 sm:text-sm"
          >
            Leaderboard en vivo
          </h2>
        </div>

        <div className="flex max-w-full items-center gap-2">
          <div
            role="tablist"
            aria-label="Filtrar leaderboard"
            className="rail flex gap-2 overflow-x-auto text-xs"
          >
            {FILTERS.filter((f) => f.id !== "news" || hasNews).map((f) => (
              <button
                key={f.id}
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 font-medium transition",
                  filter === f.id
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700",
                )}
              >
                <f.icon className="size-3.5" /> {f.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setPaused(!paused)}
            aria-pressed={paused}
            aria-label={paused ? "Reanudar" : "Pausar"}
            className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-800 text-slate-300 transition hover:bg-slate-700"
          >
            {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
          </button>
        </div>
      </div>

      {/* Carrusel (derecha a izquierda) */}
      {loop.length ? (
        <div
          className="board board-mask relative w-full overflow-hidden"
          data-paused={paused || undefined}
        >
          <div className="board-track flex w-max" style={{ animationDuration: duration }}>
            {[0, 1].map((copy) => (
              <ul
                key={`${filter}-${copy}`}
                className="flex shrink-0 gap-4 pr-4"
                aria-hidden={copy === 1 || undefined}
              >
                {loop.map((it, i) => (
                  <li key={`${it.key}-${i}`}>
                    {it.kind === "announcement" ? (
                      <AnnouncementCard
                        a={it.announcement}
                        tabbable={copy === 0}
                        onSelect={() => select(it)}
                      />
                    ) : (
                      <BoardCard
                        it={it}
                        temp={it.kind === "product" ? (temps.get(it.product.id) ?? 0) : 0}
                        tabbable={copy === 0}
                        onSelect={() => select(it)}
                      />
                    )}
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      ) : (
        <p className="px-4 py-2 text-sm text-slate-400">No hay elementos en esta categoría</p>
      )}

      {filter === "earn" && (
        <p className="mt-3 px-4 text-right text-xs text-slate-400">
          Comparte un producto y cobra cuando alguien compre.{" "}
          <Link
            to="/afiliados"
            className="inline-flex items-center gap-0.5 font-semibold text-indigo-400 hover:underline"
          >
            Activar mi enlace <ArrowRight className="size-3" />
          </Link>
        </p>
      )}

      <QuickView product={open} onClose={() => setOpen(null)} />
      <AnnouncementDialog a={notice} onClose={() => setNotice(null)} />
    </section>
  );
}

function BoardCard({
  it,
  temp,
  tabbable,
  onSelect,
}: {
  it: BoardItem;
  temp: number;
  tabbable: boolean;
  onSelect: () => void;
}) {
  const p = it.kind === "product" ? it.product : null;
  const off = p ? discountPct(p) : 0;
  const rate = p ? Math.round(clampCommission(p.commission) * 100) : 0;
  return (
    <button
      type="button"
      onClick={onSelect}
      tabIndex={tabbable ? 0 : -1}
      className="group w-80 shrink-0 cursor-pointer rounded-xl border border-slate-800 bg-slate-900 p-3 text-left transition-all duration-300 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 focus-visible:border-indigo-500 focus-visible:outline-none"
    >
      <span className="flex items-center gap-3">
        {/* Imagen con temperatura y descuento */}
        <span className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-slate-950">
          {p ? (
            <ProductImage
              p={p}
              className="size-full rounded-none bg-slate-950 text-4xl transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <span className="grid size-full place-items-center text-4xl">
              {it.kind === "store" && it.store.emoji}
            </span>
          )}
          {temp > 0 && (
            <span
              title="Temperatura: qué tan popular está ahora"
              className="absolute left-1 top-1 flex items-center gap-0.5 rounded bg-amber-500 px-1 text-[9px] font-black text-slate-950"
            >
              <Flame className="size-2.5" /> {temp}°
            </span>
          )}
          {off > 0 && (
            <span className="absolute bottom-1 left-1 rounded bg-red-600 px-1 text-[9px] font-bold text-white">
              −{off}%
            </span>
          )}
        </span>

        {/* Información */}
        <span className="min-w-0 flex-1">
          <span className="mb-1 flex items-center justify-between gap-1">
            <span
              className={cn(
                "truncate rounded-full border px-1.5 py-0.5 text-[9px] font-semibold",
                BADGE[it.filter],
              )}
            >
              {badgeText(it)}
            </span>
            {p && p.ratingCount > 0 && (
              <span className="flex shrink-0 items-center gap-1 text-[10px] text-slate-400">
                <Star className="size-3 fill-amber-400 text-amber-400" /> {p.rating.toFixed(1)}
              </span>
            )}
          </span>

          <span className="block truncate text-xs font-bold text-white transition-colors group-hover:text-indigo-400">
            {p ? p.name : it.kind === "store" && it.store.name}
          </span>
          <span className="mb-1 flex items-center gap-1 truncate text-[10px] text-slate-400">
            <Store className="size-3 shrink-0 text-slate-500" />
            {p
              ? p.store.name
              : it.kind === "store" && `${it.store.city} · ${it.products} productos`}
          </span>

          {p ? (
            /* Datos financieros: precio y lo que gana quien recomienda */
            <span className="mt-1 flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-950/80 p-1.5">
              <span className="flex flex-col">
                <span className="text-[9px] font-medium uppercase text-slate-500">Precio</span>
                <span className="text-xs font-bold text-slate-300">{cop(p.price)}</span>
              </span>
              <span className="h-6 w-px bg-slate-800" aria-hidden />
              <span className="flex flex-col text-right">
                <span className="flex items-center justify-end gap-0.5 text-[9px] font-bold uppercase text-emerald-400">
                  <HandCoins className="size-3" /> Ganas ({rate}%)
                </span>
                <span className="text-xs font-extrabold text-emerald-400">
                  {cop(splitSale(p.price, p.commission).affiliate)}
                </span>
              </span>
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-indigo-400">{it.metric}</span>
          )}
        </span>
      </span>
    </button>
  );
}
