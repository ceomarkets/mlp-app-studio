import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  BadgePercent,
  Flame,
  HandCoins,
  History,
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
import { useMemo, useState, type ReactNode } from "react";
import {
  AnnouncementCard,
  AnnouncementDialog,
  useOpenAnnouncement,
} from "@/components/AnnouncementCard";
import { QuickView } from "@/components/QuickView";
import { platformAnnouncements } from "@/lib/announcements";
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

const FILTERS: { id: BoardFilter; label: string; icon: LucideIcon; tint: string }[] = [
  { id: "all", label: "Todos", icon: LayoutGrid, tint: "" },
  { id: "today", label: "Lo Nuevo de Hoy", icon: Flame, tint: "text-orange-500" },
  { id: "viewed", label: "Recientes", icon: History, tint: "text-indigo-600" },
  { id: "earn", label: "Altas Comisiones", icon: HandCoins, tint: "text-emerald-600" },
  { id: "news", label: "Anuncios", icon: Megaphone, tint: "text-indigo-600" },
  { id: "deals", label: "Descuentos", icon: BadgePercent, tint: "text-red-500" },
  { id: "new", label: "Lanzamientos", icon: Sparkles, tint: "text-indigo-600" },
  { id: "top", label: "Top Ventas", icon: Trophy, tint: "text-amber-500" },
  { id: "rated", label: "Mejor valorados", icon: Star, tint: "text-amber-500" },
  { id: "stores", label: "Tiendas top", icon: Store, tint: "text-sky-600" },
];

const EMPTY: Partial<Record<BoardFilter, string>> = {
  today: "Hoy todavía no hay lanzamientos.",
  viewed: "Aún no has visto productos: los que abras aparecerán aquí.",
};

