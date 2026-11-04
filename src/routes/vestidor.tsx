import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { addToCart } from "@/components/CartSheet";
import { DressModel, SKIN_TONES, type SkinId, type WornItem } from "@/components/DressModel";
import { ShareButton } from "@/components/ShareSheet";
import { Shell } from "@/components/Shell";
import { backend, type Product } from "@/lib/backend";
import { copShort, EXAMPLE_ALL, isExample } from "@/lib/examples";
import { useGarmentColors } from "@/lib/garment-color";
import { keys } from "@/lib/session";
import { cn } from "@/lib/utils";
import {
  KIND_LABEL,
  kindOf,
  lookIds,
  materialOf,
  parseLook,
  TABS,
  tabOf,
  toggleWear,
  ZONE_LABEL,
  zoneOf,
  type Gender,
  type Look,
  type Tab,
  type Zone,
} from "@/lib/vestidor";

type Search = { probar?: string; look?: string; modelo?: Gender };

export const Route = createFileRoute("/vestidor")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ...(typeof s["probar"] === "string" ? { probar: s["probar"] } : {}),
    ...(typeof s["look"] === "string" ? { look: s["look"] } : {}),
    ...(s["modelo"] === "hombre" || s["modelo"] === "mujer" ? { modelo: s["modelo"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Vestidor virtual · Plaza X" },
      {
        name: "description",
        content:
          "Viste al modelo con ropa, calzado y accesorios de las tiendas de Plaza X y arma tu look.",
      },
    ],
  }),
  component: Vestidor,
});

const LOOK_KEY = "plazax-look";
const ZONES_ORDER: Zone[] = [
  "head",
  "face",
  "neck",
  "outer",
  "top",
  "dress",
  "bottom",
  "shoes",
  "hand",
];

const BACKDROPS = [
  { id: "estudio", label: "Estudio", cls: "from-slate-700 via-slate-800 to-slate-950" },
  { id: "dorado", label: "Dorado", cls: "from-amber-200/40 via-slate-800 to-slate-950" },
  { id: "claro", label: "Claro", cls: "from-stone-200 via-stone-300 to-stone-400" },
] as const;

