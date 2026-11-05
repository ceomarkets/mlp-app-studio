import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useDeferredValue, useMemo, useState } from "react";
import { addToCart } from "@/components/CartSheet";
import { Leaderboard } from "@/components/Leaderboard";
import { QuickView } from "@/components/QuickView";
import { ShareButton } from "@/components/ShareSheet";
import { Shell } from "@/components/Shell";
import { backend, type Product } from "@/lib/backend";
import {
  applyBrowse,
  citiesOf,
  companiesOf,
  isBrowsing,
  NO_BROWSE,
  OFFER_TYPES,
  PRICE_BANDS,
  type Browse,
  type OfferType,
  type PriceBand,
} from "@/lib/browse";
import { useViewed, viewed as viewedStore } from "@/lib/client-state";
import { useSpaces } from "@/lib/use-spaces";
import { copShort, EXAMPLE_FEED, EXAMPLE_META, EXAMPLE_PRODUCTS, isExample } from "@/lib/examples";
import { discountPct, isNew, temperatures } from "@/lib/feed";
import { clampCommission, cop } from "@/lib/plaza";
import { keys } from "@/lib/session";
import { plazaShare } from "@/lib/share";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Plaza X — Lo bonito de Nariño, a un toque" },
      {
        name: "description",
        content: "Ofertas, novedades y tiendas locales de Nariño. Compra fácil, paga seguro.",
      },
      { property: "og:title", content: "Plaza X — Lo bonito de Nariño, a un toque" },
      { property: "og:description", content: "Compra fácil. Paga seguro. Apoya lo local." },
    ],
  }),
  component: Plaza,
});

/** Chips de categoría del diseño (se suman las categorías reales que no estén aquí). */
const CATEGORY_CHIPS: [string, string][] = [
  ["Calzado", "fa-shoe-prints"],
  ["Tecnología", "fa-laptop"],
  ["Ropa", "fa-shirt"],
  ["Accesorios", "fa-couch"],
  ["Hogar", "fa-house"],
];
const CATEGORY_ICON: Record<string, string> = {
  Alimentos: "fa-mug-hot",
  Artesanías: "fa-palette",
  Belleza: "fa-spa",
  Campo: "fa-wheat-awn",
  Cursos: "fa-graduation-cap",
  Mascotas: "fa-paw",
  Deportes: "fa-futbol",
};

