import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgePercent,
  History,
  Plus,
  Search,
  Share2,
  Sparkles,
  Store,
  TrendingUp,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { addToCart } from "@/components/CartSheet";
import { CATEGORY_ICON, Rail } from "@/components/Rail";
import { Empty, ProductCard, ProductGridSkeleton, Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { backend, type Product, type ProductFilter } from "@/lib/backend";
import { useCart, useFavorites, useViewed } from "@/lib/client-state";
import { buildSections } from "@/lib/feed";
import { CATEGORIES } from "@/lib/plaza";
import { keys } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Plaza X — Marketplace multitienda con red de afiliados" },
      {
        name: "description",
        content:
          "Compra a tiendas locales de Nariño, vende con tu marca o gana comisiones compartiendo productos.",
      },
      { property: "og:title", content: "Plaza X — Tu tienda, tu red, tus ganancias" },
      {
        property: "og:description",
        content: "Ofertas, novedades y tiendas locales. Compra, vende o gana compartiendo.",
      },
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
          <Plus /> Agregar
        </>
      )}
    </Button>
  );
}

function Plaza() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("Todo");
  const [sort, setSort] = useState<NonNullable<ProductFilter["sort"]>>("popular");
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

  // Solo las categorías que tienen productos, con su conteo.
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    all.data?.forEach((p) => m.set(p.category, (m.get(p.category) ?? 0) + 1));
    return m;
  }, [all.data]);
  const cats = ["Todo", ...CATEGORIES.filter((c) => counts.has(c))];

  return (
    <Shell wide>
      {/* Portada */}
      <section className="relative overflow-hidden rounded-3xl bg-ink p-5 text-ink-foreground md:p-10">
        <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-primary/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 size-72 rounded-full bg-sun/20 blur-3xl" />
        <div className="relative grid gap-8 md:grid-cols-[1.3fr_1fr] md:items-center">
          <div>
            <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-sun px-3 py-1 text-[11px] font-bold text-accent-foreground md:mb-4 md:text-xs">
              <Zap className="size-3.5" /> Lanzamiento · 0% comisión para tiendas fundadoras
            </p>
            <h1 className="text-3xl font-extrabold leading-[1.02] md:text-6xl">
              Tu tienda, tu red, <br className="hidden md:block" />
              <span className="text-sun">tus ganancias.</span>
            </h1>
            <p className="mt-3 hidden max-w-md text-sm opacity-80 md:block md:text-base">
              Lo mejor de Nariño en un solo lugar. Compra, vende con tu marca o gana compartiendo.
            </p>
            <label className="relative mt-4 block max-w-xl md:mt-6">
              <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="¿Qué buscas hoy? Café, ruanas, artesanías…"
                aria-label="Buscar productos"
                className="h-13 w-full rounded-2xl border-0 bg-background pl-12 pr-12 text-base text-foreground shadow-card outline-none ring-sun/60 focus:ring-4"
              />
              {q && (
                <button
                  onClick={() => setQ("")}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                >
                  <X className="size-4" />
                </button>
              )}
            </label>
            <div className="mt-4 flex flex-wrap gap-2 md:mt-5">
              <Button asChild size="sm" variant="secondary" className="rounded-full">
                <Link to="/afiliados">
                  <Share2 /> Ganar compartiendo
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="rounded-full border-ink-foreground/30 bg-transparent text-ink-foreground hover:bg-ink-foreground/10 hover:text-ink-foreground"
              >
                <Link to="/vendedores">
                  <Store /> Abrir mi tienda
                </Link>
              </Button>
            </div>
          </div>
          <div className="hidden gap-3 md:grid">
            {[
              { v: stores.data?.length ?? "…", k: "tiendas locales" },
              { v: all.data?.length ?? "…", k: "productos" },
              { v: "20%", k: "comisión máxima para afiliados" },
            ].map((s) => (
              <div key={s.k} className="rounded-2xl bg-ink-foreground/10 p-3 backdrop-blur md:p-4">
                <div className="font-display text-2xl font-extrabold text-sun md:text-3xl">
                  {s.v}
                </div>
                <div className="text-[11px] leading-tight opacity-80 md:text-sm">{s.k}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

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
              {c !== "Todo" && (
                <span className={cn("text-xs", active ? "opacity-70" : "text-muted-foreground")}>
                  {counts.get(c)}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {browsing ? (
        <section className="mt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {results.data?.length ?? "…"} resultados
              {dq && (
                <>
                  {" "}
                  para <b className="text-foreground">“{dq}”</b>
                </>
              )}
              {category !== "Todo" && (
                <>
                  {" "}
                  en <b className="text-foreground">{category}</b>
                </>
              )}
            </p>
            <SortSelect sort={sort} setSort={setSort} />
          </div>
          <Grid items={results.data} loading={results.isPending} />
        </section>
      ) : (
        <>
          {sections.deals.length > 0 && (
            <Rail
              tone="hot"
              icon={<BadgePercent />}
              title="Ofertas de la semana"
              subtitle="Descuentos reales de las tiendas"
            >
              {sections.deals.map((p) => (
                <ProductCard key={p.id} p={p} action={<QuickAdd p={p} />} />
              ))}
            </Rail>
          )}

          {sections.forYou.length > 0 && (
            <Rail icon={<Wand2 />} title="Para ti" subtitle="Según lo que has visto y guardado">
              {sections.forYou.map((p) => (
                <ProductCard key={p.id} p={p} action={<QuickAdd p={p} />} />
              ))}
            </Rail>
          )}

          <Rail icon={<TrendingUp />} title="Lo más vendido" subtitle="Lo que más compra la gente">
            {sections.best.map((p) => (
              <ProductCard key={p.id} p={p} action={<QuickAdd p={p} />} />
            ))}
          </Rail>

          {sections.fresh.length > 0 && (
            <Rail
              icon={<Sparkles />}
              title="Recién llegados"
              subtitle="Novedades de los últimos 14 días"
            >
              {sections.fresh.map((p) => (
                <ProductCard key={p.id} p={p} action={<QuickAdd p={p} />} />
              ))}
            </Rail>
          )}

          {/* Tiendas */}
          <section className="mt-10">
            <div className="mb-4 flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-2xl bg-card text-primary shadow-card">
                <Store className="size-5" />
              </span>
              <h2 className="text-xl font-extrabold md:text-2xl">Tiendas de la plaza</h2>
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

          {/* Llamado viral */}
          <section className="mt-10 grid items-center gap-5 rounded-3xl bg-sun p-6 text-accent-foreground md:grid-cols-[1fr_auto] md:p-8">
            <div>
              <h2 className="text-2xl font-extrabold md:text-3xl">
                Comparte un enlace, gana hasta 20%
              </h2>
              <p className="mt-1 max-w-xl text-sm opacity-80">
                Elige un producto, compártelo por WhatsApp o con un QR y cobra en Nequi cada vez que
                alguien compre. Sin inventario, sin envíos.
              </p>
            </div>
            <Button asChild size="lg" className="rounded-full">
              <Link to="/afiliados">
                Activar mi enlace <ArrowRight />
              </Link>
            </Button>
          </section>

          {sections.viewed.length > 0 && (
            <Rail icon={<History />} title="Vistos recientemente">
              {sections.viewed.map((p) => (
                <ProductCard key={p.id} p={p} action={<QuickAdd p={p} />} />
              ))}
            </Rail>
          )}

          <section className="mt-10">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-extrabold md:text-2xl">Todo el catálogo</h2>
              <SortSelect sort={sort} setSort={setSort} />
            </div>
            <Grid items={results.data} loading={results.isPending} />
          </section>
        </>
      )}
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

function Grid({ items, loading }: { items: Product[] | undefined; loading: boolean }) {
  if (loading) return <ProductGridSkeleton />;
  if (!items?.length)
    return (
      <Empty icon={<Search />} title="No encontramos productos">
        Prueba con otra palabra o categoría.
      </Empty>
    );
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-5 lg:grid-cols-4">
      {items.map((p) => (
        <ProductCard key={p.id} p={p} action={<QuickAdd p={p} />} />
      ))}
    </div>
  );
}
