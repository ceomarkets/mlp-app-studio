import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgePercent,
  Flame,
  Gem,
  Heart,
  History,
  Plus,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
  Wand2,
  X,
} from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { addToCart } from "@/components/CartSheet";
import { Leaderboard } from "@/components/Leaderboard";
import { QuickView } from "@/components/QuickView";
import { CATEGORY_ICON, Rail } from "@/components/Rail";
import { ShareButton } from "@/components/ShareSheet";
import {
  Empty,
  Price,
  ProductCard,
  ProductGridSkeleton,
  ProductImage,
  Shell,
} from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { backend, type Product, type ProductFilter } from "@/lib/backend";
import { useCart, useFavorites, useViewed } from "@/lib/client-state";
import { buildSections, discountPct } from "@/lib/feed";
import { CATEGORIES, cop } from "@/lib/plaza";
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
  // "Joya del día": la mejor oferta real; si no hay, el más vendido.
  const gem = sections.deals[0] ?? sections.best[0];

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    all.data?.forEach((p) => m.set(p.category, (m.get(p.category) ?? 0) + 1));
    return m;
  }, [all.data]);
  const cats = ["Todo", ...CATEGORIES.filter((c) => counts.has(c))];

  return (
    <Shell wide top={<Leaderboard products={all.data ?? []} />}>
      {/* Portada: una idea, una búsqueda, una oferta */}
      <section className="relative overflow-hidden rounded-3xl bg-ink p-5 text-ink-foreground md:p-10">
        <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-primary/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 size-72 rounded-full bg-sun/20 blur-3xl" />
        <div className="relative grid gap-6 md:grid-cols-[1.25fr_1fr] md:items-center md:gap-10">
          <div>
            <h1 className="text-3xl font-extrabold leading-[1.05] md:text-6xl">
              Lo bonito de Nariño, <span className="text-sun">a un toque.</span>
            </h1>
            <p className="mt-2 text-sm opacity-80 md:mt-3 md:text-lg">
              Compra fácil. Paga seguro. Apoya lo local.
            </p>
            <label className="relative mt-4 block max-w-xl md:mt-6">
              <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="¿Qué se te antoja hoy?"
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
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs opacity-85 md:text-sm">
              <li className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-sun" /> Pago seguro
              </li>
              <li className="inline-flex items-center gap-1.5">
                <Truck className="size-4 text-sun" /> Envíos a todo el país
              </li>
              <li className="inline-flex items-center gap-1.5">
                <Heart className="size-4 text-sun" /> {stores.data?.length ?? "…"} tiendas locales
              </li>
            </ul>
          </div>

          {gem && <GemCard p={gem} onOpen={() => setQuick(gem)} />}
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
          <Grid items={results.data} loading={results.isPending} />
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

          <Rail icon={<Flame />} title="Los favoritos de todos" subtitle="Lo que más se vende">
            {sections.best.map((p) => (
              <ProductCard key={p.id} p={p} action={<QuickAdd p={p} />} />
            ))}
          </Rail>

          {sections.fresh.length > 0 && (
            <Rail icon={<Sparkles />} title="Recién llegados" subtitle="Fresquitos de las tiendas">
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
              <p className="text-sm text-muted-foreground">Un mensaje ayuda a una tienda local.</p>
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

          <section className="mt-10">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-extrabold md:text-2xl">Todo</h2>
              <SortSelect sort={sort} setSort={setSort} />
            </div>
            <Grid items={results.data} loading={results.isPending} />
          </section>
        </>
      )}

      <QuickView product={quick} onClose={() => setQuick(null)} />
    </Shell>
  );
}

/** La mejor oferta del momento, lista para comprar en un toque. */
function GemCard({ p, onOpen }: { p: Product; onOpen: () => void }) {
  const off = discountPct(p);
  return (
    <button
      onClick={onOpen}
      className="group flex items-center gap-4 rounded-3xl bg-background p-3 text-left text-foreground shadow-card transition hover:-translate-y-1 md:flex-col md:items-stretch md:p-4"
    >
      <div className="relative shrink-0">
        <ProductImage
          p={p}
          className="size-24 rounded-2xl text-5xl md:aspect-[4/3] md:size-auto md:w-full md:text-7xl"
        />
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-sun px-2 py-0.5 text-[11px] font-extrabold text-accent-foreground shadow-card">
          <Gem className="size-3" /> Joya del día
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs text-muted-foreground">{p.store.name}</div>
        <div className="truncate font-bold md:text-lg">{p.name}</div>
        <Price p={p} />
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-primary">
            {off ? `Ahorras ${cop(p.compareAtPrice! - p.price)}` : `${p.soldCount} ya lo compraron`}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition group-hover:gap-2">
            Comprar <ArrowRight className="size-3.5" />
          </span>
        </div>
      </div>
    </button>
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
      <Empty icon={<Search />} title="No lo encontramos">
        Prueba otra palabra 🙂
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
