import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import {
  AnnouncementCard,
  AnnouncementDialog,
  useOpenAnnouncement,
} from "@/components/AnnouncementCard";
import { QuickView } from "@/components/QuickView";
import { platformAnnouncements } from "@/lib/announcements";
import { backend, type Announcement, type Product } from "@/lib/backend";
import { StockBadge } from "@/components/StockBadge";
import { copShort, EXAMPLE_META, isExample } from "@/lib/examples";
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

/** Filtros del diseño Plaza X. */
const FILTERS: { id: BoardFilter; label: string; icon: string }[] = [
  { id: "all", label: "Todos", icon: "fa-border-all" },
  { id: "today", label: "Lo Nuevo de Hoy", icon: "fa-fire text-orange-500" },
  { id: "viewed", label: "Recientes", icon: "fa-clock-rotate-left text-amber-400" },
  { id: "earn", label: "Altas Comisiones", icon: "fa-hand-holding-dollar text-emerald-400" },
];

const BADGE: Record<string, string> = {
  earn: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  deals: "bg-rose-500/20 text-rose-400 border-rose-500/30",
  top: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  today: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  new: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  viewed: "bg-slate-800 text-slate-200 border-slate-800",
  rated: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  stores: "bg-sky-500/20 text-sky-400 border-sky-500/30",
};

function badgeOf(it: BoardItem): { text: string; cls: string } {
  if (it.kind === "product") {
    const meta = EXAMPLE_META.get(it.product.id);
    if (meta) return { text: meta.badge, cls: meta.badgeColor };
    const p = it.product;
    const text =
      it.filter === "deals"
        ? `OFERTA −${discountPct(p)}%`
        : it.filter === "earn"
          ? `${Math.round(clampCommission(p.commission) * 100)}% COMISIÓN`
          : it.filter === "top"
            ? `TOP #${it.rank} VENTAS`
            : it.filter === "today"
              ? "NUEVO HOY"
              : it.filter === "new"
                ? "RECIÉN LANZADO"
                : it.filter === "rated"
                  ? "MEJOR VALORADO"
                  : "VISTO";
    return { text, cls: BADGE[it.filter] ?? BADGE["new"]! };
  }
  return { text: `TIENDA TOP #${it.rank}`, cls: BADGE["stores"]! };
}

/** Lo que gana quien recomienda (en los ejemplos, el % del diseño). */
function earnings(p: Product) {
  const meta = EXAMPLE_META.get(p.id);
  return meta
    ? Math.round((p.price * meta.commissionRate) / 100)
    : splitSale(p.price, p.commission).affiliate;
}

/** Filtro de los productos de ejemplo, igual que el diseño. */
function exampleItems(products: Product[], filter: BoardFilter, viewed: string[]): BoardItem[] {
  let list = products;
  if (filter === "today") list = products.filter((p) => EXAMPLE_META.get(p.id)?.type === "hoy");
  if (filter === "earn") list = products.filter((p) => EXAMPLE_META.get(p.id)?.type === "comision");
  if (filter === "viewed") {
    const seen = viewed.map((id) => products.find((p) => p.id === id)).filter((p) => !!p);
    list = seen.length ? (seen as Product[]) : products.slice(0, 2);
  }
  return list.map((p, i) => ({
    kind: "product",
    key: `ex-${p.id}`,
    filter: "new",
    rank: i + 1,
    badge: "",
    metric: "",
    product: p,
  }));
}

/**
 * Cinta en vivo de la portada (diseño Plaza X): corre de derecha a izquierda, se pausa al
 * pasar el cursor y al hacer clic abre la vista rápida.
 */
