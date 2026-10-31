import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AdminGate } from "@/components/admin/AdminGate";
import { backend, type AdminStore } from "@/lib/backend";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/tiendas")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Tiendas · Plaza X" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <AdminGate path="/admin/tiendas">
      <Stores />
    </AdminGate>
  ),
});

const KEY = ["user", "admin-stores"] as const;

function Stores() {
  const [q, setQ] = useState("");
  const list = useQuery({ queryKey: KEY, queryFn: () => backend.adminStores() });
  const rows = (list.data ?? []).filter((s) =>
    `${s.name} ${s.slug} ${s.ownerEmail} ${s.city}`.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const requested = list.data?.filter((s) => s.verificationRequestedAt && !s.verified).length ?? 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Tiendas y verificación</h1>
          <p className="max-w-2xl text-sm text-slate-500">
            Verifica solo empresas cuya identidad y datos comerciales (RUT, cámara de comercio o
            cédula) hayas validado. La insignia azul aparece en el catálogo y el leaderboard.
            {requested > 0 && (
              <b className="ms-1 text-amber-700">{requested} solicitudes pendientes.</b>
            )}
          </p>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar tienda, ciudad o correo"
          aria-label="Buscar"
          className="w-64 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:border-indigo-600 focus:outline-none"
        />
      </header>
      {list.isPending ? (
        <div className="h-40 animate-pulse rounded-2xl bg-slate-200" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="p-3">Tienda</th>
                <th>Dueño</th>
                <th>Productos</th>
                <th>Vendidos</th>
                <th>Disputas</th>
                <th className="pr-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <Row key={s.id} s={s} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({ s }: { s: AdminStore }) {
  const qc = useQueryClient();
  const done = (msg: string) => () => {
    toast.success(msg);
    qc.invalidateQueries({ queryKey: KEY });
    qc.invalidateQueries({ queryKey: ["catalog"] });
  };
  const verify = useMutation({
    mutationFn: (v: boolean) => backend.setStoreVerified(s.id, v),
    onSuccess: done(s.verified ? "Verificación retirada" : "Tienda verificada"),
    onError: (e) => toast.error(e.message),
  });
  const active = useMutation({
    mutationFn: (v: boolean) => backend.setStoreActive(s.id, v),
    onSuccess: done(s.active ? "Tienda pausada" : "Tienda activa"),
    onError: (e) => toast.error(e.message),
  });
  const ban = useMutation({
    mutationFn: (v: boolean) => backend.setUserBanned(s.ownerId, v, "Suspensión administrativa"),
    onSuccess: done(s.ownerBanned ? "Suspensión levantada" : "Cuenta suspendida"),
    onError: (e) => toast.error(e.message),
  });
  const busy = verify.isPending || active.isPending || ban.isPending;
  return (
    <tr className={cn("border-t border-slate-100", !s.active && "bg-slate-50 text-slate-500")}>
      <td className="p-3">
        <Link
          to="/tienda/$slug"
          params={{ slug: s.slug }}
          className="flex items-center gap-2 font-semibold text-slate-900 hover:text-indigo-600"
        >
          <span className="text-xl">{s.emoji}</span> {s.name}
          {s.verified && <BadgeCheck className="size-4 text-sky-500" aria-label="Verificada" />}
        </Link>
        <span className="text-xs text-slate-500">
          {s.city}
          {!s.active && " · inactiva"}
          {s.verificationRequestedAt && !s.verified && (
            <b className="ms-1 text-amber-700">· pidió verificación</b>
          )}
        </span>
      </td>
      <td className="text-xs">
        {s.ownerEmail}
        {s.ownerBanned && <b className="block text-rose-600">Suspendido</b>}
      </td>
      <td>{s.products}</td>
      <td>{s.sold}</td>
      <td>
        {s.openDisputes > 0 ? (
          <Link to="/admin/disputas" className="font-bold text-amber-700">
            {s.openDisputes} abiertas
          </Link>
        ) : (
          "—"
        )}
      </td>
      <td className="pr-3">
        <div className="flex flex-wrap justify-end gap-1.5 text-xs font-bold">
          <button
            disabled={busy}
            onClick={() => verify.mutate(!s.verified)}
            className={cn(
              "rounded-lg px-2.5 py-1",
              s.verified
                ? "border border-slate-300 bg-white text-slate-700"
                : "bg-sky-600 text-white hover:bg-sky-700",
            )}
          >
            {s.verified ? "Quitar insignia" : "Verificar"}
          </button>
          {!s.ownerBanned && (
            <button
              disabled={busy}
              onClick={() => active.mutate(!s.active)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-slate-700"
            >
              {s.active ? "Pausar" : "Activar"}
            </button>
          )}
          <button
            disabled={busy}
            onClick={() =>
              (s.ownerBanned || confirm(`¿Suspender la cuenta de ${s.ownerEmail}?`)) &&
              ban.mutate(!s.ownerBanned)
            }
            className={cn(
              "rounded-lg px-2.5 py-1",
              s.ownerBanned
                ? "border border-slate-300 bg-white text-slate-700"
                : "bg-rose-50 text-rose-700 hover:bg-rose-100",
            )}
          >
            {s.ownerBanned ? "Levantar suspensión" : "Suspender"}
          </button>
        </div>
      </td>
    </tr>
  );
}
