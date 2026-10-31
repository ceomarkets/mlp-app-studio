import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AdminGate } from "@/components/admin/AdminGate";
import { DisputeCard, disputeKeys } from "@/components/Disputes";
import { backend, type Dispute } from "@/lib/backend";
import type { DisputeOutcome, DisputeStatus } from "@/lib/disputes";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/disputas")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Disputas · Plaza X" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <AdminGate path="/admin/disputas">
      <Disputes />
    </AdminGate>
  ),
});

const TABS: { id: DisputeStatus | "all"; label: string }[] = [
  { id: "open", label: "Abiertas" },
  { id: "refunded", label: "Reembolsadas" },
  { id: "rejected", label: "Rechazadas" },
  { id: "all", label: "Todas" },
];

function Disputes() {
  const [tab, setTab] = useState<DisputeStatus | "all">("open");
  const list = useQuery({ queryKey: disputeKeys.all, queryFn: () => backend.allDisputes() });
  const shown = (list.data ?? []).filter((d) => tab === "all" || d.status === tab);
  const open = list.data?.filter((d) => d.status === "open").length ?? 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold text-slate-900">Disputas y reportes de fraude</h1>
        <p className="max-w-3xl text-sm text-slate-500">
          Mientras una disputa del carrito está abierta, el pago al vendedor y al afiliado queda
          congelado. <b>Reembolsar</b> cancela el artículo y devuelve el stock: luego haz la
          devolución del dinero desde el panel de la pasarela de pagos. Los tratos externos no se
          reembolsan: solo se suspende la cuenta y se conservan los registros.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 text-xs">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-xl border px-3 py-1.5 font-semibold transition",
              tab === t.id
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
            )}
          >
            {t.label}
            {t.id === "open" && open > 0 && (
              <span className="ms-1.5 rounded-full bg-amber-500 px-1.5 text-white">{open}</span>
            )}
          </button>
        ))}
      </div>

      {list.isPending ? (
        <div className="h-40 animate-pulse rounded-2xl bg-slate-200" />
      ) : shown.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {shown.map((d) => (
            <DisputeCard key={d.id} d={d}>
              <Audit id={d.id} />
              {d.status === "open" && <Resolve d={d} />}
            </DisputeCard>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          Nada por revisar aquí.
        </p>
      )}
    </div>
  );
}

function Audit({ id }: { id: string }) {
  const [show, setShow] = useState(false);
  const audit = useQuery({
    queryKey: ["user", "dispute-audit", id],
    queryFn: () => backend.disputeAudit(id),
    enabled: show,
  });
  if (!show)
    return (
      <button
        onClick={() => setShow(true)}
        className="text-[11px] font-semibold text-slate-500 underline"
      >
        Ver registro para autoridades
      </button>
    );
  const a = audit.data;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">
      {audit.isPending ? (
        <dd>Cargando…</dd>
      ) : a ? (
        <>
          <dt className="font-semibold">Reporta</dt>
          <dd>{a.reporterEmail}</dd>
          <dt className="font-semibold">IP</dt>
          <dd className="font-mono">{a.reporterIp ?? "—"}</dd>
          <dt className="font-semibold">Navegador</dt>
          <dd className="truncate">{a.reporterAgent ?? "—"}</dd>
          <dt className="font-semibold">Fecha</dt>
          <dd>{new Date(a.createdAt).toLocaleString("es-CO")}</dd>
          <dt className="font-semibold">Dueño tienda</dt>
          <dd>
            {a.ownerEmail ?? "—"}
            {a.ownerBannedAt && " (suspendido)"}
          </dd>
          <dd className="col-span-2 mt-1 text-slate-400">
            Entrégalo solo ante solicitud formal de la Fiscalía o un juez (Ley 1581).
          </dd>
        </>
      ) : (
        <dd>Sin registro</dd>
      )}
    </dl>
  );
}

function Resolve({ d }: { d: Dispute }) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [ban, setBan] = useState(false);
  const m = useMutation({
    mutationFn: (outcome: DisputeOutcome) => {
      if (note.trim().length < 5) throw new Error("Escribe la razón de la decisión");
      return backend.resolveDispute(d.id, outcome, note, ban);
    },
    onSuccess: (_r, outcome) => {
      toast.success(
        outcome === "refund"
          ? "Reembolso aprobado. Devuelve el dinero desde la pasarela de pagos."
          : "Disputa cerrada",
      );
      qc.invalidateQueries({ queryKey: disputeKeys.all });
      qc.invalidateQueries({ queryKey: ["catalog"] });
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="space-y-2 border-t border-slate-100 pt-3">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder="Decisión y motivo (lo verán el comprador y la tienda)"
        className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-xs focus:border-indigo-600 focus:outline-none"
      />
      {d.storeId && (
        <label className="flex items-center gap-2 text-xs text-rose-700">
          <input type="checkbox" checked={ban} onChange={(e) => setBan(e.target.checked)} />
          Suspender al vendedor (desactiva su tienda y bloquea retiros)
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {d.kind === "plazax_pay" && (
          <button
            disabled={m.isPending}
            onClick={() => m.mutate("refund")}
            className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {m.isPending && <Loader2 className="inline size-3 animate-spin" />} Reembolsar al
            comprador
          </button>
        )}
        <button
          disabled={m.isPending}
          onClick={() => m.mutate(d.kind === "plazax_pay" ? "reject" : "close")}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {d.kind === "plazax_pay" ? "Rechazar (liberar pago)" : "Cerrar reporte"}
        </button>
      </div>
    </div>
  );
}