function Plaza() {
  const [q, setQ] = useState("");
  const [browse, setBrowse] = useState<Browse>(NO_BROWSE);
  const [quick, setQuick] = useState<Product | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const dq = useDeferredValue(q.trim());

  const all = useQuery({ queryKey: keys.products({}), queryFn: () => backend.listProducts() });
  const filter = { q: dq };
  const results = useQuery({
    queryKey: keys.products(filter),
    queryFn: () => backend.listProducts(filter),
    placeholderData: keepPreviousData,
  });
  const activity = useQuery({
    queryKey: ["catalog", "activity"],
    queryFn: () => backend.recentActivity(),
  });
  const viewed = useViewed();

  // Sin productos publicados se muestra el catálogo de ejemplo del diseño.
  const examples = all.isSuccess && all.data.length === 0;
  const source = examples ? EXAMPLE_PRODUCTS : (all.data ?? []);
  const searched = examples
    ? EXAMPLE_PRODUCTS.filter((p) =>
        `${p.name} ${p.store.name}`.toLowerCase().includes(dq.toLowerCase()),
      )
    : results.data;

  const boardProducts = useMemo(() => applyBrowse(source, browse), [source, browse]);
  const catalog = useMemo(
    () => (searched ? applyBrowse(searched, browse) : undefined),
    [searched, browse],
  );
  const companies = useMemo(() => companiesOf(source), [source]);
  const cities = useMemo(() => citiesOf(source), [source]);
  const chips = useMemo(() => {
    const extra = [...new Set(source.map((p) => p.category))].filter(
      (c) => !CATEGORY_CHIPS.some(([k]) => k === c),
    );
    return [
      ...CATEGORY_CHIPS,
      ...extra.map((c): [string, string] => [c, CATEGORY_ICON[c] ?? "fa-tag"]),
    ];
  }, [source]);
  const temps = useMemo(
    () => temperatures(all.data ?? [], activity.data ?? []),
    [all.data, activity.data],
  );
  const set = (patch: Partial<Browse>) => setBrowse((b) => ({ ...b, ...patch }));
  const reset = () => {
    setBrowse(NO_BROWSE);
    setQ("");
    setFiltersOpen(false);
  };
  const open = (p: Product) => {
    if (!isExample(p.id)) viewedStore.add(p.id);
    setQuick(p);
  };

  return (
    <Shell bare>
      {/* Hero: compra primero, sin botones de cuenta */}
      <section className="relative overflow-hidden border-b border-slate-800 bg-slate-900 px-4 pt-6 pb-5 md:pt-10 md:pb-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgba(245,158,11,0.12),transparent)]" />
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <h1 className="text-2xl leading-tight font-black tracking-tight text-white sm:text-4xl md:text-5xl">
            Todo lo que buscas, <span className="text-amber-400">de tiendas verificadas</span>
          </h1>
          <p className="mx-auto mt-2 mb-5 max-w-xl text-xs leading-relaxed text-slate-400 sm:text-sm">
            Compra directo a empresas y emprendimientos. Sin crear cuenta para mirar: solo te la
            pedimos al pagar.
          </p>
          <SearchBar value={q} onChange={setQ} />
          <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] font-medium text-slate-400">
            <li className="flex items-center gap-1.5">
              <i className="fa-solid fa-lock text-[10px]" aria-hidden /> Pago seguro
            </li>
            <li className="flex items-center gap-1.5">
              <i className="fa-solid fa-circle-check text-[10px]" aria-hidden /> Tiendas verificadas
            </li>
            <li className="flex items-center gap-1.5">
              <i className="fa-solid fa-rotate-left text-[10px]" aria-hidden /> Te devolvemos si
              algo sale mal
            </li>
          </ul>
        </div>
      </section>

      <div className="flex flex-grow flex-col bg-slate-950">
        {/* Barra de filtros */}
        <div className="relative w-full border-b border-amber-500/20 bg-slate-900 py-3 font-sans text-slate-200 shadow-sm">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4">
            <div className="relative flex flex-col items-stretch justify-between gap-3 text-xs md:flex-row md:items-center">
              <div className="scrollbar-none rail flex w-full items-center gap-2 overflow-x-auto pb-1 md:w-auto md:pb-0">
                <button
                  onClick={reset}
                  className={cn(
                    chip,
                    !isBrowsing(browse)
                      ? "border-amber-400 bg-gradient-to-r from-amber-500 to-amber-600 font-black text-slate-950 shadow-sm"
                      : chipIdle,
                  )}
                >
                  <i className="fa-solid fa-border-all" /> Ver Todo
                </button>
                {chips.map(([c, icon]) => (
                  <button
                    key={c}
                    onClick={() => set({ category: browse.category === c ? "all" : c })}
                    aria-pressed={browse.category === c}
                    className={cn(
                      chip,
                      browse.category === c
                        ? "border-amber-400 bg-gradient-to-r from-amber-500 to-amber-600 font-black text-slate-950 shadow-sm"
                        : chipIdle,
                    )}
                  >
                    <i className={cn("fa-solid", icon)} /> {c}
                  </button>
                ))}
              </div>

              <div className="relative flex w-full gap-2 md:w-auto">
                <button
                  onClick={() => setFiltersOpen(!filtersOpen)}
                  aria-expanded={filtersOpen}
                  className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 font-bold text-amber-400 shadow-sm transition hover:border-amber-400 md:flex-none"
                >
                  Filtros{" "}
                  <i
                    className={cn(
                      "fa-solid fa-chevron-down text-[10px] transition",
                      filtersOpen && "rotate-180",
                    )}
                  />
                </button>
                {filtersOpen && (
                  <div className="absolute top-full right-0 z-50 mt-2 flex w-full flex-col gap-3 rounded-2xl border border-amber-500/30 bg-slate-900 p-4 text-xs shadow-2xl md:w-80">
                    <div className="border-b border-slate-800 pb-2">
                      <button
                        onClick={reset}
                        className="flex w-full items-center justify-between text-left font-bold text-amber-400 transition hover:text-amber-300"
                      >
                        <span>
                          <i className="fa-solid fa-rotate-left me-1" /> Mostrar Todo el Catálogo
                        </span>
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px]">
                          Por Defecto
                        </span>
                      </button>
                    </div>
                    <Select
                      label="Ubicación"
                      value={browse.location}
                      onChange={(location) => set({ location })}
                      options={[
                        ["all", "Todas las Ubicaciones (Catálogo Completo)"],
                        ...cities.map((c): [string, string] => [`city:${c}`, c]),
                        ["local", "📍 Cobertura Local"],
                        ["national", "🚚 Envíos Nacionales"],
                      ]}
                    />
                    <Select
                      label="Tienda"
                      value={browse.company}
                      onChange={(company) => set({ company })}
                      options={[
                        ["all", "Todas las Tiendas"],
                        ...companies.map((c): [string, string] => [c.slug, c.name]),
                      ]}
                    />
                    <Select
                      label="Rango de Precio"
                      value={browse.price}
                      onChange={(price) => set({ price: price as PriceBand })}
                      options={PRICE_BANDS.map((b): [string, string] => [b.id, b.label])}
                    />
                    <Select
                      label="Tipo de Oferta"
                      value={browse.offer}
                      onChange={(offer) => set({ offer: offer as OfferType })}
                      options={OFFER_TYPES.map((o): [string, string] => [o.id, o.label])}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Leaderboard más grande */}
        <Leaderboard products={examples ? EXAMPLE_FEED : boardProducts} viewed={viewed} />

        {/* Catálogo */}
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-5 flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
            <h3
              id="catalogo"
              className="flex items-center gap-2 text-base font-extrabold text-white"
            >
              Para ti
            </h3>
            <span className="text-xs font-medium text-slate-400">
              {!catalog
                ? "Cargando…"
                : isBrowsing(browse) || dq
                  ? `Mostrando ${catalog.length} de ${source.length} productos`
                  : "Mostrando productos verificados"}
              {(isBrowsing(browse) || dq) && (
                <button onClick={reset} className="ms-2 font-bold text-amber-400 hover:underline">
                  Ver todo
                </button>
              )}
            </span>
          </div>

          {examples && (
            <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              Productos de ejemplo: así se verá el catálogo cuando los vendedores (personas o
              empresas) publiquen sus artículos.
            </p>
          )}
          {browse.offer === "direct" && (
            <p className="mb-4 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-400">
              Venta directa: productos que el vendedor ofrece sin programa de afiliados (no pagan
              comisión a quien los recomienda).
            </p>
          )}

          {!catalog ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
              {Array.from({ length: 10 }, (_, i) => (
                <div key={i} className="aspect-[3/4.4] animate-pulse rounded-2xl bg-slate-900" />
              ))}
            </div>
          ) : catalog.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
              {catalog.map((p) => (
                <GridCard
                  key={p.id}
                  p={p}
                  temp={EXAMPLE_META.get(p.id)?.temperature ?? temps.get(p.id) ?? 0}
                  onOpen={() => open(p)}
                />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-slate-400">
              <i className="fa-solid fa-box-open mb-2 text-3xl text-slate-600" />
              <p>No se encontraron productos que coincidan con los filtros.</p>
            </div>
          )}

          {/* Compartir */}
          <div className="gold-border-glow mt-10 flex flex-col items-center justify-between gap-4 rounded-2xl border border-amber-500/30 bg-slate-900 p-6 shadow-xl sm:flex-row">
            <div className="text-center sm:text-left">
              <h4 className="flex items-center justify-center gap-2 text-base font-bold text-white sm:justify-start">
                ¿Te gustó? Cuéntale a alguien 💛
              </h4>
              <p className="mt-0.5 text-xs font-medium text-slate-400">
                Un mensaje ayuda a una tienda local.
              </p>
            </div>
            <ShareButton
              data={plazaShare}
              className="flex min-h-[44px] w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-3 text-xs font-black text-slate-950 shadow-lg transition hover:from-amber-400 hover:to-amber-500 sm:w-auto"
            >
              <i className="fa-solid fa-share-nodes text-xs" /> Compartir Plaza X
            </ShareButton>
          </div>
        </div>
      </div>

      <QuickView product={quick} onClose={() => setQuick(null)} />
    </Shell>
  );
}

