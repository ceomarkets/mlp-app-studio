import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { addToCart } from "@/components/CartSheet";
import { DressModel, SKIN_TONES, type SkinId, type WornItem } from "@/components/DressModel";
import { GarmentIcon } from "@/components/GarmentIcon";
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
  type Kind,
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

const STEPS = [
  { icon: "fa-person-dress", text: "Elige modelo y tono de piel" },
  { icon: "fa-hand-pointer", text: "Toca una prenda: se ajusta al cuerpo" },
  { icon: "fa-cart-plus", text: "Añade el look completo al carrito" },
];

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
  const [kindFilter, setKindFilter] = useState<Kind | null>(null);
  const [backdrop, setBackdrop] = useState<(typeof BACKDROPS)[number]["id"]>("estudio");
  const [look, setLookRaw] = useState<Look>({});
  const [history, setHistory] = useState<Look[]>([]);
  const [said, setSaid] = useState("");

  /** Cambia el look guardando el anterior para poder deshacer. */
  const setLook = (next: Look) => {
    if (lookIds(next) === lookIds(look)) return;
    setHistory((h) => [...h.slice(-19), look]);
    setLookRaw(next);
  };
  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setLookRaw(prev);
    setSaid("Cambio deshecho");
  };

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
    setLookRaw(base);
  }, [products, search.look, search.probar]);

  useEffect(() => {
    try {
      localStorage.setItem(LOOK_KEY, lookIds(look));
    } catch {
      /* sin almacenamiento */
    }
  }, [look]);

  useEffect(() => setKindFilter(null), [tab]);

  const byId = (id?: string) => (id ? products.find((p) => p.id === id) : undefined);
  const worn = ZONES_ORDER.flatMap((z) => {
    const p = byId(look[z]);
    return p ? [{ zone: z, p, kind: kindOf(p)! }] : [];
  });
  const items: WornItem[] = worn.map(({ p, kind }) => ({
    id: p.id,
    kind,
    color: colors[p.id]!,
    material: materialOf(p, kind),
  }));
  const total = worn.reduce((t, w) => t + w.p.price, 0);
  const zones = TABS.find((t) => t.id === tab)!.zones;
  const inTab = products.filter((p) => zones.includes(zoneOf(p)!));
  const kindsInTab = [...new Set(inTab.map((p) => kindOf(p)!))];
  const options = kindFilter ? inTab.filter((p) => kindOf(p) === kindFilter) : inTab;
  const counts = Object.fromEntries(
    TABS.map((t) => [t.id, products.filter((p) => t.zones.includes(zoneOf(p)!)).length]),
  ) as Record<Tab, number>;
  const sample = (k: Kind) => inTab.find((p) => kindOf(p) === k)!;

  const wear = (p: Product) => {
    const zone = zoneOf(p)!;
    const on = look[zone] === p.id;
    setLook(toggleWear(look, p.id, zone));
    setSaid(on ? `Quitaste: ${p.name}` : `Puesta: ${p.name}`);
  };
  const remove = (z: Zone) => {
    const next = { ...look };
    delete next[z];
    setLook(next);
  };
  /** Un look al azar con una prenda por zona (para inspirarse). */
  const surprise = () => {
    const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
    let next: Look = {};
    for (const t of TABS) {
      const xs = products.filter((p) => t.zones.includes(zoneOf(p)!));
      const p = pick(xs);
      if (p) next = toggleWear(next, p.id, zoneOf(p)!);
    }
    setLook(next);
    setSaid("Look sorpresa listo");
  };

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

  const toolBtn =
    "flex min-h-0 items-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-950/75 px-2.5 py-1.5 text-[11px] font-bold text-slate-200 backdrop-blur transition hover:border-amber-400 hover:text-amber-300 disabled:opacity-40 disabled:hover:border-slate-700/80 disabled:hover:text-slate-200";

  return (
    <Shell wide>
      <p aria-live="polite" className="sr-only">
        {said}
      </p>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
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
          className="flex gap-1 rounded-2xl border border-slate-800 bg-slate-900 p-1 text-xs font-bold"
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
                "flex items-center gap-2 rounded-xl px-4 py-2 transition",
                gender === id
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md"
                  : "text-slate-300 hover:bg-slate-800 hover:text-amber-400",
              )}
            >
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-lg text-sm",
                  gender === id ? "bg-slate-950/15" : "bg-slate-800",
                )}
              >
                <i className={cn("fa-solid", icon)} />
              </span>
              {label}
            </button>
          ))}
        </div>
      </header>

      {examples && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          <i className="fa-solid fa-circle-info" /> Prendas de ejemplo: cuando las tiendas publiquen
          ropa, calzado y accesorios aparecerán aquí para probarlos.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        {/* Escenario con el modelo */}
        <section className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          <div
            className={cn(
              "gold-border-glow relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-b px-4 pt-14 pb-12",
              BACKDROPS.find((b) => b.id === backdrop)!.cls,
            )}
          >
            <DressModel
              gender={gender}
              skin={skin}
              items={items}
              className="mx-auto block aspect-[300/720] w-[62%] max-w-[270px] drop-shadow-2xl sm:w-full"
            />

            {/* Fondo y tono de piel */}
            <div className="absolute top-3 left-3 flex flex-col gap-1.5">
              <div
                role="radiogroup"
                aria-label="Fondo"
                className="flex items-center gap-1 rounded-xl bg-slate-950/75 p-1 backdrop-blur"
              >
                <i
                  className="fa-solid fa-image w-5 text-center text-[11px] text-slate-400"
                  title="Fondo"
                />
                {BACKDROPS.map((b) => (
                  <button
                    key={b.id}
                    role="radio"
                    aria-checked={backdrop === b.id}
                    onClick={() => setBackdrop(b.id)}
                    title={`Fondo ${b.label}`}
                    aria-label={`Fondo ${b.label}`}
                    data-tip={`Fondo ${b.label}`}
                    className={cn(
                      "grid size-7 min-h-0 place-items-center rounded-lg border-2 bg-gradient-to-b transition",
                      b.cls,
                      backdrop === b.id
                        ? "border-amber-400"
                        : "border-transparent hover:border-slate-500",
                    )}
                  >
                    {backdrop === b.id && (
                      <i className="fa-solid fa-check text-[10px] text-amber-300 drop-shadow" />
                    )}
                  </button>
                ))}
              </div>
              <div
                role="radiogroup"
                aria-label="Tono de piel"
                className="flex items-center gap-1 rounded-xl bg-slate-950/75 p-1 backdrop-blur"
              >
                <i
                  className="fa-solid fa-hand w-5 text-center text-[11px] text-slate-400"
                  title="Tono de piel"
                />
                {SKIN_TONES.map((t) => (
                  <button
                    key={t.id}
                    role="radio"
                    aria-checked={skin === t.id}
                    onClick={() => setSkin(t.id)}
                    title={`Piel ${t.id}`}
                    aria-label={`Tono de piel ${t.id}`}
                    data-tip={`Tono de piel ${t.id}`}
                    style={{ background: t.skin }}
                    className={cn(
                      "grid size-7 min-h-0 place-items-center rounded-full border-2 transition",
                      skin === t.id
                        ? "border-amber-400"
                        : "border-transparent hover:border-slate-500",
                    )}
                  >
                    {skin === t.id && (
                      <i className="fa-solid fa-check text-[10px] text-slate-950/70" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Acciones rápidas */}
            <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
              <button onClick={surprise} className={toolBtn} disabled={!products.length}>
                <i className="fa-solid fa-shuffle text-amber-400" /> Sorpréndeme
              </button>
              <button onClick={undo} className={toolBtn} disabled={!history.length}>
                <i className="fa-solid fa-rotate-left" /> Deshacer
              </button>
              {worn.length > 0 && (
                <button onClick={() => setLook({})} className={toolBtn}>
                  <i className="fa-solid fa-broom" /> Quitar todo
                </button>
              )}
            </div>

            {/* Guía rápida cuando el modelo aún no tiene prendas */}
            {worn.length === 0 && (
              <ol className="absolute inset-x-3 bottom-3 space-y-1 rounded-2xl border border-amber-500/20 bg-slate-950/80 p-3 text-[11px] text-slate-200 backdrop-blur">
                {STEPS.map((s, i) => (
                  <li key={s.icon} className="flex items-center gap-2">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-amber-500 text-[10px] font-black text-slate-950">
                      {i + 1}
                    </span>
                    <i className={cn("fa-solid w-4 text-center text-amber-400", s.icon)} />
                    {s.text}
                  </li>
                ))}
              </ol>
            )}

            {/* Lo que tiene puesto */}
            {worn.length > 0 && (
              <div className="absolute inset-x-3 bottom-3 flex flex-wrap justify-center gap-1.5">
                {worn.map(({ zone, p, kind }) => (
                  <button
                    key={zone}
                    onClick={() => remove(zone)}
                    title={`Quitar ${p.name}`}
                    aria-label={`Quitar ${p.name}`}
                    className="flex min-h-0 animate-in items-center gap-1 rounded-full border border-amber-500/30 bg-slate-950/85 py-0.5 ps-0.5 pe-2 text-[10px] font-bold text-amber-200 backdrop-blur zoom-in-90 fade-in hover:border-rose-400 hover:text-rose-300"
                  >
                    <span className="grid size-5 place-items-center rounded-full bg-slate-800">
                      <GarmentIcon
                        kind={kind}
                        color={colors[p.id]!}
                        gender={gender}
                        className="size-4"
                      />
                    </span>
                    {KIND_LABEL[kind]}
                    <i className="fa-solid fa-xmark ms-0.5 opacity-70" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Resumen del look */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="mb-3 flex items-center justify-between text-sm font-bold text-white">
              <span className="flex items-center gap-2">
                <i className="fa-solid fa-bag-shopping text-amber-400" /> Tu look
              </span>
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-slate-300">
                {worn.length} {worn.length === 1 ? "prenda" : "prendas"}
              </span>
            </h2>
            {worn.length ? (
              <ul className="mb-3 space-y-1.5 text-xs">
                {worn.map(({ zone, p, kind }) => (
                  <li
                    key={zone}
                    className="flex items-center gap-2 rounded-xl bg-slate-950/60 p-1.5 pe-2"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-800">
                      <GarmentIcon
                        kind={kind}
                        color={colors[p.id]!}
                        gender={gender}
                        className="size-7"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-slate-200">{p.name}</span>
                      <span className="block truncate text-[10px] text-slate-500">
                        {ZONE_LABEL[zone]} · {p.store.name}
                      </span>
                    </span>
                    <span className="shrink-0 font-bold text-amber-400">{copShort(p.price)}</span>
                    {!isExample(p.id) && (
                      <Link
                        to="/producto/$id"
                        params={{ id: p.id }}
                        title="Ver producto"
                        aria-label={`Ver ${p.name}`}
                        className="grid size-7 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-amber-400"
                      >
                        <i className="fa-solid fa-eye text-[11px]" />
                      </Link>
                    )}
                    <button
                      onClick={() => remove(zone)}
                      title="Quitar"
                      aria-label={`Quitar ${p.name}`}
                      className="grid size-7 min-h-0 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-rose-400"
                    >
                      <i className="fa-solid fa-xmark text-[11px]" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-3 flex items-center gap-2 rounded-xl bg-slate-950/60 p-3 text-xs text-slate-400">
                <i className="fa-solid fa-shirt text-slate-600" /> El modelo está listo. Elige
                prendas o toca <b className="text-amber-400">Sorpréndeme</b>.
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
                <i className="fa-brands fa-whatsapp" /> Compartir look
              </ShareButton>
            </div>
          </div>
        </section>

        {/* Selector de prendas */}
        <section className="min-w-0">
          <div className="sticky top-16 z-20 -mx-4 mb-3 bg-slate-950/95 px-4 py-2 backdrop-blur lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:py-0">
            <div
              role="tablist"
              aria-label="Zonas del cuerpo"
              className="rail grid grid-cols-4 gap-1.5 text-xs sm:flex sm:gap-2"
            >
              {TABS.map((t) => {
                const on = tab === t.id;
                const dressed = t.zones.some((z) => look[z]);
                return (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={on}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "relative flex flex-col items-center gap-1 rounded-2xl border px-2 py-2 transition sm:flex-row sm:gap-2 sm:px-3.5",
                      on
                        ? "border-amber-400 bg-gradient-to-r from-amber-500 to-amber-600 font-black text-slate-950 shadow-md"
                        : "border-slate-700/80 bg-slate-800/80 font-medium text-slate-300 hover:text-amber-400",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-8 place-items-center rounded-xl text-sm",
                        on ? "bg-slate-950/15" : "bg-slate-950",
                      )}
                    >
                      <i className={cn("fa-solid", t.icon)} />
                    </span>
                    <span className="text-[11px] sm:text-xs">{t.label}</span>
                    <span
                      className={cn(
                        "hidden rounded-full px-1.5 text-[10px] font-black sm:inline",
                        on ? "bg-slate-950/20" : "bg-slate-950 text-amber-400",
                      )}
                    >
                      {counts[t.id]}
                    </span>
                    {dressed && (
                      <span
                        className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-emerald-500 text-[8px] text-white ring-2 ring-slate-950"
                        title="Ya tiene una prenda de esta zona"
                      >
                        <i className="fa-solid fa-check" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tipos de prenda en la zona, con su ícono */}
            {kindsInTab.length > 1 && (
              <div className="rail mt-2 flex gap-1.5 overflow-x-auto pb-1 text-[11px]">
                <button
                  onClick={() => setKindFilter(null)}
                  aria-pressed={kindFilter === null}
                  className={cn(
                    "flex min-h-0 shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-bold transition",
                    kindFilter === null
                      ? "border-amber-400 bg-amber-500/15 text-amber-300"
                      : "border-slate-700 text-slate-300 hover:text-amber-400",
                  )}
                >
                  <i className="fa-solid fa-border-all" /> Todo
                </button>
                {kindsInTab.map((k) => (
                  <button
                    key={k}
                    onClick={() => setKindFilter(kindFilter === k ? null : k)}
                    aria-pressed={kindFilter === k}
                    className={cn(
                      "flex min-h-0 shrink-0 items-center gap-1.5 rounded-full border py-1 ps-1 pe-3 font-bold transition",
                      kindFilter === k
                        ? "border-amber-400 bg-amber-500/15 text-amber-300"
                        : "border-slate-700 text-slate-300 hover:text-amber-400",
                    )}
                  >
                    <span className="grid size-6 place-items-center rounded-full bg-slate-800">
                      <GarmentIcon
                        kind={k}
                        color={colors[sample(k).id]!}
                        gender={gender}
                        className="size-5"
                      />
                    </span>
                    {KIND_LABEL[k]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {all.isPending ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="h-56 animate-pulse rounded-2xl bg-slate-900" />
              ))}
            </div>
          ) : options.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
              {options.map((p) => {
                const zone = zoneOf(p)!;
                const kind = kindOf(p)!;
                const on = look[zone] === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => wear(p)}
                    aria-pressed={on}
                    aria-label={`${on ? "Quitar" : "Probar"} ${p.name}`}
                    className={cn(
                      "group flex flex-col overflow-hidden rounded-2xl border bg-slate-900 text-left transition active:scale-[0.98]",
                      on
                        ? "border-amber-400 shadow-lg ring-2 shadow-amber-500/10 ring-amber-400/30"
                        : "border-slate-800 hover:-translate-y-0.5 hover:border-amber-500/50",
                    )}
                  >
                    <span className="relative grid h-36 place-items-center overflow-hidden bg-gradient-to-b from-slate-800 to-slate-950">
                      {p.images[0] ? (
                        <img
                          src={p.images[0]}
                          alt=""
                          loading="lazy"
                          className="size-full object-cover transition duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <GarmentIcon
                          kind={kind}
                          color={colors[p.id]!}
                          gender={gender}
                          className="size-28 drop-shadow-xl transition duration-300 group-hover:scale-105"
                        />
                      )}
                      <span
                        className={cn(
                          "absolute top-2 right-2 grid size-8 place-items-center rounded-full text-xs shadow transition",
                          on
                            ? "bg-amber-500 text-slate-950"
                            : "bg-slate-950/80 text-slate-200 group-hover:bg-amber-500 group-hover:text-slate-950",
                        )}
                      >
                        <i className={cn("fa-solid", on ? "fa-check" : "fa-plus")} />
                      </span>
                      {p.images[0] && (
                        <span
                          className="absolute bottom-2 left-2 grid size-9 place-items-center rounded-xl border border-white/10 bg-slate-950/85 backdrop-blur"
                          title="Así se verá en el modelo"
                        >
                          <GarmentIcon
                            kind={kind}
                            color={colors[p.id]!}
                            gender={gender}
                            className="size-7"
                          />
                        </span>
                      )}
                      <span className="absolute top-2 left-2 rounded-md bg-slate-950/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-200">
                        {KIND_LABEL[kind]}
                      </span>
                    </span>
                    <span className="flex flex-grow flex-col p-3">
                      <span className="line-clamp-2 text-xs font-bold text-white">{p.name}</span>
                      <span className="mb-1 truncate text-[10px] text-slate-400">
                        <i className="fa-solid fa-store me-1 text-amber-400" />
                        {p.store.name}
                      </span>
                      <span className="mt-auto flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-amber-400">
                          {copShort(p.price)}
                        </span>
                        <span
                          className={cn(
                            "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
                            on ? "bg-amber-500/15 text-amber-300" : "bg-slate-800 text-slate-300",
                          )}
                        >
                          <i
                            className={cn("fa-solid", on ? "fa-person-dress" : "fa-hand-pointer")}
                          />
                          {on ? "Puesta" : "Probar"}
                        </span>
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
          <p className="mt-4 flex gap-2 text-[11px] text-slate-500">
            <i className="fa-solid fa-circle-info mt-0.5" />
            <span>
              Cada prenda se dibuja con su molde ajustado al cuerpo del modelo y el color del
              producto. Es una guía visual: el estampado, la caída y la talla reales pueden variar.
              Revisa las fotos y la guía de tallas de la tienda antes de comprar.
            </span>
          </p>
        </section>
      </div>
    </Shell>
  );
}
