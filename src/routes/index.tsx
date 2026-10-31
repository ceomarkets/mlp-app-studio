import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgePercent,
  Flame,
  History,
  Plus,
  Share2,
  Sparkles,
  Store,
  Wand2,
} from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { addToCart } from "@/components/CartSheet";
import { Leaderboard } from "@/components/Leaderboard";
import { QuickView, useAffiliate } from "@/components/QuickView";
import { CATEGORY_ICON, Rail } from "@/components/Rail";
import { ShareButton } from "@/components/ShareSheet";
import { ProductCard, ProductGridSkeleton, ProductImage, Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { backend, type Product, type ProductFilter } from "@/lib/backend";
import { useCart, useFavorites, useViewed } from "@/lib/client-state";
import { buildSections, discountPct, isNew } from "@/lib/feed";
import { CATEGORIES, clampCommission, cop, splitSale } from "@/lib/plaza";
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

const SORTS: { id: NonNullable<ProductFilter["sort"]>; label: string }[] = [
  { id: "popular", label: "Más vendidos" },
  { id: "new", label: "Novedades" },
  { id: "price-asc", label: "Menor precio" },
  { id: "price-desc", label: "Mayor precio" },
];

function QuickAdd({ p }: { p: Product }) {
  return (
    <Button
      className="w-full"
      size="sm"
      variant={p.stock < 1 ? "outline" : "default"}
      disabled={p.stock < 1}
      onClick={() => addToCart(p)}
    >
      {p.stock < 1 ? (
        "Agotado"
      ) : (
        <>
          <Plus /> Lo quiero
        </>
      )}
    </Button>
  );
}

function Plaza() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("Todo");
  const [sort, setSort] = useState<NonNullable<ProductFilter["sort"]>>("popular");
  const [quick, setQuick] = useState<Product | null>(null);
  const dq = useDeferredValue(q.trim());
  const browsing = dq !== "" || category !== "Todo";

  const all = useQuery({ queryKey: keys.products({}), queryFn: () => backend.listProducts() });
  const filter = { q: dq, category, sort };
  const results = useQuery({
    queryKey: keys.products(filter),
    queryFn: () => backend.listProducts(filter),
    placeholderData: keepPreviousData,
  });
  const stores = useQuery({ queryKey: keys.stores, queryFn: () => backend.listStores() });

  const viewed = useViewed();
  const favs = useFavorites();
  const cartLines = useCart();
  const sections = useMemo(
    () =>
      buildSections(all.data ?? [], {
        viewed,
        favorites: favs,
        cart: cartLines.map((l) => l.productId),
      }),
    [all.data, viewed, favs, cartLines],
  );

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    all.data?.forEach((p) => m.set(p.category, (m.get(p.category) ?? 0) + 1));
    return m;
  }, [all.data]);
  const cats = ["Todo", ...CATEGORIES.filter((c) => counts.has(c))];

  return (
    <Shell bare>
      {/* Portada (diseño del prototipo) */}
      <section className="relative overflow-hidden py-8 lg:py-12">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/30 via-slate-950 to-slate-950" />

        <div className="mx-auto mb-6 max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-400">
            <span className="size-2 animate-ping rounded-full bg-emerald-400" />
            Ecosistema de Comercio & Afiliación
          </div>
          <h1 className="mx-auto max-w-3xl text-3xl leading-tight font-extrabold tracking-tight text-white sm:text-5xl">
            Mercado de Productos & Afiliación
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-slate-400 sm:text-lg">
            Compra a tiendas verificadas, promociona sus productos o sube tu propio catálogo y gana
            comisiones.
          </p>
        </div>

        {/* Leaderboard en vivo con el buscador dentro de la banda */}
        <Leaderboard products={all.data ?? []} search={<SearchBar value={q} onChange={setQ} />} />
      </section>

      <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        {/* Categorías */}
        <nav
          aria-label="Categorías"
          className="rail -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0"
        >
          {cats.map((c) => {
            const Icon = CATEGORY_ICON[c] ?? Store;
            const active = c === category;
            return (
              <button
                key={c}
                onClick={() => setCategory(c)}
                aria-pressed={active}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-2xl border px-3.5 py-2 text-sm font-semibold transition",
                  active
                    ? "border-ink bg-ink text-ink-foreground shadow-card"
                    : "bg-card hover:border-primary hover:text-primary",
                )}
              >
                <Icon className="size-4" />
                {c}
              </button>
            );
          })}
        </nav>

        {browsing ? (
          <section className="mt-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {results.data?.length ?? "…"} encontrados
                {dq && (
                  <>
                    {" "}
                    para <b className="text-foreground">“{dq}”</b>
                  </>
                )}
              </p>
              <SortSelect sort={sort} setSort={setSort} />
            </div>
            <Grid items={results.data} loading={results.isPending} onOpen={setQuick} />
          </section>
        ) : (
          <>
            {sections.deals.length > 0 && (
              <Rail
                tone="hot"
                icon={<BadgePercent />}
                title="Precios que enamoran"
                subtitle="Descuentos reales, hoy"
              >
                {sections.deals.map((p) => (
                  <ProductCard key={p.id} p={p} action={<QuickAdd p={p} />} />
                ))}
              </Rail>
            )}

            {sections.forYou.length > 0 && (
              <Rail icon={<Wand2 />} title="Elegido para ti" subtitle="Según lo que te gusta">
                {sections.forYou.map((p) => (
                  <ProductCard key={p.id} p={p} action={<QuickAdd p={p} />} />
                ))}
              </Rail>
            )}

            {sections.best.length > 0 && (
              <Rail icon={<Flame />} title="Los favoritos de todos" subtitle="Lo que más se vende">
                {sections.best.map((p) => (
                  <ProductCard key={p.id} p={p} action={<QuickAdd p={p} />} />
                ))}
              </Rail>
            )}

            {sections.fresh.length > 0 && (
              <Rail
                icon={<Sparkles />}
                title="Recién llegados"
                subtitle="Fresquitos de las tiendas"
              >
                {sections.fresh.map((p) => (
                  <ProductCard key={p.id} p={p} action={<QuickAdd p={p} />} />
                ))}
              </Rail>
            )}

            <section className="mt-10">
              <div className="mb-4 flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-2xl bg-card text-primary shadow-card">
                  <Store className="size-5" />
                </span>
                <h2 className="text-xl font-extrabold md:text-2xl">Tiendas que amamos</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {stores.data?.map((s) => (
                  <Link
                    key={s.id}
                    to="/tienda/$slug"
                    params={{ slug: s.slug }}
                    className="group flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-card transition hover:-translate-y-0.5 hover:border-primary"
                  >
                    <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-secondary text-2xl">
                      {s.emoji}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{s.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{s.city}</span>
                    </span>
                    <ArrowRight className="ml-auto size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                  </Link>
                ))}
              </div>
            </section>

            {/* Compartir la plaza: crecer por recomendación */}
            <section className="mt-10 flex flex-col items-center gap-3 rounded-3xl bg-secondary p-6 text-center md:flex-row md:justify-between md:text-left">
              <div>
                <h2 className="text-xl font-extrabold">¿Te gustó? Cuéntale a alguien 💛</h2>
                <p className="text-sm text-muted-foreground">
                  Un mensaje ayuda a una tienda local.
                </p>
              </div>
              <ShareButton
                data={plazaShare}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90"
              >
                <Share2 className="size-4" /> Compartir Plaza X
              </ShareButton>
            </section>

            {sections.viewed.length > 0 && (
              <Rail icon={<History />} title="Lo que viste">
                {sections.viewed.map((p) => (
                  <ProductCard key={p.id} p={p} action={<QuickAdd p={p} />} />
                ))}
              </Rail>
            )}

            <section className="mt-12">
              <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-extrabold text-white">
                    Todos los Productos para Afiliarse
                  </h2>
                  <p className="text-sm text-slate-400">
                    Elige un producto, activa tu enlace y empieza a ganar comisiones
                  </p>
                </div>
                <SortSelect sort={sort} setSort={setSort} />
              </div>
              <Grid items={results.data} loading={results.isPending} onOpen={setQuick} />
            </section>
          </>
        )}
      </div>

      <QuickView product={quick} onClose={() => setQuick(null)} />
    </Shell>
  );
}

