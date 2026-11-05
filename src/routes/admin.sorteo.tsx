import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "@/components/icons";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AdminGate } from "@/components/admin/AdminGate";
import { backend, type Raffle, type RaffleInput, type RaffleWinner } from "@/lib/backend";
import { BUNDLE_MIN, BUNDLE_RATE, cop } from "@/lib/plaza";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/sorteo")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Sorteo · Plaza X" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <AdminGate path="/admin/sorteo">
      <Raffles />
    </AdminGate>
  ),
});

const KEY = ["user", "raffles"] as const;
const field =
  "w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none";
const pad = (n: number) => String(n).padStart(2, "0");
const toLocal = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fmt = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });

function Raffles() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: KEY, queryFn: () => backend.listRaffles() });
  const blank: RaffleInput = {
    title: "Desafío 5 = Premio",
    prize: "",
    prizeImage: null,
    prizeValue: null,
    coljuegosAuth: null,
    termsUrl: null,
    minUnits: 5,
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    active: false,
  };
  const [f, setF] = useState<RaffleInput>(blank);
  const authorized = !!f.coljuegosAuth?.trim() && !!f.termsUrl?.trim();
  const save = useMutation({
    mutationFn: () => backend.saveRaffle(f),
    onSuccess: () => {
      toast.success(f.active ? "Sorteo publicado" : "Sorteo guardado como borrador");
      setF(blank);
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["catalog", "raffle"] });
    },
    onError: (e) => toast.error(e.message),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold text-white">Sorteo “Desafío = Premio”</h1>
        <p className="max-w-3xl text-sm text-slate-400">
          En Colombia los sorteos promocionales requieren autorización de <b>Coljuegos</b>. El
          sorteo solo se publica cuando registras el número de autorización y las bases. Mientras no
          haya uno publicado, la barra naranja sigue mostrando el descuento real de{" "}
          {Math.round(BUNDLE_RATE * 100)}% desde {BUNDLE_MIN} productos (que también sigue vigente
          durante el sorteo).
        </p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <form
          onSubmit={submit}
          className="h-fit space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-5"
        >
          <h2 className="font-bold text-white">
            <i className="fa-solid fa-gift" /> {f.id ? "Editar sorteo" : "Nuevo sorteo"}
          </h2>
          <input
            required
            minLength={3}
            maxLength={80}
            placeholder="Título"
            value={f.title}
            onChange={(e) => setF({ ...f, title: e.target.value })}
            className={field}
          />
          <input
            required
            minLength={3}
            maxLength={160}
            placeholder="Premio (ej.: Bicicleta de montaña rin 29)"
            value={f.prize}
            onChange={(e) => setF({ ...f, prize: e.target.value })}
            className={field}
          />
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label>
              Valor del premio (COP)
              <input
                type="number"
                min={1}
                value={f.prizeValue ?? ""}
                onChange={(e) =>
                  setF({ ...f, prizeValue: e.target.value ? Number(e.target.value) : null })
                }
                className={field}
              />
            </label>
            <label>
              Productos por compra
              <input
                type="number"
                min={1}
                max={99}
                required
                value={f.minUnits}
                onChange={(e) => setF({ ...f, minUnits: Number(e.target.value) })}
                className={field}
              />
            </label>
            <label>
              Inicio
              <input
                type="datetime-local"
                required
                value={toLocal(f.startsAt)}
                onChange={(e) =>
                  e.target.value && setF({ ...f, startsAt: new Date(e.target.value).toISOString() })
                }
                className={field}
              />
            </label>
            <label>
              Cierre
              <input
                type="datetime-local"
                required
                value={toLocal(f.endsAt)}
                onChange={(e) =>
                  e.target.value && setF({ ...f, endsAt: new Date(e.target.value).toISOString() })
                }
                className={field}
              />
            </label>
          </div>
          <input
            type="url"
            pattern="https://.*"
            placeholder="Imagen del premio (https://…, opcional)"
            value={f.prizeImage ?? ""}
            onChange={(e) => setF({ ...f, prizeImage: e.target.value || null })}
            className={field}
          />
          <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-xs font-bold text-amber-300">
              <i className="fa-solid fa-scale-balanced" /> Requisitos legales para publicar
            </p>
            <input
              maxLength={60}
              placeholder="No. de autorización de Coljuegos"
              value={f.coljuegosAuth ?? ""}
              onChange={(e) => setF({ ...f, coljuegosAuth: e.target.value || null })}
              className={field}
            />
            <input
              placeholder="Bases del sorteo (https://… o /legal…)"
              pattern="(https://.*|/.*)"
              value={f.termsUrl ?? ""}
              onChange={(e) => setF({ ...f, termsUrl: e.target.value || null })}
              className={field}
            />
          </div>
          <label className={cn("flex items-center gap-2 text-sm", !authorized && "text-slate-400")}>
            <input
              type="checkbox"
              disabled={!authorized}
              checked={f.active && authorized}
              onChange={(e) => setF({ ...f, active: e.target.checked })}
            />
            Publicar en la plataforma
            {!authorized && <span className="text-[11px]">(falta autorización y bases)</span>}
          </label>
          <div className="flex gap-2">
            <button
              disabled={save.isPending}
              className="flex-1 rounded-xl bg-amber-500 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-60"
            >
              {save.isPending && <Loader2 className="inline size-4 animate-spin" />} Guardar
            </button>
            {f.id && (
              <button
                type="button"
                onClick={() => setF(blank)}
                className="rounded-xl border px-3 text-sm"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>

        <div className="space-y-3">
          {list.data?.length ? (
            list.data.map((r) => (
              <RaffleRow
                key={r.id}
                r={r}
                onEdit={() => {
                  const { id, entriesCount: _e, drawnAt: _d, ...rest } = r;
                  setF({ ...rest, id });
                }}
              />
            ))
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-6 text-center text-sm text-slate-400">
              Aún no hay sorteos. Créalo como borrador mientras tramitas la autorización.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function RaffleRow({ r, onEdit }: { r: Raffle; onEdit: () => void }) {
  const qc = useQueryClient();
  const [result, setResult] = useState<RaffleWinner | null>(null);
  const winner = useQuery({
    queryKey: ["user", "raffle-winner", r.id],
    queryFn: () => backend.raffleWinner(r.id),
    enabled: !!r.drawnAt,
  });
  const draw = useMutation({
    mutationFn: () => backend.drawRaffle(r.id),
    onSuccess: (w) => {
      setResult(w);
      toast.success("Sorteo realizado");
      qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e) => toast.error(e.message),
  });
  const now = Date.now();
  const state = r.drawnAt
    ? "Realizado"
    : !r.active
      ? "Borrador"
      : Date.parse(r.endsAt) <= now
        ? "Cerrado: listo para sortear"
        : Date.parse(r.startsAt) > now
          ? "Programado"
          : "Publicado";
  const w = result ?? winner.data;
  return (
    <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold text-white">
            {r.prize}{" "}
            <span className="ms-1 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300">
              {state}
            </span>
          </p>
          <p className="text-xs text-slate-400">
            {r.title} · {r.minUnits}+ productos · {fmt(r.startsAt)} → {fmt(r.endsAt)}
            {r.prizeValue ? ` · ${cop(r.prizeValue)}` : ""}
          </p>
          <p className="text-[11px] text-slate-400">
            Coljuegos: {r.coljuegosAuth ?? <b className="text-rose-400">sin autorización</b>}
          </p>
        </div>
        <div className="flex gap-2 text-xs font-bold">
          {!r.drawnAt && (
            <button onClick={onEdit} className="rounded-lg border border-slate-700 px-3 py-1.5">
              Editar
            </button>
          )}
          {r.active && !r.drawnAt && Date.parse(r.endsAt) <= now && (
            <button
              disabled={draw.isPending}
              onClick={() =>
                confirm("¿Realizar el sorteo ahora? No se puede repetir.") && draw.mutate()
              }
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-white hover:bg-amber-600"
            >
              <i className="fa-solid fa-dice" /> Sortear
            </button>
          )}
        </div>
      </div>
      {w && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
          <b>Ganador:</b> pedido {w.orderReference} · {w.winnerEmail}
          {w.winnerName && ` · ${w.winnerName}`}
          {w.winnerPhone && ` · ${w.winnerPhone}`}
          {(w.entries ?? r.entriesCount) && ` · ${w.entries ?? r.entriesCount} participaciones`}
        </p>
      )}
    </div>
  );
}
