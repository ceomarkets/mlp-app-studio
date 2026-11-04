import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { addToCart } from "@/components/CartSheet";
import { ShareButton } from "@/components/ShareSheet";
import { Shell } from "@/components/Shell";
import { backend, type Product } from "@/lib/backend";
import { copShort, EXAMPLE_ALL, isExample } from "@/lib/examples";
import { keys } from "@/lib/session";
import { cn } from "@/lib/utils";
import {
  isHeadwear,
  lookIds,
  parseLook,
  slotOf,
  SLOTS,
  type Gender,
  type Look,
  type Slot,
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
        content: "Arma tu look con prendas de las tiendas de Plaza X y míralo en el maniquí.",
      },
    ],
  }),
  component: Vestidor,
});

const LOOK_KEY = "plazax-look";

/** Fondos del estudio (como en las sesiones de fotos de producto). */
const BACKDROPS = [
  { id: "estudio", label: "Estudio", cls: "from-slate-800 via-slate-900 to-slate-950" },
  { id: "dorado", label: "Dorado", cls: "from-amber-500/30 via-slate-900 to-slate-950" },
  { id: "noche", label: "Noche", cls: "from-indigo-900/60 via-slate-900 to-black" },
] as const;

function Vestidor() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const all = useQuery({ queryKey: keys.products({}), queryFn: () => backend.listProducts() });
  const examples = all.isSuccess && all.data.length === 0;
  const products = useMemo(
    () => (examples ? EXAMPLE_ALL : (all.data ?? [])).filter((p) => slotOf(p) !== null),
    [examples, all.data],
  );

  const [gender, setGender] = useState<Gender>(search.modelo ?? "mujer");
  const [tab, setTab] = useState<Slot>("top");
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
    const base = parseLook(search.look ?? saved, products);
    if (search.probar) {
      const p = products.find((x) => x.id === search.probar);
      const slot = p && slotOf(p);
      if (slot) {
        base[slot] = p.id;
        setTab(slot);
      }
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
  const worn = SLOTS.map((s) => ({ slot: s, p: byId(look[s.id]) })).filter((x) => !!x.p) as {
    slot: (typeof SLOTS)[number];
    p: Product;
  }[];
  const total = worn.reduce((t, w) => t + w.p.price, 0);
  const options = products.filter((p) => slotOf(p) === tab);
  const counts = Object.fromEntries(
    SLOTS.map((s) => [s.id, products.filter((p) => slotOf(p) === s.id).length]),
  ) as Record<Slot, number>;

  const wear = (p: Product) => {
    const slot = slotOf(p)!;
    setLook((l) => {
      const next = { ...l };
      if (next[slot] === p.id) delete next[slot];
      else next[slot] = p.id;
      return next;
    });
  };

  const addLook = () => {
    const real = worn.filter((w) => !isExample(w.p.id) && w.p.stock > 0);
    if (!worn.length) return void toast.info("Primero viste al maniquí con alguna prenda");
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
            Toca una prenda para ponérsela al maniquí. Combina, compara y lleva el look completo.
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
        {/* Escenario con el maniquí */}
        <section className="space-y-3">
          <div
            className={cn(
              "gold-border-glow relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-b p-4",
              BACKDROPS.find((b) => b.id === backdrop)!.cls,
            )}
          >
            <Mannequin
              gender={gender}
              look={look}
              byId={byId}
              onRemove={(s) =>
                setLook((l) => {
                  const next = { ...l };
                  delete next[s];
                  return next;
                })
              }
            />
            <div className="absolute top-3 left-3 flex gap-1">
              {BACKDROPS.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setBackdrop(b.id)}
                  aria-pressed={backdrop === b.id}
                  title={`Fondo ${b.label}`}
                  className={cn(
                    "size-6 min-h-0 rounded-full border bg-gradient-to-b",
                    b.cls,
                    backdrop === b.id ? "border-amber-400" : "border-slate-600",
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
                {worn.map(({ slot, p }) => (
                  <li key={slot.id} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2 text-slate-300">
                      <i className={cn("fa-solid w-4 text-amber-400", slot.icon)} />
                      <span className="truncate">{p.name}</span>
                    </span>
                    <span className="shrink-0 font-bold text-amber-400">{copShort(p.price)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-3 text-xs text-slate-400">
                El maniquí está listo. Elige prendas a la derecha 👉
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
            {SLOTS.map((s) => (
              <button
                key={s.id}
                role="tab"
                aria-selected={tab === s.id}
                onClick={() => setTab(s.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-2 transition",
                  tab === s.id
                    ? "border-amber-400 bg-gradient-to-r from-amber-500 to-amber-600 font-black text-slate-950"
                    : "border-slate-700/80 bg-slate-800/80 font-medium text-slate-300 hover:text-amber-400",
                )}
              >
                <i className={cn("fa-solid", s.icon)} /> {s.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px] font-black",
                    tab === s.id ? "bg-slate-950/20" : "bg-slate-950 text-amber-400",
                  )}
                >
                  {counts[s.id]}
                </span>
                {look[s.id] && <i className="fa-solid fa-circle-check text-emerald-400" />}
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
                const on = look[slotOf(p)!] === p.id;
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
                        {on ? "Puesta · toca para quitar" : "Toca para probar"}
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
              <button
                onClick={() => navigate({ to: "/" })}
                className="font-bold text-amber-400 hover:underline"
              >
                Ver el catálogo
              </button>
            </div>
          )}
          <p className="mt-4 text-[11px] text-slate-500">
            El maniquí es una guía visual: colores y tallas reales pueden variar. Revisa la ficha de
            cada producto y la guía de tallas de la tienda antes de comprar.
          </p>
        </section>
      </div>
    </Shell>
  );
}

/** Siluetas del maniquí: cada prenda se ve dentro de su zona del cuerpo. */
const SHAPES: Record<
  Gender,
  {
    top: string;
    bottom: string;
    shoes: string;
    head: [number, number, number];
    hand: [number, number];
  }
> = {
  mujer: {
    head: [100, 42, 22],
    top: "M62 84 Q100 70 138 84 L156 96 Q166 150 160 210 L148 212 Q146 160 140 130 L136 200 Q138 218 134 236 L66 236 Q62 218 64 200 L60 130 Q54 160 52 212 L40 210 Q34 150 44 96 Z",
    bottom: "M66 232 L134 232 Q140 300 132 420 L106 420 L100 280 L94 420 L68 420 Q60 300 66 232 Z",
    shoes: "M66 418 L96 418 L98 444 Q84 450 62 446 Z M104 418 L134 418 L138 446 Q116 450 102 444 Z",
    hand: [156, 228],
  },
  hombre: {
    head: [100, 40, 23],
    top: "M56 84 Q100 72 144 84 L162 98 Q172 150 166 214 L152 216 Q150 165 144 130 L142 236 L58 236 L56 130 Q50 165 48 216 L34 214 Q28 150 38 98 Z",
    bottom: "M58 232 L142 232 Q144 320 138 420 L108 420 L100 290 L92 420 L62 420 Q56 320 58 232 Z",
    shoes: "M60 418 L94 418 L96 444 Q80 451 56 446 Z M106 418 L140 418 L144 446 Q120 451 104 444 Z",
    hand: [160, 232],
  },
};

function Mannequin({
  gender,
  look,
  byId,
  onRemove,
}: {
  gender: Gender;
  look: Look;
  byId: (id?: string) => Product | undefined;
  onRemove: (s: Slot) => void;
}) {
  const s = SHAPES[gender];
  const [hx, hy, hr] = s.head;
  const top = byId(look.top);
  const bottom = byId(look.bottom);
  const shoes = byId(look.shoes);
  const acc = byId(look.accessory);
  const headwear = acc && isHeadwear(acc);
  const id = `mq-${gender}`;
  const piece = (
    slot: Slot,
    p: Product | undefined,
    path: string,
    box: [number, number, number, number],
  ) =>
    p?.images[0] ? (
      <g key={slot}>
        <clipPath id={`${id}-${slot}`}>
          <path d={path} />
        </clipPath>
        <image
          href={p.images[0]}
          x={box[0]}
          y={box[1]}
          width={box[2]}
          height={box[3]}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${id}-${slot})`}
        />
        <path d={path} fill={`url(#${id}-shade)`} />
      </g>
    ) : p ? (
      <g key={slot}>
        <path d={path} fill="#f59e0b" opacity="0.45" />
        <text
          x={box[0] + box[2] / 2}
          y={box[1] + box[3] / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={Math.min(box[2], box[3]) * 0.45}
        >
          {p.emoji}
        </text>
      </g>
    ) : null;

  return (
    <figure className="relative mx-auto aspect-[200/460] w-full max-w-[300px]">
      <svg
        viewBox="0 0 200 460"
        className="size-full drop-shadow-2xl"
        role="img"
        aria-label="Maniquí del vestidor"
      >
        <defs>
          <linearGradient id={`${id}-shade`} x1="0" x2="1">
            <stop offset="0" stopColor="#000" stopOpacity="0.35" />
            <stop offset="0.5" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id={`${id}-skin`} x1="0" x2="1">
            <stop offset="0" stopColor="#334155" />
            <stop offset="0.5" stopColor="#475569" />
            <stop offset="1" stopColor="#334155" />
          </linearGradient>
        </defs>
        {/* Base */}
        <ellipse cx="100" cy="452" rx="70" ry="6" fill="#000" opacity="0.4" />
        <g fill={`url(#${id}-skin)`} stroke="#f59e0b" strokeOpacity="0.2">
          <circle cx={hx} cy={hy} r={hr} />
          <rect x="92" y={hy + hr - 4} width="16" height="22" rx="6" />
          <path d={s.top} />
          <path d={s.bottom} />
          <path d={s.shoes} />
          <circle cx={200 - s.hand[0]} cy={s.hand[1]} r="8" />
          <circle cx={s.hand[0]} cy={s.hand[1]} r="8" />
        </g>
        {/* Prendas */}
        {piece("bottom", bottom, s.bottom, [50, 228, 100, 196])}
        {piece("shoes", shoes, s.shoes, [52, 414, 96, 40])}
        {piece("top", top, s.top, [28, 70, 144, 170])}
        {acc &&
          (headwear
            ? piece(
                "accessory",
                acc,
                `M${hx - hr - 4} ${hy - 4} Q${hx - hr} ${hy - hr - 14} ${hx} ${hy - hr - 14} Q${hx + hr} ${hy - hr - 14} ${hx + hr + 4} ${hy - 4} Q${hx} ${hy - 12} ${hx - hr - 4} ${hy - 4} Z`,
                [hx - hr - 6, hy - hr - 16, (hr + 6) * 2, hr + 16],
              )
            : piece(
                "accessory",
                acc,
                `M${s.hand[0] - 16} ${s.hand[1] + 2} h32 v34 q0 6 -6 6 h-20 q-6 0 -6 -6 Z`,
                [s.hand[0] - 16, s.hand[1] + 2, 32, 40],
              ))}
      </svg>
      {/* Etiquetas para quitar cada prenda */}
      <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap justify-center gap-1.5">
        {(["accessory", "top", "bottom", "shoes"] as const)
          .filter((k) => look[k])
          .map((k) => (
            <button
              key={k}
              onClick={() => onRemove(k)}
              className="pointer-events-auto min-h-0 rounded-full border border-amber-500/30 bg-slate-950/80 px-2 py-0.5 text-[10px] font-bold text-amber-300 backdrop-blur hover:border-amber-400"
            >
              {SLOTS.find((x) => x.id === k)!.label} <i className="fa-solid fa-xmark ms-0.5" />
            </button>
          ))}
      </figcaption>
    </figure>
  );
}
