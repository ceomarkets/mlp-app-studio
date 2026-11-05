import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { backend, type Click, type OrderItem } from "@/lib/backend";
import { buildLink, CHANNELS, statsBy, type LinkTarget } from "@/lib/affiliate-links";
import { cop, REF_WINDOW_DAYS } from "@/lib/plaza";
import { keys } from "@/lib/session";
import { cn } from "@/lib/utils";

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/** Generador de enlaces con canal + rendimiento por enlace y por canal. */
export function AffiliateLinks({
  username,
  clicks,
  items,
}: {
  username: string;
  clicks: Click[];
  items: OrderItem[];
}) {
  const products = useQuery({ queryKey: keys.products({}), queryFn: () => backend.listProducts() });
  const stores = useQuery({ queryKey: keys.stores, queryFn: () => backend.listStores() });
  const myStore = useQuery({ queryKey: keys.myStore, queryFn: () => backend.myStore() });
  // Solo lo que paga comisión y no es de la propia tienda.
  const promotable = (products.data ?? []).filter(
    (p) => p.commission > 0 && p.storeId !== myStore.data?.id,
  );
  const [dest, setDest] = useState("plaza");
  const [channel, setChannel] = useState<string>("whatsapp");
  const [custom, setCustom] = useState("");
  const target: LinkTarget = dest.startsWith("p:")
    ? { kind: "product", id: dest.slice(2) }
    : dest.startsWith("s:")
      ? { kind: "store", slug: dest.slice(2) }
      : { kind: "plaza" };
  const source = channel === "otro" ? custom : channel;
  const link = buildLink(window.location.origin, username, target, source);

  const byProduct = useMemo(() => statsBy(clicks, items, "product"), [clicks, items]);
  const bySource = useMemo(() => statsBy(clicks, items, "source"), [clicks, items]);
  const name = (id: string) =>
    id ? (products.data?.find((p) => p.id === id)?.name ?? "Producto retirado") : "Plaza o tienda";
  const channelName = (id: string) =>
    id ? (CHANNELS.find((c) => c.id === id)?.label ?? id) : "Directo (sin canal)";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar: mantén presionado el enlace");
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-bold text-white">Crea tu enlace</h2>
        <p className="mb-4 text-xs text-slate-400">
          Cada clic queda guardado {REF_WINDOW_DAYS} días en el navegador de quien lo abre (gana el
          último enlace). El canal te dice qué red social te trae más ventas.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold text-slate-300">
            ¿A dónde lleva?
            <select
              value={dest}
              onChange={(e) => setDest(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white"
            >
              <option value="plaza">Toda la plaza</option>
              <optgroup label="Tiendas">
                {(stores.data ?? [])
                  .filter((s) => s.id !== myStore.data?.id)
                  .map((s) => (
                    <option key={s.id} value={`s:${s.slug}`}>
                      {s.name}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Productos que pagan comisión">
                {promotable.map((p) => (
                  <option key={p.id} value={`p:${p.id}`}>
                    {p.name} · {Math.round(p.commission * 100)}%
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <div className="text-xs font-semibold text-slate-300">
            ¿Dónde lo compartes?
            <div className="mt-1 flex flex-wrap gap-1.5">
              {[...CHANNELS, { id: "otro", label: "Otro", icon: "fa-solid fa-pen" }].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setChannel(c.id)}
                  aria-pressed={channel === c.id}
                  className={cn(
                    "flex min-h-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition",
                    channel === c.id
                      ? "border-amber-400/70 text-white"
                      : "border-slate-700 text-slate-400 hover:text-white",
                  )}
                >
                  <i className={c.icon} aria-hidden /> {c.label}
                </button>
              ))}
            </div>
            {channel === "otro" && (
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="Ej.: volante-feria"
                maxLength={40}
                className="mt-2 h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white"
              />
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={link}
            aria-label="Tu enlace"
            onFocus={(e) => e.currentTarget.select()}
            className="h-11 min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 font-mono text-xs text-slate-200"
          />
          <button
            type="button"
            onClick={copy}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 text-sm font-bold text-slate-950 hover:bg-amber-400"
          >
            <i className="fa-solid fa-copy" aria-hidden /> Copiar
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(link)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-200 hover:text-white"
          >
            <i className="fa-brands fa-whatsapp" aria-hidden /> Enviar
          </a>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <StatsTable
          title="Por enlace"
          rows={byProduct}
          label={name}
          empty="Aún no hay clics en tus enlaces."
        />
        <StatsTable
          title="Por canal"
          rows={bySource}
          label={channelName}
          empty="Comparte un enlace con canal para ver de dónde llegan."
        />
      </div>
    </div>
  );
}

function StatsTable({
  title,
  rows,
  label,
  empty,
}: {
  title: string;
  rows: ReturnType<typeof statsBy>;
  label: (key: string) => string;
  empty: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
      <h3 className="border-b border-slate-800 px-4 py-3 text-sm font-bold text-white">{title}</h3>
      {rows.length ? (
        <table className="w-full text-xs">
          <thead className="text-slate-400">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Enlace</th>
              <th className="px-2 py-2 text-right font-semibold">Clics</th>
              <th className="px-2 py-2 text-right font-semibold">Ventas</th>
              <th className="px-2 py-2 text-right font-semibold">Conv.</th>
              <th className="px-4 py-2 text-right font-semibold">Ganado</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 12).map((r) => (
              <tr key={r.key || "none"} className="border-t border-slate-800">
                <td className="max-w-[12rem] truncate px-4 py-2 text-slate-200">{label(r.key)}</td>
                <td className="px-2 py-2 text-right">{r.clicks}</td>
                <td className="px-2 py-2 text-right">{r.sales}</td>
                <td className="px-2 py-2 text-right">{r.clicks ? pct(r.conversion) : "—"}</td>
                <td className="px-4 py-2 text-right font-bold text-amber-400">{cop(r.earned)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="p-6 text-center text-xs text-slate-400">{empty}</p>
      )}
    </section>
  );
}
