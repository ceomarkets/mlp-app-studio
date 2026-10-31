import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ProductImage } from "@/components/Shell";
import { backend, type Product } from "@/lib/backend";
import { affiliateLevel, clampCommission, cop, splitSale } from "@/lib/plaza";
import { keys } from "@/lib/session";
import { cn } from "@/lib/utils";

type Kind = "all" | "imagen" | "video" | "texto";

const TABS: { id: Kind; label: string; icon: string }[] = [
  { id: "all", label: "Todos", icon: "fa-layer-group" },
  { id: "imagen", label: "Imágenes & Banners", icon: "fa-image" },
  { id: "video", label: "Vídeos & Reels", icon: "fa-video" },
  { id: "texto", label: "Textos & Copies", icon: "fa-file-lines" },
];
const KIND_ICON = { imagen: "fa-image", video: "fa-video", texto: "fa-file-lines" } as const;

type Tool = { key: string; kind: Exclude<Kind, "all">; p: Product; value: string };

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copiado`);
  } catch {
    toast.error("No se pudo copiar");
  }
}

/**
 * Herramientas de afiliado: los textos e imágenes publicitarias que cada tienda
 * comparte en sus productos, listos para copiar junto con el enlace propio.
 */
export function AffiliateTools({
  username,
  storeSlug,
}: {
  username: string;
  /** Solo los materiales de esta tienda. */
  storeSlug?: string;
}) {
  const [kind, setKind] = useState<Kind>("all");
  const products = useQuery({ queryKey: keys.products({}), queryFn: () => backend.listProducts() });
  const myStore = useQuery({ queryKey: keys.myStore, queryFn: () => backend.myStore() });

  const tools = useMemo(() => {
    const out: Tool[] = [];
    for (const p of products.data ?? []) {
      if (p.storeId === myStore.data?.id) continue; // sin comisión en la tienda propia
      if (storeSlug && p.store.slug !== storeSlug) continue;
      if (p.promoImage) out.push({ key: `i-${p.id}`, kind: "imagen", p, value: p.promoImage });
      if (p.promoVideo) out.push({ key: `v-${p.id}`, kind: "video", p, value: p.promoVideo });
      if (p.promoCopy) out.push({ key: `t-${p.id}`, kind: "texto", p, value: p.promoCopy });
    }
    return out.filter((t) => kind === "all" || t.kind === kind);
  }, [products.data, myStore.data, kind, storeSlug]);

  const link = (p: Product) => `${window.location.origin}/r/${username}/${p.id}`;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl border border-purple-200 bg-purple-50 text-lg text-purple-600">
          <i className="fa-solid fa-toolbox" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900">Herramientas de Afiliado</h3>
          <p className="text-xs text-slate-500">
            Imágenes y textos promocionales compartidos por las tiendas, con tu enlace.
          </p>
        </div>
      </div>

      <div
        role="tablist"
        className="mb-6 flex gap-4 overflow-x-auto border-b border-slate-200 text-xs font-semibold"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={kind === t.id}
            onClick={() => setKind(t.id)}
            className={cn(
              "shrink-0 pb-2",
              kind === t.id
                ? "border-b-2 border-purple-500 text-purple-600"
                : "text-slate-500 hover:text-slate-900",
            )}
          >
            <i className={cn("fa-solid me-1", t.icon)} /> {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {tools.map((t) => (
          <div
            key={t.key}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {t.kind === "imagen" ? (
                <img
                  src={t.value}
                  alt=""
                  className="size-12 shrink-0 rounded-lg object-cover"
                  loading="lazy"
                />
              ) : (
                <ProductImage p={t.p} className="size-12 shrink-0 rounded-lg bg-white text-2xl" />
              )}
              <div className="min-w-0">
                <h4 className="truncate text-xs font-bold text-slate-900">
                  <i className={cn("fa-solid me-1 text-purple-600", KIND_ICON[t.kind])} />
                  {t.p.name} · {t.p.store.name}
                </h4>
                <p className="line-clamp-2 text-[11px] text-slate-500">
                  {t.kind === "texto"
                    ? t.value
                    : t.kind === "video"
                      ? "Video oficial para Reels, TikTok o Shorts"
                      : "Banner publicitario oficial de la tienda"}
                </p>
                <p className="text-[10px] font-bold text-emerald-600">
                  Ganas {cop(splitSale(t.p.price, t.p.commission).affiliate)} (
                  {Math.round(clampCommission(t.p.commission) * 100)}%)
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              {t.kind === "texto" ? (
                <button
                  onClick={() => copy(`${t.value}\n👉 ${link(t.p)}`, "Texto con tu enlace")}
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-800 transition hover:bg-slate-200"
                >
                  <i className="fa-solid fa-copy me-1" /> Copiar texto + enlace
                </button>
              ) : (
                <a
                  href={t.value}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-800 transition hover:bg-slate-200"
                >
                  <i className="fa-solid fa-download me-1" />{" "}
                  {t.kind === "video" ? "Ver video" : "Abrir imagen"}
                </a>
              )}
              <button
                onClick={() => copy(link(t.p), "Enlace")}
                className="rounded-lg bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-600 transition hover:bg-purple-600 hover:text-white"
              >
                <i className="fa-solid fa-link me-1" /> Enlace
              </button>
            </div>
          </div>
        ))}
        {!tools.length && (
          <div className="py-8 text-center text-xs text-slate-500">
            No hay materiales cargados en esta categoría.
          </div>
        )}
      </div>
    </div>
  );
}

/** Tarjeta de nivel del afiliado (ventas referidas reales). */
export function LevelCard({ level }: { level: ReturnType<typeof affiliateLevel> }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 uppercase">Nivel de Afiliado</span>
        <i className="fa-solid fa-award text-lg text-amber-700" />
      </div>
      <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
        <i className="fa-solid fa-crown text-xs" /> {level.name.toUpperCase()} ({level.sales}{" "}
        ventas)
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        {level.next
          ? `Próxima meta: +${level.missing} ventas para ${level.next.name}`
          : "¡Nivel máximo alcanzado!"}
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-50">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-emerald-400"
          style={{ width: `${Math.round(level.progress * 100)}%` }}
        />
      </div>
    </div>
  );
}
