import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { addToCart } from "@/components/CartSheet";
import { Leaderboard } from "@/components/Leaderboard";
import { QuickView } from "@/components/QuickView";
import { ShareButton } from "@/components/ShareSheet";
import { Shell } from "@/components/Shell";
import { backend, type Product } from "@/lib/backend";
import {
  applyBrowse,
  companiesOf,
  NO_BROWSE,
  PRICE_BANDS,
  type Browse,
  type PriceBand,
} from "@/lib/browse";
import { useViewed, viewed as viewedStore } from "@/lib/client-state";
import { EXAMPLE_META, EXAMPLE_PRODUCTS, isExample } from "@/lib/examples";
import { discountPct, isNew, temperatures, type BoardFilter } from "@/lib/feed";
import { AFFILIATE_MAX, clampCommission, cop } from "@/lib/plaza";
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

type Role = "comprador" | "afiliado" | "empresa";
const ROLE_KEY = "plazax-role";

/** Textos del selector de rol, iguales al diseño. */
const ROLES: Record<
  Role,
  {
    button: string;
    icon: string;
    active: string;
    badge: string;
    title: string;
    subtitle: string;
    board: BoardFilter;
    to?: "/afiliados" | "/vendedores";
  }
> = {
  comprador: {
    button: "Comprar Productos",
    icon: "fa-shopping-bag",
    active: "bg-indigo-600",
    badge: "MODO COMPRADOR: EXPLORA TIENDAS & PRODUCTOS",
    title: "El Mercado Multitienda & Red de Afiliación",
    subtitle:
      "Encuentra productos verificados de múltiples empresas, gana premios por tus compras o regístrate como Afiliado/Empresa para vender y promocionar.",
    board: "all",
  },
  afiliado: {
    button: "Ganar Comisiones",
    icon: "fa-hand-holding-dollar text-emerald-600",
    active: "bg-emerald-600",
    badge: `MODO AFILIADO: PROMOCIONA Y GANA HASTA ${Math.round(AFFILIATE_MAX * 100)}%`,
    title: "Genera Ingresos Promocionando Productos",
    subtitle:
      "Elige productos de empresas verificadas, genera tu enlace de afiliado y recibe comisiones automáticas.",
    board: "earn",
    to: "/afiliados",
  },
  empresa: {
    button: "Vender como Empresa",
    icon: "fa-store text-indigo-600",
    active: "bg-indigo-600",
    badge: "MODO EMPRESA: SUBE TU CATÁLOGO & RECLUTA AFILIADOS",
    title: "Vende tus Productos con una Red de Promotores",
    subtitle:
      "Publica tus artículos, establece las comisiones para afiliados y multiplica tus ventas nacionales y locales.",
    board: "all",
    to: "/vendedores",
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
  const navigate = useNavigate();
  const [q, setQ] = useState("");
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
    const to = ROLES[r].to;
    if (to) navigate({ to });
  };

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
  const cats = useMemo(() => [...new Set(source.map((p) => p.category))], [source]);
  const temps = useMemo(
    () => temperatures(all.data ?? [], activity.data ?? []),
    [all.data, activity.data],
  );
  const view = ROLES[role];
  const set = (patch: Partial<Browse>) => setBrowse((b) => ({ ...b, ...patch }));
  const open = (p: Product) => {
    if (!isExample(p.id)) viewedStore.add(p.id);
    setQuick(p);
  };

  return (
    <Shell bare>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-300/80 bg-slate-200/60 px-4 py-12 text-center">
        <div className="relative z-10 mx-auto max-w-4xl">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3.5 py-1 text-xs font-bold text-indigo-700 shadow-sm">
            <span className="size-2 animate-pulse rounded-full bg-emerald-500" /> {view.badge}
          </span>
          <h1 className="mb-4 text-3xl leading-tight font-black tracking-tight text-slate-900 sm:text-5xl">
            {view.title}
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-sm font-normal text-slate-600 sm:text-base">
            {view.subtitle}
          </p>

          <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
            {(Object.keys(ROLES) as Role[]).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                aria-pressed={role === r}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition",
                  role === r
                    ? cn(ROLES[r].active, "text-white shadow")
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

          <SearchBar value={q} onChange={setQ} />
        </div>
      </section>

      <div className="flex flex-grow flex-col bg-slate-100">
        {/* Cinta leaderboard en vivo y filtros unificados */}
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
                  ["local", "📍 Cobertura Local"],
                  ["national", "🚚 Envíos Nacionales Colombia"],
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

        {/* Catálogo */}
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h3 id="catalogo" className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <i className="fa-solid fa-shop text-indigo-600" /> Catálogo de Productos
            </h3>
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
          </div>

          {examples && (
            <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Productos de ejemplo: así se verá el catálogo cuando las empresas publiquen sus
              artículos desde el Panel Empresas.
            </p>
          )}

          {!catalog ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="h-80 animate-pulse rounded-xl bg-slate-200" />
              ))}
            </div>
          ) : catalog.length ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
          <div className="mt-10 flex flex-col items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:flex-row sm:p-8">
            <div>
              <h4 className="flex items-center gap-2 text-lg font-black text-slate-900 sm:text-xl">
                ¿Te gustó? Cuéntale a alguien 💛
              </h4>
              <p className="mt-1 text-xs font-medium text-slate-400 sm:text-sm">
                Un mensaje ayuda a una tienda local.
              </p>
            </div>
            <ShareButton
              data={plazaShare}
              className="flex shrink-0 items-center gap-2.5 rounded-full bg-indigo-600 px-6 py-3 text-xs font-extrabold text-white shadow-md transition-transform hover:scale-105 hover:bg-indigo-700 sm:text-sm"
            >
              <i className="fa-solid fa-share-nodes text-sm" /> Compartir Plaza X
            </ShareButton>
          </div>
        </div>
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

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
      }}
      className="relative mx-auto max-w-3xl space-y-3"
    >
      <div className="flex items-center rounded-full border border-slate-300 bg-white p-1.5 shadow-xl transition focus-within:border-indigo-600">
        <i className="fa-solid fa-magnifying-glass ml-4 text-sm text-slate-400" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Buscar calzado, accesorios, tecnología, tiendas..."
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

