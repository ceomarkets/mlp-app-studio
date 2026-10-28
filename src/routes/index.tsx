import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { addToCart } from "@/components/CartSheet";
import { Empty, ProductCard, ProductGridSkeleton, Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { backend, type ProductFilter } from "@/lib/backend";
import { CATEGORIES } from "@/lib/plaza";
import { keys } from "@/lib/session";

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
        content: "Marketplace multitienda con red de afiliados desde Pasto, Nariño.",
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

function Plaza() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("Todo");
  const [sort, setSort] = useState<NonNullable<ProductFilter["sort"]>>("popular");
  const filter = { q: useDeferredValue(q), category, sort };
  const products = useQuery({
    queryKey: keys.products(filter),
    queryFn: () => backend.listProducts(filter),
    placeholderData: keepPreviousData,
  });
  const stores = useQuery({ queryKey: keys.stores, queryFn: () => backend.listStores() });

  return (
    <Shell>
      <section className="grid gap-8 rounded-3xl bg-ink p-6 text-ink-foreground md:grid-cols-[1.4fr_1fr] md:p-12">
        <div>
          <p className="mb-4 inline-block rounded-full bg-sun px-3 py-1 text-xs font-bold text-accent-foreground">
            Lanzamiento · 0% comisión para tiendas fundadoras
          </p>
          <h1 className="text-4xl font-extrabold leading-[1.05] md:text-6xl">
            Tu tienda, tu red,
            <br />
            <span className="text-sun">tus ganancias.</span>
          </h1>
          <p className="mt-4 max-w-md opacity-80">
            Productos de tiendas de Nariño en un solo lugar. Vende con tu marca o gana compartiendo,
            sin inventario.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/afiliados">Ganar como afiliado</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link to="/vendedores">Abrir mi tienda</Link>
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 self-center">
          {(stores.data ?? []).slice(0, 4).map((s) => (
            <Link
              key={s.id}
              to="/tienda/$slug"
              params={{ slug: s.slug }}
              className="rounded-2xl bg-ink-foreground/10 p-4 transition hover:bg-ink-foreground/20"
            >
              <div className="text-3xl">{s.emoji}</div>
              <div className="mt-2 text-sm font-bold leading-tight">{s.name}</div>
              <div className="text-xs opacity-70">{s.city}</div>
            </Link>
          ))}
          {stores.isPending &&
            Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-ink-foreground/10" />
            ))}
        </div>
      </section>

      <div className="mt-10 flex flex-col gap-3 md:flex-row md:items-center">
        <label className="relative flex-1">
          <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar en toda la plaza…"
            className="h-11 w-full rounded-full border bg-card pl-11 pr-5 outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="h-11 rounded-full border bg-card px-4 text-sm font-semibold"
          aria-label="Ordenar"
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {["Todo", ...CATEGORIES].map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`h-9 shrink-0 rounded-full border px-4 text-sm font-semibold transition ${c === category ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary"}`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {products.isPending ? (
          <ProductGridSkeleton />
        ) : products.data?.length ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
            {products.data.map((p) => (
              <ProductCard
                key={p.id}
                p={p}
                action={
                  <Button
                    className="w-full"
                    variant="outline"
                    disabled={p.stock < 1}
                    onClick={() => addToCart(p)}
                  >
                    {p.stock < 1 ? "Agotado" : "Agregar"}
                  </Button>
                }
              />
            ))}
          </div>
        ) : (
          <Empty icon={<Search />} title="No encontramos productos">
            Prueba con otra búsqueda o categoría.
          </Empty>
        )}
      </div>
    </Shell>
  );
}
