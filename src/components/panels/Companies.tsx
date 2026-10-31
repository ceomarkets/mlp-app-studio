import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BadgeCheck, ChevronDown, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AffiliateTools } from "@/components/panels/AffiliateTools";
import { backend, type AffiliateStatus, type Product, type Store } from "@/lib/backend";
import { clampCommission } from "@/lib/plaza";
import { keys } from "@/lib/session";
import { cn } from "@/lib/utils";

export const affKeys = {
  mine: ["user", "affiliations"] as const,
  store: ["user", "store-affiliates"] as const,
};

const STATE: Record<
  AffiliateStatus | "open" | "none",
  { text: string; cls: string; icon: string }
> = {
  approved: {
    text: "Afiliado",
    cls: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: "fa-circle-check",
  },
  open: {
    text: "Abierta",
    cls: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: "fa-door-open",
  },
  pending: {
    text: "Solicitud enviada",
    cls: "border-amber-200 bg-amber-50 text-amber-700",
    icon: "fa-hourglass-half",
  },
  rejected: {
    text: "No aprobada",
    cls: "border-slate-200 bg-slate-100 text-slate-500",
    icon: "fa-circle-xmark",
  },
  none: { text: "", cls: "", icon: "" },
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Panel del afiliado: empresas, estado de vinculación y materiales por empresa. */
export function Companies({ username }: { username: string }) {
  const stores = useQuery({ queryKey: keys.stores, queryFn: () => backend.listStores() });
  const products = useQuery({ queryKey: keys.products({}), queryFn: () => backend.listProducts() });
  const mine = useQuery({ queryKey: affKeys.mine, queryFn: () => backend.myAffiliations() });
  const myStore = useQuery({ queryKey: keys.myStore, queryFn: () => backend.myStore() });
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => {
    const byStore = new Map<string, Product[]>();
    for (const p of products.data ?? []) {
      const list = byStore.get(p.storeId) ?? [];
      list.push(p);
      byStore.set(p.storeId, list);
    }
    return (stores.data ?? [])
      .filter((s) => s.id !== myStore.data?.id)
      .map((s) => {
        const list = byStore.get(s.id) ?? [];
        const best = Math.max(0, ...list.map((p) => clampCommission(p.commission)));
        const req = mine.data?.find((a) => a.storeId === s.id);
        const status: AffiliateStatus | "open" | "none" =
          req?.status ?? (s.requireApproval ? "none" : "open");
        return { s, best, count: list.length, status, req };
      })
      .sort((a, b) => rank(a.status) - rank(b.status) || b.best - a.best);
  }, [stores.data, products.data, mine.data, myStore.data]);

  if (stores.isPending) return <div className="h-40 animate-pulse rounded-2xl bg-slate-200" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <i className="fa-solid fa-handshake text-emerald-600" /> Empresas y solicitudes
          </h3>
          <p className="text-xs text-slate-500">
            Las tiendas abiertas te pagan desde el primer clic. Las demás aprueban a sus afiliados.
          </p>
        </div>
      </div>
      <ul className="space-y-3">
        {rows.map(({ s, best, count, status }) => {
          const canPromote = status === "approved" || status === "open";
          const expanded = open === s.id && canPromote;
          return (
            <li key={s.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3">
                <button
                  type="button"
                  disabled={!canPromote}
                  onClick={() => setOpen(expanded ? null : s.id)}
                  aria-expanded={expanded}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-sm font-black text-indigo-700">
                    {s.emoji || initials(s.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 text-sm font-bold text-slate-900">
                      <span className="truncate">{s.name}</span>
                      {s.verified && (
                        <BadgeCheck
                          className="size-4 shrink-0 text-sky-500"
                          aria-label="Verificada"
                        />
                      )}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      {count} productos · comisión hasta{" "}
                      <b className="text-emerald-600">{Math.round(best * 100)}%</b>
                    </span>
                  </span>
                </button>
                <div className="flex items-center gap-2">
                  {status === "none" ? <RequestButton store={s} /> : <Pill status={status} />}
                  {canPromote && (
                    <button
                      onClick={() => setOpen(expanded ? null : s.id)}
                      aria-label={expanded ? "Ocultar herramientas" : "Ver herramientas"}
                      className="grid size-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
                    >
                      <ChevronDown className={cn("size-4 transition", expanded && "rotate-180")} />
                    </button>
                  )}
                </div>
              </div>
              {expanded && (
                <div className="border-t border-slate-200 bg-slate-50 p-3">
                  <AffiliateTools username={username} storeSlug={s.slug} />
                  <Link
                    to="/tienda/$slug"
                    params={{ slug: s.slug }}
                    className="mt-2 inline-block text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    Ver catálogo de {s.name} →
                  </Link>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const rank = (s: string) =>
  s === "approved" ? 0 : s === "open" ? 1 : s === "pending" ? 2 : s === "none" ? 3 : 4;

function Pill({ status }: { status: keyof typeof STATE }) {
  const st = STATE[status];
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold",
        st.cls,
      )}
    >
      <i className={cn("fa-solid", st.icon)} /> {st.text}
    </span>
  );
}

function RequestButton({ store }: { store: Store }) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => backend.requestAffiliation(store.slug),
    onSuccess: (s) => {
      toast.success(
        s === "approved"
          ? `¡Ya puedes promocionar ${store.name}!`
          : "Solicitud enviada a la tienda",
      );
      qc.invalidateQueries({ queryKey: affKeys.mine });
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <button
      onClick={() => m.mutate()}
      disabled={m.isPending}
      className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
    >
      {m.isPending ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <i className="fa-solid fa-plus" />
      )}{" "}
      Solicitar afiliación
    </button>
  );
}

/** Panel de la tienda: solicitudes de afiliados (aprobar / rechazar). */
export function AffiliateRequests({ store }: { store: Store }) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: affKeys.store,
    queryFn: () => backend.storeAffiliateRequests(),
  });
  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      backend.decideAffiliation(id, approve),
    onSuccess: (_d, v) => {
      toast.success(v.approve ? "Afiliado aprobado" : "Solicitud rechazada");
      qc.invalidateQueries({ queryKey: affKeys.store });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <p
        className={cn(
          "rounded-xl border p-3 text-xs",
          store.requireApproval
            ? "border-indigo-200 bg-indigo-50 text-indigo-900"
            : "border-emerald-200 bg-emerald-50 text-emerald-900",
        )}
      >
        {store.requireApproval ? (
          <>
            <b>Aprobación activa:</b> solo cobran comisión los afiliados que apruebes. Las ventas de
            afiliados no aprobados quedan completas para tu tienda.
          </>
        ) : (
          <>
            <b>Tienda abierta:</b> cualquier afiliado puede promocionarte. Puedes exigir aprobación
            en la pestaña Tienda.
          </>
        )}
      </p>
      {list.isPending ? (
        <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
      ) : list.data?.length ? (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {list.data.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">
                  {r.fullName || "Afiliado"}{" "}
                  {r.username && <span className="font-normal text-slate-500">@{r.username}</span>}
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(r.createdAt).toLocaleDateString("es-CO", { dateStyle: "medium" })} ·{" "}
                  {r.sales} ventas para tu tienda
                </p>
                {r.message && <p className="mt-1 text-xs text-slate-700 italic">“{r.message}”</p>}
              </div>
              {r.status === "pending" ? (
                <div className="flex gap-2">
                  <button
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ id: r.id, approve: true })}
                    className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    Aprobar
                  </button>
                  <button
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ id: r.id, approve: false })}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Rechazar
                  </button>
                </div>
              ) : (
                <Pill status={r.status} />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          Aún no hay solicitudes de afiliados.
        </p>
      )}
    </div>
  );
}

