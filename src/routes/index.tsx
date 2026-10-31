import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, Share2, Store } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { addToCart } from "@/components/CartSheet";
import { Leaderboard } from "@/components/Leaderboard";
import { QuickView, useAffiliate } from "@/components/QuickView";
import { ShareButton } from "@/components/ShareSheet";
import { ProductGridSkeleton, ProductImage, Shell } from "@/components/Shell";
import { backend, type Product, type ProductFilter } from "@/lib/backend";
import {
  applyBrowse,
  citiesOf,
  companiesOf,
  isBrowsing,
  NO_BROWSE,
  PRICE_BANDS,
  type Browse,
  type PriceBand,
} from "@/lib/browse";
import { useViewed } from "@/lib/client-state";
import { discountPct, isNew, type BoardFilter } from "@/lib/feed";
import { AFFILIATE_MAX, CATEGORIES, clampCommission, cop, splitSale } from "@/lib/plaza";
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

type Role = "comprador" | "afiliado" | "empresa";
const ROLE_KEY = "plazax-role";

const ROLES: Record<
  Role,
  {
    button: string;
    icon: string;
    badge: string;
    title: string;
    subtitle: string;
    board: BoardFilter;
    cta?: { to: "/afiliados" | "/vendedores"; label: string };
  }
> = {
  comprador: {
    button: "Comprar Productos",
    icon: "fa-shopping-bag",
    badge: "MODO COMPRADOR: EXPLORA TIENDAS & PRODUCTOS",
    title: "El Mercado Multitienda & Red de Afiliación",
    subtitle:
      "Productos de tiendas verificadas, pago protegido en custodia y premios por tus compras.",
    board: "all",
  },
  afiliado: {
    button: "Ganar Comisiones",
    icon: "fa-hand-holding-dollar text-emerald-600",
    badge: "MODO AFILIADO: RECOMIENDA Y GANA",
    title: `Comparte productos y gana hasta ${Math.round(AFFILIATE_MAX * 100)}% por venta`,
    subtitle:
      "Elige un producto, copia tu enlace y cobra por cada compra que llegue por él. Sin inventario.",
    board: "earn",
    cta: { to: "/afiliados", label: "Ir a mi Panel Afiliado" },
  },
  empresa: {
    button: "Vender como Empresa",
    icon: "fa-store text-indigo-600",
    badge: "MODO EMPRESA: VENDE CON UNA RED DE AFILIADOS",
    title: "Publica tu catálogo y vende con afiliados",
    subtitle:
      "Abre tu tienda gratis, define la comisión y deja que la red promocione tus productos. Solo pagas cuando vendes.",
    board: "stores",
    cta: { to: "/vendedores", label: "Ir a mi Panel Empresa" },
  },
};

function readRole(): Role {
  try {
    const r = localStorage.getItem(ROLE_KEY);
    if (r === "afiliado" || r === "empresa") return r;
  } catch {
    /* sin almacenamiento: comprador */
  }
  return "comprador";
}

