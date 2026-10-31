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
import { EXAMPLE_META, isExample } from "@/lib/examples";
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
  { id: "viewed", label: "Recientes", icon: "fa-clock-rotate-left text-indigo-600" },
  { id: "earn", label: "Altas Comisiones", icon: "fa-hand-holding-dollar text-emerald-600" },
];

const BADGE: Record<string, string> = {
  earn: "bg-emerald-100 text-emerald-700 border-emerald-200",
  deals: "bg-rose-100 text-rose-700 border-rose-200",
  top: "bg-amber-100 text-amber-800 border-amber-200",
  today: "bg-orange-100 text-orange-700 border-orange-200",
  new: "bg-indigo-100 text-indigo-700 border-indigo-200",
  viewed: "bg-slate-100 text-slate-700 border-slate-200",
  rated: "bg-amber-100 text-amber-800 border-amber-200",
  stores: "bg-sky-100 text-sky-700 border-sky-200",
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
      className="w-full border-b border-slate-200 bg-white py-4 font-sans text-slate-800 shadow-sm"
    >
      <div className="mx-auto mb-3 flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4">
        <div />
        <div className="scrollbar-none flex flex-wrap items-center gap-1.5 overflow-x-auto py-1 text-xs">
          <span className="mr-1 text-xs font-medium text-slate-500">Filtrar:</span>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 font-medium transition",
                filter === f.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200",
              )}
            >
              <i className={cn("fa-solid", filter === f.id ? f.icon.split(" ")[0] : f.icon)} />{" "}
              {f.label}
            </button>
          ))}
          {controls}
        </div>
      </div>

      {loop.length ? (
        <div className="marquee-container marquee-mask relative w-full overflow-hidden">
          <div className="marquee-content flex w-max gap-4">
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

/** Tarjeta de la cinta, igual al diseño (createCardHTML). */
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
  const badge = badgeOf(it);
  const img = p?.images[0];
  const rating = p ? (EXAMPLE_META.get(p.id)?.rating ?? (p.ratingCount ? p.rating : 0)) : 0;
  return (
    <button
      type="button"
      onClick={onSelect}
      tabIndex={tabbable ? 0 : -1}
      className="group w-80 flex-shrink-0 cursor-pointer rounded-xl border border-slate-200 bg-white p-3 text-left transition-all duration-300 hover:border-indigo-400 hover:shadow-lg"
    >
      <div className="flex items-center gap-3">
        <div className="relative grid size-20 flex-shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
          {img ? (
            <img
              src={img}
              alt={p!.name}
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <span aria-hidden className="text-4xl">
              {p ? p.emoji : it.kind === "store" ? it.store.emoji : ""}
            </span>
          )}
          {temp > 0 && (
            <span className="absolute top-1 left-1 flex items-center gap-0.5 rounded bg-amber-500 px-1 text-[9px] font-black text-white shadow-sm">
              <i className="fa-solid fa-fire text-[8px]" /> {temp}°
            </span>
          )}
        </div>
        <div className="min-w-0 flex-grow">
          <div className="mb-1 flex items-center justify-between gap-1">
            <span
              className={cn(
                "truncate rounded-full border px-1.5 py-0.5 text-[9px] font-semibold",
                badge.cls,
              )}
            >
              {badge.text}
            </span>
            {rating > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-slate-500">
                <i className="fa-solid fa-star text-amber-500" /> {rating}
              </span>
            )}
          </div>
          <h4 className="truncate text-xs font-bold text-slate-900 transition-colors group-hover:text-indigo-600">
            {p ? p.name : it.kind === "store" ? it.store.name : ""}
          </h4>
          <p className="mb-1 truncate text-[10px] text-slate-500">
            <i className="fa-solid fa-store me-1 text-slate-400" />
            {p ? p.store.name : it.kind === "store" ? `${it.store.city} · ${it.metric}` : ""}
          </p>
          {p && (
            <div className="mt-1 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-1.5">
              <div className="flex flex-col">
                <span className="text-[9px] font-medium text-slate-500 uppercase">Precio</span>
                <span className="text-xs font-bold text-slate-800">{cop(p.price)}</span>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div className="flex flex-col text-right">
                <span className="flex items-center justify-end gap-0.5 text-[9px] font-bold text-emerald-600 uppercase">
                  <i className="fa-solid fa-sack-dollar" /> Ganas
                </span>
                <span className="text-xs font-extrabold text-emerald-600">{cop(earnings(p))}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