export function Leaderboard({
  products,
  controls,
  filter: controlled,
  onFilter,
  viewed = [],
}: {
  products: Product[];
  /** Selectores de ubicación, categoría y precio, junto a los filtros. */
  controls?: ReactNode;
  filter?: BoardFilter;
  onFilter?: (f: BoardFilter) => void;
  viewed?: string[];
}) {
  const [own, setOwn] = useState<BoardFilter>("all");
  const filter = controlled ?? own;
  const setFilter = onFilter ?? setOwn;
  const [open, setOpen] = useState<Product | null>(null);
  const [notice, setNotice] = useState<Announcement | null>(null);
  const navigate = useNavigate();
  const openAnnouncement = useOpenAnnouncement();
  const announcements = useQuery({
    queryKey: keys.announcements,
    queryFn: () => backend.listAnnouncements(),
    refetchInterval: 60_000,
  });
  const news = useMemo(
    () => (announcements.data?.length ? announcements.data : platformAnnouncements()),
    [announcements.data],
  );
  const activity = useQuery({
    queryKey: ["catalog", "activity"],
    queryFn: () => backend.recentActivity(),
    refetchInterval: 60_000,
  });
  const examples = products.length > 0 && products.every((p) => isExample(p.id));

  const items = useMemo(() => {
    if (examples) return exampleItems(products, filter, viewed);
    const list = buildLeaderboard(
      products,
      activity.data ?? [],
      filter,
      Date.now(),
      8,
      filter === "all" ? news : [],
      viewed,
    );
    // "Recientes" sin historial: como en el diseño, se muestran los primeros productos.
    if (filter === "viewed" && !list.length)
      return buildLeaderboard(products, activity.data ?? [], "all", Date.now(), 1).slice(0, 2);
    return list;
  }, [examples, products, activity.data, filter, news, viewed]);

  const temps = useMemo(
    () => temperatures(products, activity.data ?? []),
    [products, activity.data],
  );

  // Cuatro copias, como el diseño, para un bucle continuo.
  const loop = useMemo(
    () => (items.length ? [...items, ...items, ...items, ...items] : []),
    [items],
  );

  const select = (it: BoardItem) => {
    if (it.kind === "product") return setOpen(it.product);
    if (it.kind === "store")
      return navigate({ to: "/tienda/$slug", params: { slug: it.store.slug } });
    if (!openAnnouncement(it.announcement)) setNotice(it.announcement);
  };

  return (
    <section
      aria-label="Leaderboard en vivo"
      className="relative z-20 w-full overflow-hidden border-b border-amber-500/20 bg-slate-900/60 py-4"
    >
      {(controls !== undefined || onFilter) && (
        <div className="mx-auto mb-3 flex max-w-7xl flex-wrap items-center justify-end gap-1.5 px-4 text-xs">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 font-medium transition",
                filter === f.id
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 font-black text-slate-950"
                  : "border border-slate-700/80 bg-slate-800/80 text-slate-300 hover:text-amber-400",
              )}
            >
              <i className={cn("fa-solid", f.icon.split(" ")[0])} /> {f.label}
            </button>
          ))}
          {controls}
        </div>
      )}

      {loop.length ? (
        <div className="marquee-container mx-auto w-full max-w-7xl overflow-hidden px-4">
          <div className="marquee-content flex w-max items-center gap-4 whitespace-nowrap">
            {loop.map((it, i) => (
              <div key={`${it.key}-${i}`} aria-hidden={i >= items.length || undefined}>
                {it.kind === "announcement" ? (
                  <AnnouncementCard
                    a={it.announcement}
                    tabbable={i < items.length}
                    onSelect={() => select(it)}
                  />
                ) : (
                  <BoardCard
                    it={it}
                    temp={
                      it.kind === "product"
                        ? (EXAMPLE_META.get(it.product.id)?.temperature ??
                          temps.get(it.product.id) ??
                          0)
                        : 0
                    }
                    tabbable={i < items.length}
                    onSelect={() => select(it)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="mx-auto max-w-7xl px-4 py-6 text-center text-xs text-slate-400">
          {filter === "today"
            ? "Hoy todavía no hay productos nuevos."
            : "No hay productos que coincidan con los filtros."}
        </p>
      )}

      <QuickView product={open} onClose={() => setOpen(null)} />
      <AnnouncementDialog a={notice} onClose={() => setNotice(null)} />
    </section>
  );
}

/** Tarjeta de la cinta, igual al diseño (renderLargeLeaderboard). */
function BoardCard({
  it,
  tabbable,
  onSelect,
}: {
  it: BoardItem;
  temp?: number;
  tabbable: boolean;
  onSelect: () => void;
}) {
  const p = it.kind === "product" ? it.product : null;
  const img = p?.images[0];
  const rate = p
    ? (EXAMPLE_META.get(p.id)?.commissionRate ?? Math.round(clampCommission(p.commission) * 100))
    : 0;
  const verified = p ? p.store.verified : it.kind === "store" && it.store.verified;
  const before = p?.compareAtPrice && p.compareAtPrice > p.price ? p.compareAtPrice : null;
  return (
    <button
      type="button"
      onClick={onSelect}
      tabIndex={tabbable ? 0 : -1}
      className="inline-flex shrink-0 items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-3.5 px-4 text-left whitespace-normal shadow-md transition-all hover:border-amber-500/40"
    >
      <div className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-800 bg-slate-950 sm:size-20">
        {img ? (
          <img src={img} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <span aria-hidden className="text-4xl">
            {p ? p.emoji : it.kind === "store" ? it.store.emoji : ""}
          </span>
        )}
      </div>
      <div className="flex min-w-[220px] flex-col justify-between gap-1.5 py-0.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-col">
            {verified && (
              <span className="flex items-center gap-1 text-[9px] font-bold tracking-wider text-emerald-400 uppercase">
                <i className="fa-solid fa-circle-check text-[9px]" /> Verificado
              </span>
            )}
            <span className="flex items-center gap-1 truncate text-[11px] font-semibold text-slate-300">
              <i className="fa-solid fa-store text-[9px] text-amber-400" />{" "}
              {p ? p.store.name : it.kind === "store" ? it.store.name : ""}
            </span>
          </div>
          {p && rate > 0 && (
            <span className="shrink-0 self-start rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
              {rate}% COMISIÓN
            </span>
          )}
        </div>
        <span className="my-0.5 block max-w-[220px] truncate text-sm font-bold tracking-tight text-white">
          {p ? p.name : it.kind === "store" ? `Tienda top #${it.rank}` : ""}
        </span>
        {p ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-slate-950 px-3 py-1.5 text-xs">
            <div className="text-center font-medium">
              <StockBadge stock={p.stock} />
            </div>
            <div className="flex shrink-0 flex-col items-end text-right">
              {before && (
                <span className="mb-0.5 text-[10px] leading-none font-medium text-slate-400 line-through">
                  Antes {copShort(before)}
                </span>
              )}
              <span className="text-xs leading-none font-black text-amber-400 sm:text-sm">
                {copShort(p.price)}
              </span>
            </div>
          </div>
        ) : (
          it.kind === "store" && (
            <span className="text-[11px] text-slate-400">
              {it.store.city} · {it.metric}
            </span>
          )
        )}
      </div>
    </button>
  );
}