function SortSelect({
  sort,
  setSort,
}: {
  sort: NonNullable<ProductFilter["sort"]>;
  setSort: (s: NonNullable<ProductFilter["sort"]>) => void;
}) {
  return (
    <select
      value={sort}
      onChange={(e) => setSort(e.target.value as typeof sort)}
      className="h-10 rounded-full border bg-card px-4 text-sm font-semibold"
      aria-label="Ordenar"
    >
      {SORTS.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label}
        </option>
      ))}
    </select>
  );
}

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        document.getElementById("resultados")?.scrollIntoView({ behavior: "smooth" });
      }}
      className="relative mx-auto max-w-2xl"
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
        <i className="fa-solid fa-magnifying-glass text-slate-400" />
      </div>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar calzado, accesorios, artesanías, tecnología, tiendas..."
        aria-label="Buscar productos"
        className="w-full rounded-xl border border-slate-800 bg-slate-950/90 py-3 pr-24 pl-11 text-sm text-white placeholder-slate-500 shadow-inner transition-all duration-200 hover:border-indigo-500/50 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
      />
      <div className="absolute inset-y-1.5 right-1.5 flex items-center gap-1">
        <button
          type="submit"
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-md transition hover:bg-indigo-500"
        >
          Buscar
        </button>
      </div>
    </form>
  );
}