/** Tarjeta del catálogo, igual al diseño (createGridCardHTML). */
function GridCard({ p, temp, onOpen }: { p: Product; temp: number; onOpen: () => void }) {
  const meta = EXAMPLE_META.get(p.id);
  const off = discountPct(p);
  const rate = Math.round(clampCommission(p.commission) * 100);
  const badge = meta
    ? { t: meta.badge, c: meta.badgeColor }
    : off
      ? { t: `OFERTA −${off}%`, c: "bg-rose-100 text-rose-700 border-rose-200" }
      : isNew(p)
        ? { t: "RECIÉN LANZADO", c: "bg-indigo-100 text-indigo-700 border-indigo-200" }
        : { t: `${rate}% COMISIÓN`, c: "bg-emerald-100 text-emerald-700 border-emerald-200" };
  const img = p.images[0];
  return (
    <div
      onClick={onOpen}
      className="group flex cursor-pointer flex-col justify-between overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-indigo-400 hover:shadow-md"
    >
      <div>
        <div className="relative grid h-48 place-items-center overflow-hidden bg-slate-100">
          {img ? (
            <img
              src={img}
              alt={p.name}
              loading="lazy"
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <span aria-hidden className="text-7xl">
              {p.emoji}
            </span>
          )}
          {temp > 0 && (
            <span className="absolute top-2 left-2 rounded bg-amber-500 px-2 py-0.5 text-xs font-black text-white shadow">
              <i className="fa-solid fa-fire" /> {temp}°
            </span>
          )}
          {meta && (
            <span className="absolute top-2 right-2 rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-bold text-white">
              Ejemplo
            </span>
          )}
          {p.stock > 0 && p.stock <= 10 && (
            <span className="absolute right-2 bottom-2 rounded-full border border-rose-200 bg-white/90 px-2 py-0.5 text-[10px] font-bold text-rose-600 shadow-sm backdrop-blur-md">
              ¡Solo quedan {p.stock}!
            </span>
          )}
        </div>
        <div className="p-4">
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase",
              badge.c,
            )}
          >
            {badge.t}
          </span>
          <h3 className="mt-2 mb-1 text-sm font-bold text-slate-900">{p.name}</h3>
          <p className="mb-3 text-xs text-slate-500">
            <i className="fa-solid fa-store me-1" />
            {p.store.name}
          </p>
          <div className="text-lg font-extrabold text-indigo-600">{cop(p.price)}</div>
        </div>
      </div>
      <div className="p-4 pt-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            addToCart(p);
          }}
          disabled={p.stock < 1}
          className="w-full rounded-lg bg-indigo-600 py-2 text-xs font-bold text-white shadow transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {p.stock < 1 ? "Agotado" : "Añadir al Carrito"}
        </button>
      </div>
    </div>
  );
}
