import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  BadgePercent,
  Flame,
  LayoutGrid,
  Pause,
  Play,
  Sparkles,
  Star,
  Store,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { QuickView } from "@/components/QuickView";
import { Price, ProductImage } from "@/components/Shell";
import { backend, type Product } from "@/lib/backend";
import { buildLeaderboard, type BoardFilter, type BoardItem } from "@/lib/feed";
import { keys } from "@/lib/session";
import { cn } from "@/lib/utils";

const FILTERS: { id: BoardFilter; label: string; icon: LucideIcon }[] = [
  { id: "all", label: "Todo", icon: LayoutGrid },
  { id: "new", label: "Nuevos", icon: Sparkles },
  { id: "deals", label: "Ofertas", icon: BadgePercent },
  { id: "top", label: "Top ventas", icon: Flame },
  { id: "rated", label: "Mejor valorados", icon: Star },
  { id: "stores", label: "Tiendas top", icon: Store },
];

const TONE: Record<Exclude<BoardFilter, "all">, string> = {
  new: "bg-sun text-accent-foreground",
  deals: "bg-primary text-primary-foreground",
  top: "bg-ink text-ink-foreground",
  rated: "bg-secondary text-secondary-foreground",
  stores: "bg-accent text-accent-foreground",
};

const MEDAL = [
  "text-[oklch(0.78_0.15_85)]",
  "text-[oklch(0.75_0.02_250)]",
  "text-[oklch(0.62_0.11_55)]",
];

/**
 * Leaderboard en vivo de la portada: un carrusel continuo de derecha a izquierda
 * con novedades, ofertas, top ventas, mejor valorados y tiendas de la semana.
 * Se pausa al pasar el cursor, con el botón de pausa o con el teclado; al hacer
 * clic abre la vista rápida del producto (o la tienda).
 */
export function Leaderboard({ products }: { products: Product[] }) {
  const [filter, setFilter] = useState<BoardFilter>("all");
  const [paused, setPaused] = useState(false);
  const [open, setOpen] = useState<Product | null>(null);
  const navigate = useNavigate();
  const activity = useQuery({
    queryKey: ["catalog", "activity"],
    queryFn: () => backend.recentActivity(),
    refetchInterval: 60_000,
  });
  const items = useMemo(
    () => buildLeaderboard(products, activity.data ?? [], filter),
    [products, activity.data, filter],
  );

  // Se repite la lista hasta llenar la pista; luego se duplica para el bucle sin cortes.
  const loop = useMemo(() => {
    if (!items.length) return [];
    const out: BoardItem[] = [];
    while (out.length < 10) out.push(...items);
    return out;
  }, [items]);
  const duration = `${Math.max(28, loop.length * 4.5)}s`;

  const select = (it: BoardItem) =>
    it.kind === "product"
      ? setOpen(it.product)
      : navigate({ to: "/tienda/$slug", params: { slug: it.store.slug } });

  return (
    <section className="mt-8" aria-labelledby="board-title">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-ink text-sun shadow-card">
            <Trophy className="size-5" />
          </span>
          <div>
            <h2
              id="board-title"
              className="flex items-center gap-2 text-xl font-extrabold md:text-2xl"
            >
              Lo que está pasando
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary">
                <span className="size-1.5 animate-pulse rounded-full bg-primary" /> En vivo
              </span>
            </h2>
            <p className="text-sm text-muted-foreground">Toca para ver y comprar al instante.</p>
          </div>
        </div>
        <button
          onClick={() => setPaused(!paused)}
          className="hidden items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-semibold hover:border-primary md:inline-flex"
          aria-pressed={paused}
        >
          {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
          {paused ? "Reanudar" : "Pausar"}
        </button>
      </div>

      <div
        role="tablist"
        aria-label="Filtrar leaderboard"
        className="rail -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0"
      >
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              filter === f.id
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card hover:border-primary",
            )}
          >
            <f.icon className="size-3.5" /> {f.label}
          </button>
        ))}
      </div>

      {loop.length ? (
        <div
          className="board ticker-mask -mx-4 overflow-hidden py-2 md:mx-0"
          data-paused={paused || undefined}
        >
          <div className="board-track flex w-max" style={{ animationDuration: duration }}>
            {[0, 1].map((copy) => (
              <ul
                key={`${filter}-${copy}`}
                className="flex shrink-0 gap-3 pr-3"
                aria-hidden={copy === 1 || undefined}
              >
                {loop.map((it, i) => (
                  <li key={`${it.key}-${i}`}>
                    <BoardCard it={it} tabbable={copy === 0} onSelect={() => select(it)} />
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Aún no hay datos para este filtro.
        </p>
      )}

      <QuickView product={open} onClose={() => setOpen(null)} />
    </section>
  );
}

function BoardCard({
  it,
  tabbable,
  onSelect,
}: {
  it: BoardItem;
  tabbable: boolean;
  onSelect: () => void;
}) {
  const medal =
    it.rank <= 3 && (it.filter === "top" || it.filter === "stores" || it.filter === "rated");
  return (
    <button
      type="button"
      onClick={onSelect}
      tabIndex={tabbable ? 0 : -1}
      className="group relative flex w-64 items-center gap-3 rounded-2xl border bg-card p-2.5 text-left shadow-card transition hover:-translate-y-0.5 hover:border-primary focus-visible:border-primary focus-visible:outline-none"
    >
      {it.kind === "product" ? (
        <ProductImage p={it.product} className="size-16 shrink-0 rounded-xl text-3xl" />
      ) : (
        <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-secondary text-3xl">
          {it.store.emoji}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="mb-1 flex items-center gap-1.5">
          <span
            className={cn("rounded-full px-2 py-0.5 text-[10px] font-extrabold", TONE[it.filter])}
          >
            {it.badge}
          </span>
          {medal && (
            <Trophy
              className={cn("size-3.5", MEDAL[it.rank - 1])}
              aria-label={`Puesto ${it.rank}`}
            />
          )}
        </span>
        <span className="block truncate text-sm font-bold group-hover:text-primary">
          {it.kind === "product" ? it.product.name : it.store.name}
        </span>
        {it.kind === "product" ? (
          <span className="flex items-baseline justify-between gap-2 text-xs">
            <Price p={it.product} />
          </span>
        ) : (
          <span className="block truncate text-xs text-muted-foreground">
            {it.store.city} · {it.products} productos
          </span>
        )}
        <span className="block truncate text-[11px] font-semibold text-muted-foreground">
          {it.metric}
        </span>
      </span>
    </button>
  );
}