/** Barra de verificación de la tienda (la otorga la administración). */
export function VerificationBar({ store }: { store: Store }) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => backend.requestVerification(),
    onSuccess: () => {
      toast.success("Solicitud enviada. Te escribiremos para validar tus datos.");
      qc.invalidateQueries({ queryKey: keys.myStore });
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs shadow-sm">
      <span className="font-semibold text-slate-500">Estado:</span>
      {store.verified ? (
        <span className="flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-100 px-3 py-1 font-extrabold text-sky-700">
          <BadgeCheck className="size-3.5" /> Verificada
        </span>
      ) : store.verificationRequestedAt ? (
        <span className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-extrabold text-amber-700">
          <i className="fa-solid fa-hourglass-half" /> Verificación en revisión
        </span>
      ) : (
        <>
          <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 font-extrabold text-slate-600">
            Sin verificar
          </span>
          <button
            onClick={() => m.mutate()}
            disabled={m.isPending}
            className="font-bold text-indigo-600 hover:underline"
          >
            Solicitar verificación
          </button>
          <span className="text-slate-400">
            · La insignia azul genera más confianza y más afiliados.
          </span>
        </>
      )}
      <span className="ms-auto text-slate-500">
        {store.shipsNational ? "🚚 Envíos nacionales" : "📍 Cobertura local"} ·{" "}
        {store.requireApproval ? "Afiliados con aprobación" : "Abierta a afiliados"}
      </span>
    </div>
  );
}