function Grid({
  items,
  loading,
  onOpen,
}: {
  items: Product[] | undefined;
  loading: boolean;
  onOpen: (p: Product) => void;
}) {
  if (loading) return <ProductGridSkeleton />;
  if (!items?.length)
    return (
      <div className="col-span-full py-10 text-center text-slate-500">
        No hay productos que coincidan con tu búsqueda.
      </div>
    );
  return (
    <div id="resultados" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((p) => (
        <AffiliateCard key={p.id} p={p} onOpen={() => onOpen(p)} />
      ))}
    </div>
  );
}

/** Tarjeta de la grilla del prototipo: precio, ganancia por referido, carrito y afiliarse. */
function AffiliateCard({ p, onOpen }: { p: Product; onOpen: () => void }) {
  const off = discountPct(p);
  const rate = Math.round(clampCommission(p.commission) * 100);
  const earn = splitSale(p.price, p.commission).affiliate;
  const affiliate = useAffiliate();
  const badge = off
    ? { t: `OFERTA −${off}%`, c: "border-red-500/30 bg-red-500/20 text-red-400" }
    : isNew(p)
      ? { t: "RECIÉN LANZADO", c: "border-indigo-500/30 bg-indigo-500/20 text-indigo-400" }
      : { t: `${rate}% COMISIÓN`, c: "border-emerald-500/30 bg-emerald-500/20 text-emerald-400" };
  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900 transition duration-300 hover:border-slate-700">
      <button type="button" onClick={onOpen} className="relative h-48 overflow-hidden bg-slate-950">
        <ProductImage
          p={p}
          className="size-full rounded-none bg-slate-950 text-7xl transition duration-500 group-hover:scale-105"
        />
        <span
          className={cn(
            "absolute top-2 left-2 rounded-full border px-2 py-0.5 text-[10px] font-bold",
            badge.c,
          )}
        >
          {badge.t}
        </span>
        {p.ratingCount > 0 && (
          <span className="absolute top-2 right-2 flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900/80 px-2 py-0.5 text-xs font-bold text-amber-400">
            <i className="fa-solid fa-star" /> {p.rating.toFixed(1)}
          </span>
        )}
      </button>
      <div className="flex flex-grow flex-col justify-between p-4">
        <div>
          <span className="text-[10px] font-semibold tracking-wider text-indigo-400 uppercase">
            {p.category}
          </span>
          <button type="button" onClick={onOpen} className="block text-left">
            <h3 className="mt-1 text-base font-bold text-white transition-colors group-hover:text-indigo-400">
              {p.name}
            </h3>
          </button>
          <Link
            to="/tienda/$slug"
            params={{ slug: p.store.slug }}
            className="mt-1 block text-xs text-slate-400 hover:text-indigo-300"
          >
            <i className="fa-solid fa-building me-1 text-indigo-400" /> {p.store.name}
          </Link>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3">
          <div>
            <span className="block text-xs text-slate-400">
              Precio: {cop(p.price)}
              {off > 0 && (
                <span className="ms-1 text-slate-500 line-through">{cop(p.compareAtPrice!)}</span>
              )}
            </span>
            <span className="text-sm font-extrabold text-emerald-400">Ganas: {cop(earn)}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => addToCart(p)}
              disabled={p.stock < 1}
              title={p.stock < 1 ? "Agotado" : "Agregar al carrito"}
              aria-label="Agregar al carrito"
              className="rounded-lg bg-orange-500/20 px-2.5 py-1.5 text-xs font-bold text-orange-400 transition hover:bg-orange-500 hover:text-white disabled:opacity-40"
            >
              <i className="fa-solid fa-cart-plus" />
            </button>
            <button
              onClick={() => affiliate(p)}
              className="rounded-lg bg-indigo-600/20 px-3 py-1.5 text-xs font-bold text-indigo-400 transition hover:bg-indigo-600 hover:text-white"
            >
              Afiliarse
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