function Plaza() {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<NonNullable<ProductFilter["sort"]>>("popular");
  const [browse, setBrowse] = useState<Browse>(NO_BROWSE);
  const [quick, setQuick] = useState<Product | null>(null);
  const [role, setRoleState] = useState<Role>("comprador");
  const [board, setBoard] = useState<BoardFilter>("all");
  const dq = useDeferredValue(q.trim());

  useEffect(() => {
    const r = readRole();
    setRoleState(r);
    setBoard(ROLES[r].board);
  }, []);
  const setRole = (r: Role) => {
    setRoleState(r);
    setBoard(ROLES[r].board);
    try {
      localStorage.setItem(ROLE_KEY, r);
    } catch {
      /* sin almacenamiento */
    }
  };

  const all = useQuery({ queryKey: keys.products({}), queryFn: () => backend.listProducts() });
  const filter = { q: dq, sort };
  const results = useQuery({
    queryKey: keys.products(filter),
    queryFn: () => backend.listProducts(filter),
    placeholderData: keepPreviousData,
  });
  const stores = useQuery({ queryKey: keys.stores, queryFn: () => backend.listStores() });
  const viewed = useViewed();

  const boardProducts = useMemo(() => applyBrowse(all.data ?? [], browse), [all.data, browse]);
  const catalog = useMemo(
    () => (results.data ? applyBrowse(results.data, browse) : undefined),
    [results.data, browse],
  );
  const cities = useMemo(() => citiesOf(all.data ?? []), [all.data]);
  const companies = useMemo(() => companiesOf(all.data ?? []), [all.data]);
  const cats = useMemo(
    () => CATEGORIES.filter((c) => all.data?.some((p) => p.category === c)),
    [all.data],
  );
  const view = ROLES[role];
  const set = (patch: Partial<Browse>) => setBrowse((b) => ({ ...b, ...patch }));

  return (
    <Shell bare>
      {/* Portada */}
      <section className="relative overflow-hidden border-b border-slate-300/80 bg-slate-200/60 px-4 py-12 text-center">
        <div className="relative z-10 mx-auto max-w-4xl">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3.5 py-1 text-xs font-bold text-indigo-700 shadow-sm">
            <span className="size-2 animate-pulse rounded-full bg-emerald-500" /> {view.badge}
          </span>
          <h1 className="mb-4 text-3xl leading-tight font-black tracking-tight text-slate-900 sm:text-5xl">
            {view.title}
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-sm text-slate-600 sm:text-base">
            {view.subtitle}
          </p>

          <div
            role="group"
            aria-label="¿Qué quieres hacer?"
            className="mb-8 flex flex-wrap items-center justify-center gap-3"
          >
            {(Object.keys(ROLES) as Role[]).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                aria-pressed={role === r}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition",
                  role === r
                    ? "bg-indigo-600 text-white shadow"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
                )}
              >
                <i
                  className={cn(
                    "fa-solid",
                    role === r ? ROLES[r].icon.split(" ")[0] : ROLES[r].icon,
                  )}
                />{" "}
                {ROLES[r].button}
              </button>
            ))}
          </div>

          {view.cta ? (
            <Link
              to={view.cta.to}
              className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800"
            >
              {view.cta.label} <ArrowRight className="size-4" />
            </Link>
          ) : null}

          <SearchBar value={q} onChange={setQ} />
        </div>
      </section>

      {/* Leaderboard en vivo con filtros unificados */}
      <Leaderboard
        products={boardProducts}
        filter={board}
        onFilter={setBoard}
        viewed={viewed}
        controls={
          <>
            <Picker
              icon="fa-location-dot text-red-500"
              label="Ubicación"
              value={browse.location}
              onChange={(location) => set({ location })}
              options={[
                ["all", "Todas las ubicaciones"],
                ...cities.map((c): [string, string] => [`city:${c}`, `📍 ${c}`]),
                ["national", "🚚 Envíos nacionales Colombia"],
              ]}
            />
            <Picker
              icon="fa-box-archive text-indigo-600"
              label="Categoría"
              value={browse.category}
              onChange={(category) => set({ category })}
              options={[["all", "Todos"], ...cats.map((c): [string, string] => [c, c])]}
            />
            <Picker
              icon="fa-tag text-emerald-600"
              label="Precio"
              value={browse.price}
              onChange={(price) => set({ price: price as PriceBand })}
              options={PRICE_BANDS.map((b): [string, string] => [b.id, b.label])}
            />
          </>
        }
      />

      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Catálogo */}
        <section aria-labelledby="catalogo">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2
                id="catalogo"
                className="flex items-center gap-2 text-lg font-bold text-slate-900"
              >
                <i className="fa-solid fa-shop text-indigo-600" /> Catálogo de Productos
              </h2>
              <p className="text-xs text-slate-500">
                {catalog ? `${catalog.length} productos` : "Cargando…"}
                {dq && (
                  <>
                    {" "}
                    para <b className="text-slate-800">“{dq}”</b>
                  </>
                )}
                {(isBrowsing(browse) || dq) && (
                  <button
                    onClick={() => {
                      setBrowse(NO_BROWSE);
                      setQ("");
                    }}
                    className="ms-2 font-semibold text-indigo-600 hover:underline"
                  >
                    Quitar filtros
                  </button>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={browse.company}
                onChange={(e) => set({ company: e.target.value })}
                aria-label="Empresa"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm transition focus:border-indigo-600 focus:outline-none"
              >
                <option value="all">Todas las Empresas</option>
                {companies.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
              <SortSelect sort={sort} setSort={setSort} />
            </div>
          </div>
          <Grid items={catalog} loading={results.isPending} onOpen={setQuick} />
        </section>

        {/* Tiendas */}
        {!!stores.data?.length && (
          <section className="mt-12">
            <div className="mb-4 flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-2xl bg-white text-indigo-600 shadow-sm">
                <Store className="size-5" />
              </span>
              <h2 className="text-lg font-bold text-slate-900">Empresas en Plaza X</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {stores.data.map((s) => (
                <Link
                  key={s.id}
                  to="/tienda/$slug"
                  params={{ slug: s.slug }}
                  className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300"
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-slate-50 text-2xl">
                    {s.emoji}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 truncate text-sm font-bold text-slate-900">
                      <span className="truncate">{s.name}</span>
                      {s.verified && (
                        <BadgeCheck
                          className="size-4 shrink-0 text-sky-500"
                          aria-label="Verificada"
                        />
                      )}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {s.city} · {s.shipsNational ? "envíos nacionales" : "cobertura local"}
                    </span>
                  </span>
                  <ArrowRight className="ml-auto size-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-indigo-600" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Compartir la plaza: crecer por recomendación */}
        <section className="mt-10 flex flex-col items-center gap-3 rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm md:flex-row md:justify-between md:text-left">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              ¿Te gustó? Cuéntale a alguien 💛
            </h2>
            <p className="text-sm text-slate-500">Un mensaje ayuda a una tienda local.</p>
          </div>
          <ShareButton
            data={plazaShare}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-indigo-600 px-6 font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Share2 className="size-4" /> Compartir Plaza X
          </ShareButton>
        </section>
      </div>

      <QuickView product={quick} onClose={() => setQuick(null)} />
    </Shell>
  );
}

function Picker({
  icon,
  label,
  value,
  onChange,
  options,
}: {
  icon: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-slate-700">
      <i className={cn("fa-solid text-xs", icon)} />
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer bg-transparent text-xs text-slate-700 focus:outline-none"
      >
        {options.map(([v, t]) => (
          <option key={v} value={v} className="bg-white">
            {t}
          </option>
        ))}
      </select>
    </label>
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
      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm focus:border-indigo-600 focus:outline-none"
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
        document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
      }}
      className="mx-auto max-w-3xl"
    >
      <div className="flex items-center rounded-full border border-slate-300 bg-white p-1.5 shadow-xl transition focus-within:border-indigo-600">
        <i className="fa-solid fa-magnifying-glass ml-4 text-sm text-slate-400" />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Buscar calzado, accesorios, artesanías, tecnología, tiendas..."
          aria-label="Buscar productos"
          className="w-full bg-transparent py-2 pr-4 pl-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none sm:text-sm"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-indigo-600 px-6 py-2 text-xs font-bold text-white shadow-md transition hover:bg-indigo-700 sm:text-sm"
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
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
    ? { t: `OFERTA −${off}%`, c: "border-red-200 bg-red-50 text-red-600" }
    : isNew(p)
      ? { t: "RECIÉN LANZADO", c: "border-indigo-200 bg-indigo-50 text-indigo-600" }
      : { t: `${rate}% COMISIÓN`, c: "border-emerald-200 bg-emerald-50 text-emerald-600" };
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:border-indigo-200 hover:shadow-md">
      <button type="button" onClick={onOpen} className="relative h-48 overflow-hidden bg-slate-50">
        <ProductImage
          p={p}
          className="size-full rounded-none bg-slate-50 text-7xl transition duration-500 group-hover:scale-105"
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
          <span className="absolute top-2 right-2 flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-bold text-amber-700">
            <i className="fa-solid fa-star" /> {p.rating.toFixed(1)}
          </span>
        )}
      </button>
      <div className="flex flex-grow flex-col justify-between p-4">
        <div>
          <span className="text-[10px] font-semibold tracking-wider text-indigo-600 uppercase">
            {p.category}
          </span>
          <button type="button" onClick={onOpen} className="block text-left">
            <h3 className="mt-1 text-base font-bold text-slate-900 transition-colors group-hover:text-indigo-600">
              {p.name}
            </h3>
          </button>
          <Link
            to="/tienda/$slug"
            params={{ slug: p.store.slug }}
            className="mt-1 block text-xs text-slate-500 hover:text-indigo-600"
          >
            <i className="fa-solid fa-building me-1 text-indigo-600" /> {p.store.name}
            {p.store.verified && (
              <i className="fa-solid fa-circle-check ms-1 text-sky-500" title="Tienda verificada" />
            )}
          </Link>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3">
          <div>
            <span className="block text-xs text-slate-500">
              Precio: {cop(p.price)}
              {off > 0 && (
                <span className="ms-1 text-slate-500 line-through">{cop(p.compareAtPrice!)}</span>
              )}
            </span>
            <span className="text-sm font-extrabold text-emerald-600">Ganas: {cop(earn)}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => addToCart(p)}
              disabled={p.stock < 1}
              title={p.stock < 1 ? "Agotado" : "Agregar al carrito"}
              aria-label="Agregar al carrito"
              className="rounded-lg bg-orange-50 px-2.5 py-1.5 text-xs font-bold text-orange-600 transition hover:bg-orange-500 hover:text-white disabled:opacity-40"
            >
              <i className="fa-solid fa-cart-plus" />
            </button>
            <button
              onClick={() => affiliate(p)}
              className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-600 transition hover:bg-indigo-600 hover:text-white"
            >
              Afiliarse
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