/** Insignias translúcidas con borde: mismos colores que el código de referencia. */
const BADGE: Record<Exclude<BoardFilter, "all">, string> = {
  news: "border-indigo-200 bg-indigo-50 text-indigo-600",
  today: "border-orange-200 bg-orange-50 text-orange-600",
  viewed: "border-slate-200 bg-slate-50 text-slate-600",
  deals: "border-red-200 bg-red-50 text-red-600",
  earn: "border-emerald-200 bg-emerald-50 text-emerald-600",
  new: "border-indigo-200 bg-indigo-50 text-indigo-600",
  top: "border-amber-200 bg-amber-50 text-amber-700",
  rated: "border-purple-200 bg-purple-50 text-purple-600",
  stores: "border-sky-200 bg-sky-50 text-sky-600",
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
    case "today":
      return "NUEVO HOY";
    case "viewed":
      return "LO VISTE";
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
export function Leaderboard({
  products,
  controls,
  filter: controlled,
  onFilter,
  viewed = [],
}: {
  products: Product[];
  /** Selectores extra (ubicación, categoría, precio) junto a los filtros. */
  controls?: ReactNode;
  filter?: BoardFilter;
  onFilter?: (f: BoardFilter) => void;
  viewed?: string[];
}) {
  const [own, setOwn] = useState<BoardFilter>("all");
  const filter = controlled ?? own;
  const setFilter = onFilter ?? setOwn;
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
  // Sin anuncios publicados (o si la tabla aún no existe), van los de Plaza X:
  // así la cinta nunca queda vacía.
  const news = useMemo(
    () => (announcements.data?.length ? announcements.data : platformAnnouncements()),
    [announcements.data],
  );
  const hasNews = news.length > 0;
  const activity = useQuery({
    queryKey: ["catalog", "activity"],
    queryFn: () => backend.recentActivity(),
    refetchInterval: 60_000,
  });
  const items = useMemo(
    () => buildLeaderboard(products, activity.data ?? [], filter, Date.now(), 8, news, viewed),
    [products, activity.data, filter, news, viewed],
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
      className="w-full border-b border-slate-200 bg-white py-4 font-sans text-slate-800 shadow-sm"
    >
      {/* Encabezado con filtros, ubicación, categoría y precio */}
      <div className="mx-auto mb-3 flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75 motion-reduce:hidden" />
            <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
          </span>
          <h2
            id="board-title"
            className="text-xs font-bold tracking-widest text-slate-600 uppercase"
          >
            En Vivo
          </h2>
          <button
            onClick={() => setPaused(!paused)}
            aria-pressed={paused}
            aria-label={paused ? "Reanudar" : "Pausar"}
            className="grid size-6 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
          >
            {paused ? <Play className="size-3" /> : <Pause className="size-3" />}
          </button>
        </div>

        {controls && <div className="flex flex-wrap items-center gap-1.5 text-xs">{controls}</div>}
      </div>
      <div className="mx-auto mb-3 flex max-w-7xl items-center gap-1.5 px-4 text-xs sm:px-6 lg:px-8">
        <span className="mr-1 hidden shrink-0 font-medium text-slate-500 sm:inline">Filtrar:</span>
        <div
          role="tablist"
          aria-label="Filtrar leaderboard"
          className="rail -mr-4 flex min-w-0 gap-1.5 overflow-x-auto py-1 pr-4 sm:mr-0 sm:pr-0"
        >
          {FILTERS.filter((f) => f.id !== "news" || hasNews).map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 font-medium transition",
                filter === f.id
                  ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                  : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200",
              )}
            >
              <f.icon className={cn("size-3.5", filter !== f.id && f.tint)} /> {f.label}
            </button>
          ))}
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
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex w-80 max-w-full items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-slate-50 text-2xl">
              🛍️
            </span>
            <span className="text-xs text-slate-500">
              {EMPTY[filter] ?? "Aún no hay productos con estos filtros."}{" "}
              {filter === "today" || filter === "viewed" ? (
                <button
                  onClick={() => setFilter("all")}
                  className="font-semibold text-indigo-600 hover:underline"
                >
                  Ver todo
                </button>
              ) : (
                <Link to="/vendedores" className="font-semibold text-indigo-600 hover:underline">
                  Publica el primero
                </Link>
              )}
            </span>
          </div>
        </div>
      )}

      {filter === "earn" && (
        <p className="mt-3 px-4 text-right text-xs text-slate-500">
          Comparte un producto y cobra cuando alguien compre.{" "}
          <Link
            to="/afiliados"
            className="inline-flex items-center gap-0.5 font-semibold text-indigo-600 hover:underline"
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
      className="group w-80 shrink-0 cursor-pointer rounded-xl border border-slate-200 bg-white p-3 shadow-sm text-left transition-all duration-300 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/10 focus-visible:border-indigo-500 focus-visible:outline-none"
    >
      <span className="flex items-center gap-3">
        {/* Imagen con temperatura y descuento */}
        <span className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-slate-50">
          {p ? (
            <ProductImage
              p={p}
              className="size-full rounded-none bg-slate-50 text-4xl transition-transform duration-300 group-hover:scale-105"
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
              <span className="flex shrink-0 items-center gap-1 text-[10px] text-slate-500">
                <Star className="size-3 fill-amber-400 text-amber-700" /> {p.rating.toFixed(1)}
              </span>
            )}
          </span>

          <span className="block truncate text-xs font-bold text-slate-900 transition-colors group-hover:text-indigo-600">
            {p ? p.name : it.kind === "store" && it.store.name}
          </span>
          <span className="mb-1 flex items-center gap-1 truncate text-[10px] text-slate-500">
            <Store className="size-3 shrink-0 text-slate-500" />
            {p
              ? p.store.name
              : it.kind === "store" && `${it.store.city} · ${it.products} productos`}
            {(p ? p.store.verified : it.kind === "store" && it.store.verified) && (
              <BadgeCheck className="size-3 shrink-0 text-sky-500" aria-label="Tienda verificada" />
            )}
          </span>

          {p ? (
            /* Datos financieros: precio y lo que gana quien recomienda */
            <span className="mt-1 flex items-center justify-between rounded-lg border border-slate-200 bg-white p-1.5">
              <span className="flex flex-col">
                <span className="text-[9px] font-medium uppercase text-slate-500">Precio</span>
                <span className="text-xs font-bold text-slate-600">{cop(p.price)}</span>
              </span>
              <span className="h-6 w-px bg-slate-100" aria-hidden />
              <span className="flex flex-col text-right">
                <span className="flex items-center justify-end gap-0.5 text-[9px] font-bold uppercase text-emerald-600">
                  <HandCoins className="size-3" /> Ganas ({rate}%)
                </span>
                <span className="text-xs font-extrabold text-emerald-600">
                  {cop(splitSale(p.price, p.commission).affiliate)}
                </span>
              </span>
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-indigo-600">{it.metric}</span>
          )}
        </span>
      </span>
    </button>
  );
}