function Vestidor() {
  const search = Route.useSearch();
  const all = useQuery({ queryKey: keys.products({}), queryFn: () => backend.listProducts() });
  const examples = all.isSuccess && all.data.length === 0;
  const products = useMemo(
    () => (examples ? EXAMPLE_ALL : (all.data ?? [])).filter((p) => zoneOf(p) !== null),
    [examples, all.data],
  );
  const colors = useGarmentColors(products);

  const [gender, setGender] = useState<Gender>(search.modelo ?? "mujer");
  const [skin, setSkin] = useState<SkinId>("trigueña");
  const [tab, setTab] = useState<Tab>("superior");
  const [backdrop, setBackdrop] = useState<(typeof BACKDROPS)[number]["id"]>("estudio");
  const [look, setLook] = useState<Look>({});

  // Look inicial: el enlace compartido, el guardado o el producto a "probar".
  useEffect(() => {
    if (!products.length) return;
    let saved: string | undefined;
    try {
      saved = localStorage.getItem(LOOK_KEY) ?? undefined;
    } catch {
      /* sin almacenamiento */
    }
    let base = parseLook(search.look ?? saved, products);
    const p = search.probar ? products.find((x) => x.id === search.probar) : undefined;
    const zone = p && zoneOf(p);
    if (p && zone) {
      if (base[zone] !== p.id) base = toggleWear(base, p.id, zone);
      setTab(tabOf(zone));
    }
    setLook(base);
  }, [products, search.look, search.probar]);

  useEffect(() => {
    try {
      localStorage.setItem(LOOK_KEY, lookIds(look));
    } catch {
      /* sin almacenamiento */
    }
  }, [look]);

  const byId = (id?: string) => (id ? products.find((p) => p.id === id) : undefined);
  const worn = ZONES_ORDER.flatMap((z) => {
    const p = byId(look[z]);
    return p ? [{ zone: z, p }] : [];
  });
  const items: WornItem[] = worn.map(({ p }) => {
    const kind = kindOf(p)!;
    return { id: p.id, kind, color: colors[p.id]!, material: materialOf(p, kind) };
  });
  const total = worn.reduce((t, w) => t + w.p.price, 0);
  const zones = TABS.find((t) => t.id === tab)!.zones;
  const options = products.filter((p) => zones.includes(zoneOf(p)!));
  const counts = Object.fromEntries(
    TABS.map((t) => [t.id, products.filter((p) => t.zones.includes(zoneOf(p)!)).length]),
  ) as Record<Tab, number>;

  const wear = (p: Product) => setLook((l) => toggleWear(l, p.id, zoneOf(p)!));
  const remove = (z: Zone) =>
    setLook((l) => {
      const next = { ...l };
      delete next[z];
      return next;
    });

  const addLook = () => {
    const real = worn.filter((w) => !isExample(w.p.id) && w.p.stock > 0);
    if (!worn.length) return void toast.info("Primero viste al modelo con alguna prenda");
    if (!real.length)
      return void toast.info("Son prendas de ejemplo: aún no están a la venta en Plaza X");
    real.forEach((w) => addToCart(w.p));
  };

  const shareLink = () => ({
    title: "Mi look en Plaza X",
    text: `👗 Mira el look que armé en el vestidor virtual de Plaza X (${copShort(total)})`,
    url: `${window.location.origin}/vestidor?modelo=${gender}&look=${encodeURIComponent(lookIds(look))}`,
  });

  return (
    <Shell wide>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-slate-950 px-3 py-1 text-[11px] font-bold text-amber-300">
            <i className="fa-solid fa-wand-magic-sparkles" /> NUEVO
          </span>
          <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            Vestidor <span className="gold-gradient-text">Virtual</span>
          </h1>
          <p className="text-sm text-slate-400">
            Toca una prenda y se ajusta al cuerpo del modelo. Combina y lleva el look completo.
          </p>
        </div>
        <div
          role="radiogroup"
          aria-label="Modelo"
          className="flex gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1 text-xs font-bold"
        >
          {(
            [
              ["mujer", "fa-person-dress", "Mujer"],
              ["hombre", "fa-person", "Hombre"],
            ] as const
          ).map(([id, icon, label]) => (
            <button
              key={id}
              role="radio"
              aria-checked={gender === id}
              onClick={() => setGender(id)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-4 py-2 transition",
                gender === id
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950"
                  : "text-slate-300 hover:text-amber-400",
              )}
            >
              <i className={cn("fa-solid", icon)} /> {label}
            </button>
          ))}
        </div>
      </header>

      {examples && (
        <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Prendas de ejemplo: cuando las tiendas publiquen ropa, calzado y accesorios aparecerán
          aquí para probarlos.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        {/* Escenario con el modelo */}
        <section className="space-y-3">
          <div
            className={cn(
              "gold-border-glow relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-b px-4 pt-12 pb-4",
              BACKDROPS.find((b) => b.id === backdrop)!.cls,
            )}
          >
            <DressModel
              gender={gender}
              skin={skin}
              items={items}
              className="mx-auto block aspect-[300/720] w-full max-w-[290px] drop-shadow-2xl"
            />
            <div className="absolute top-3 left-3 flex items-center gap-1.5">
              {BACKDROPS.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setBackdrop(b.id)}
                  aria-pressed={backdrop === b.id}
                  title={`Fondo ${b.label}`}
                  className={cn(
                    "size-6 min-h-0 rounded-full border-2 bg-gradient-to-b",
                    b.cls,
                    backdrop === b.id ? "border-amber-400" : "border-slate-600",
                  )}
                />
              ))}
              <span className="mx-1 h-4 w-px bg-slate-600" />
              {SKIN_TONES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSkin(t.id)}
                  aria-pressed={skin === t.id}
                  title={`Tono de piel ${t.id}`}
                  style={{ background: t.skin }}
                  className={cn(
                    "size-6 min-h-0 rounded-full border-2",
                    skin === t.id ? "border-amber-400" : "border-slate-700",
                  )}
                />
              ))}
            </div>
            {worn.length > 0 && (
              <button
                onClick={() => setLook({})}
                className="absolute top-3 right-3 min-h-0 rounded-lg bg-slate-950/70 px-2 py-1 text-[10px] font-bold text-slate-300 hover:text-amber-400"
              >
                <i className="fa-solid fa-rotate-left me-1" /> Quitar todo
              </button>
            )}
            {worn.length > 0 && (
              <div className="absolute inset-x-3 bottom-3 flex flex-wrap justify-center gap-1.5">
                {worn.map(({ zone, p }) => (
                  <button
                    key={zone}
                    onClick={() => remove(zone)}
                    className="min-h-0 rounded-full border border-amber-500/30 bg-slate-950/80 px-2 py-0.5 text-[10px] font-bold text-amber-300 backdrop-blur hover:border-amber-400"
                  >
                    {KIND_LABEL[kindOf(p)!]} <i className="fa-solid fa-xmark ms-0.5" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Resumen del look */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="mb-2 flex items-center justify-between text-sm font-bold text-white">
              Tu look{" "}
              <span className="text-xs font-medium text-slate-400">
                {worn.length} {worn.length === 1 ? "prenda" : "prendas"}
              </span>
            </h2>
            {worn.length ? (
              <ul className="mb-3 space-y-1.5 text-xs">
                {worn.map(({ zone, p }) => (
                  <li key={zone} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2 text-slate-300">
                      <span
                        className="size-3 shrink-0 rounded-full border border-white/20"
                        style={{ background: colors[p.id] }}
                      />
                      <span className="truncate">{p.name}</span>
                    </span>
                    <span className="shrink-0 font-bold text-amber-400">{copShort(p.price)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-3 text-xs text-slate-400">
                El modelo está listo. Elige prendas a la derecha 👉
              </p>
            )}
            <div className="mb-3 flex items-center justify-between border-t border-slate-800 pt-3">
              <span className="text-xs text-slate-400">Total del look:</span>
              <span className="text-base font-black text-amber-400">{copShort(total)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={addLook}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-2.5 text-xs font-black text-slate-950 transition hover:from-amber-400 hover:to-amber-500"
              >
                <i className="fa-solid fa-cart-plus" /> Añadir look
              </button>
              <ShareButton
                data={shareLink}
                className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 py-2.5 text-xs font-bold text-amber-400 transition hover:border-amber-400"
              >
                <i className="fa-solid fa-share-nodes" /> Compartir look
              </ShareButton>
            </div>
          </div>
        </section>

        {/* Selector de prendas */}
        <section className="min-w-0">
          <div
            role="tablist"
            aria-label="Zonas"
            className="rail mb-4 flex gap-2 overflow-x-auto pb-1 text-xs"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-2 transition",
                  tab === t.id
                    ? "border-amber-400 bg-gradient-to-r from-amber-500 to-amber-600 font-black text-slate-950"
                    : "border-slate-700/80 bg-slate-800/80 font-medium text-slate-300 hover:text-amber-400",
                )}
              >
                <i className={cn("fa-solid", t.icon)} /> {t.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px] font-black",
                    tab === t.id ? "bg-slate-950/20" : "bg-slate-950 text-amber-400",
                  )}
                >
                  {counts[t.id]}
                </span>
                {t.zones.some((z) => look[z]) && (
                  <i className="fa-solid fa-circle-check text-emerald-400" />
                )}
              </button>
            ))}
          </div>

          {all.isPending ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="h-56 animate-pulse rounded-2xl bg-slate-900" />
              ))}
            </div>
          ) : options.length ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {options.map((p) => {
                const zone = zoneOf(p)!;
                const on = look[zone] === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => wear(p)}
                    aria-pressed={on}
                    className={cn(
                      "group flex flex-col overflow-hidden rounded-2xl border bg-slate-900 text-left transition",
                      on
                        ? "border-amber-400 shadow-lg shadow-amber-500/10"
                        : "border-slate-800 hover:border-amber-500/50",
                    )}
                  >
                    <span className="relative grid h-36 place-items-center overflow-hidden bg-slate-950">
                      {p.images[0] ? (
                        <img
                          src={p.images[0]}
                          alt=""
                          loading="lazy"
                          className="size-full object-cover transition duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <span aria-hidden className="text-6xl">
                          {p.emoji}
                        </span>
                      )}
                      <span
                        className={cn(
                          "absolute top-2 right-2 grid size-7 place-items-center rounded-full text-xs",
                          on ? "bg-amber-500 text-slate-950" : "bg-slate-950/80 text-slate-300",
                        )}
                      >
                        <i className={cn("fa-solid", on ? "fa-check" : "fa-plus")} />
                      </span>
                      <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-slate-950/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-200">
                        <span
                          className="size-2.5 rounded-full border border-white/30"
                          style={{ background: colors[p.id] }}
                        />
                        {KIND_LABEL[kindOf(p)!]}
                      </span>
                    </span>
                    <span className="flex flex-grow flex-col p-3">
                      <span className="line-clamp-2 text-xs font-bold text-white">{p.name}</span>
                      <span className="mb-1 truncate text-[10px] text-slate-400">
                        <i className="fa-solid fa-store me-1 text-amber-400" />
                        {p.store.name}
                      </span>
                      <span className="mt-auto text-xs font-black text-amber-400">
                        {copShort(p.price)}
                      </span>
                      <span className="mt-1 text-[10px] font-bold text-slate-400">
                        {on
                          ? `Puesta en ${ZONE_LABEL[zone].toLowerCase()} · toca para quitar`
                          : "Toca para probar"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-700 p-10 text-center text-sm text-slate-400">
              <i className="fa-solid fa-shirt mb-2 block text-3xl text-slate-600" />
              Aún no hay prendas en esta zona.{" "}
              <Link to="/" className="font-bold text-amber-400 hover:underline">
                Ver el catálogo
              </Link>
            </div>
          )}
          <p className="mt-4 text-[11px] text-slate-500">
            Cada prenda se dibuja con su molde ajustado al cuerpo del modelo y el color del
            producto. Es una guía visual: el estampado, la caída y la talla reales pueden variar.
            Revisa las fotos y la guía de tallas de la tienda antes de comprar.
          </p>
        </section>
      </div>
    </Shell>
  );
}