const chip =
  "flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-2 transition";
const chipIdle =
  "border-slate-700/80 bg-slate-800/80 font-medium text-slate-300 hover:bg-slate-800 hover:text-white";

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-bold text-slate-300">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200 focus:outline-none"
      >
        {options.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
      }}
      className="relative mx-auto max-w-xl"
    >
      <div className="flex flex-col items-stretch gap-2 rounded-2xl border border-amber-500/30 bg-slate-950 p-1.5 shadow-lg transition focus-within:border-amber-400 focus-within:ring-1 focus-within:ring-amber-400/50 sm:flex-row sm:items-center sm:gap-0 sm:p-1">
        <div className="flex w-full items-center px-2">
          <i className="fa-solid fa-magnifying-glass text-xs" />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Buscar productos, marcas o empresas..."
            aria-label="Buscar productos"
            className="min-h-[44px] w-full bg-transparent py-2.5 pr-3 pl-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="min-h-[44px] shrink-0 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2.5 text-xs font-black text-slate-950 shadow-md transition hover:from-amber-400 hover:to-amber-500"
        >
          Buscar
        </button>
      </div>
    </form>
  );
}

/** Tarjeta compacta: foto cuadrada, precio grande, descuento visible y "+" para sumar sin salir. */
function GridCard({ p, onOpen }: { p: Product; temp?: number; onOpen: () => void }) {
  const meta = EXAMPLE_META.get(p.id);
  const { promotes } = useSpaces();
  const rate = meta?.commissionRate ?? Math.round(clampCommission(p.commission) * 100);
  const sold = p.stock <= 0;
  const before = p.compareAtPrice && p.compareAtPrice > p.price ? p.compareAtPrice : null;
  const off = discountPct(p);
  const img = p.images[0];
  const [added, setAdded] = useState(0);
  return (
    <article
      onClick={onOpen}
      className={cn(
        "group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 transition duration-200 hover:-translate-y-0.5 hover:border-slate-700 hover:shadow-xl hover:shadow-black/30",
        sold && "opacity-60",
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-slate-950">
        {img ? (
          <img
            src={img}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <span aria-hidden className="grid h-full place-items-center text-6xl">
            {p.emoji}
          </span>
        )}
        {off > 0 && (
          <span className="absolute top-2 left-2 rounded-md bg-amber-500 px-1.5 py-0.5 text-[11px] font-black text-slate-950">
            -{off}%
          </span>
        )}
        {meta && (
          <span className="absolute top-2 right-2 rounded-md bg-slate-950/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
            Ejemplo
          </span>
        )}
        {!sold && (
          <button
            type="button"
            aria-label={`Añadir ${p.name} al carrito`}
            onClick={(e) => {
              e.stopPropagation();
              addToCart(p);
              setAdded((n) => n + 1);
            }}
            className="absolute right-2 bottom-2 grid size-9 min-h-0 place-items-center rounded-full bg-white text-slate-950 shadow-lg transition hover:scale-105 active:scale-90"
          >
            <i
              key={added}
              className={cn("fa-solid", added ? "fa-check animate-pop" : "fa-plus")}
              aria-hidden
            />
          </button>
        )}
        {sold && (
          <span className="absolute inset-x-0 bottom-0 bg-slate-950/80 py-1 text-center text-[11px] font-bold text-slate-300">
            Agotado
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2.5 sm:p-3">
        <h4 className="line-clamp-2 text-[13px] leading-snug font-medium text-slate-100">
          {p.name}
        </h4>
        <div className="mt-auto flex items-baseline gap-1.5 pt-1">
          <span className="text-base font-black text-amber-400 sm:text-lg">
            {copShort(p.price)}
          </span>
          {before && (
            <span className="truncate text-[11px] text-slate-500 line-through">
              {copShort(before)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
          <span className="flex min-w-0 items-center gap-1 truncate">
            {p.store.verified && (
              <i
                className="fa-solid fa-circle-check text-[10px] text-sky-400"
                aria-label="Verificada"
              />
            )}
            <span className="truncate">{p.store.name}</span>
          </span>
          {promotes && rate > 0 ? (
            <span className="shrink-0 font-bold text-emerald-400">Gana {rate}%</span>
          ) : (
            p.soldCount > 0 && <span className="shrink-0">{p.soldCount} vendidos</span>
          )}
        </div>
        {p.stock > 0 && p.stock <= 5 && (
          <span className="text-[11px] font-semibold text-amber-300">¡Quedan {p.stock}!</span>
        )}
      </div>
    </article>
  );
}
