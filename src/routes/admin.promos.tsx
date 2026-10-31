import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AdminGate } from "@/components/admin/AdminGate";
import { countdown } from "@/components/FlashSaleBanner";
import { backend, type Coupon, type CouponInput, type FlashSaleInput } from "@/lib/backend";
import { cop, PLATFORM_RATE } from "@/lib/plaza";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/promos")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Ventas flash y cupones · Plaza X" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <AdminGate path="/admin/promos">
      <Promos />
    </AdminGate>
  ),
});

const K = { coupons: ["user", "coupons"] as const, flash: ["user", "flash"] as const };
const field =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none";
const pad = (n: number) => String(n).padStart(2, "0");
function toLocal(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);
const fmt = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });

function Promos() {
  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-extrabold text-slate-900">Ventas flash y cupones</h1>
        <p className="max-w-3xl text-sm text-slate-500">
          Todo es real: la cuenta regresiva usa la fecha de fin que pongas y solo se muestra
          mientras la venta está vigente; los cupones existen solo si los creas aquí. El descuento
          de un cupón lo asume Plaza X y nunca supera su comisión ({Math.round(PLATFORM_RATE * 100)}
          % menos el descuento por volumen), así que tiendas y afiliados cobran lo mismo.
        </p>
      </header>
      <FlashSales />
      <Coupons />
    </div>
  );
}

function FlashSales() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: K.flash, queryFn: () => backend.listFlashSales() });
  const inTwoHours = new Date(Date.now() + 2 * 3600_000).toISOString();
  const blank: FlashSaleInput = {
    title: "",
    subtitle: "",
    couponCode: null,
    link: null,
    startsAt: new Date().toISOString(),
    endsAt: inTwoHours,
    active: true,
  };
  const [f, setF] = useState<FlashSaleInput>(blank);
  const save = useMutation({
    mutationFn: () => backend.saveFlashSale(f),
    onSuccess: () => {
      toast.success(f.id ? "Venta flash actualizada" : "Venta flash programada");
      setF(blank);
      qc.invalidateQueries({ queryKey: K.flash });
      qc.invalidateQueries({ queryKey: ["catalog", "flash"] });
    },
    onError: (e) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => backend.deleteFlashSale(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: K.flash });
      qc.invalidateQueries({ queryKey: ["catalog", "flash"] });
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };
  const now = Date.now();

  return (
    <section className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <form
        onSubmit={submit}
        className="h-fit space-y-3 rounded-2xl border border-slate-200 bg-white p-5"
      >
        <h2 className="flex items-center gap-2 font-bold text-slate-900">
          <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-black text-white">
            <i className="fa-solid fa-bolt" /> FLASH
          </span>
          {f.id ? "Editar venta flash" : "Nueva venta flash"}
        </h2>
        <input
          required
          minLength={3}
          maxLength={80}
          placeholder="Título (ej.: Descuentos en artesanías)"
          value={f.title}
          onChange={(e) => setF({ ...f, title: e.target.value })}
          className={field}
        />
        <input
          maxLength={160}
          placeholder="Texto corto (opcional)"
          value={f.subtitle}
          onChange={(e) => setF({ ...f, subtitle: e.target.value })}
          className={field}
        />
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label>
            Inicio
            <input
              type="datetime-local"
              required
              value={toLocal(f.startsAt)}
              onChange={(e) => setF({ ...f, startsAt: fromLocal(e.target.value) ?? f.startsAt })}
              className={field}
            />
          </label>
          <label>
            Fin (cuenta regresiva)
            <input
              type="datetime-local"
              required
              value={toLocal(f.endsAt)}
              onChange={(e) => setF({ ...f, endsAt: fromLocal(e.target.value) ?? f.endsAt })}
              className={field}
            />
          </label>
        </div>
        <input
          maxLength={20}
          placeholder="Cupón asociado (opcional, ej.: FLASH10)"
          value={f.couponCode ?? ""}
          onChange={(e) => setF({ ...f, couponCode: e.target.value.toUpperCase() || null })}
          className={cn(field, "font-mono uppercase")}
        />
        <input
          placeholder="Enlace (opcional: /tienda/… o https://…)"
          value={f.link ?? ""}
          onChange={(e) => setF({ ...f, link: e.target.value || null })}
          pattern="(/.*|https://.*)"
          className={field}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={f.active}
            onChange={(e) => setF({ ...f, active: e.target.checked })}
          />{" "}
          Activa
        </label>
        <div className="flex gap-2">
          <button
            disabled={save.isPending}
            className="flex-1 rounded-xl bg-indigo-600 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
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
          list.data.map((x) => {
            const live = x.active && Date.parse(x.startsAt) <= now && Date.parse(x.endsAt) > now;
            const state = !x.active
              ? "Pausada"
              : Date.parse(x.endsAt) <= now
                ? "Terminada"
                : Date.parse(x.startsAt) > now
                  ? "Programada"
                  : "En vivo";
            return (
              <div
                key={x.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div>
                  <p className="font-bold text-slate-900">
                    {x.title}{" "}
                    <span
                      className={cn(
                        "ms-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
                        live ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600",
                      )}
                    >
                      {state}
                      {live && ` · ${countdown(Date.parse(x.endsAt) - now)}`}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {fmt(x.startsAt)} → {fmt(x.endsAt)}
                    {x.couponCode && ` · cupón ${x.couponCode}`}
                  </p>
                </div>
                <div className="flex gap-2 text-xs font-bold">
                  <button
                    onClick={() => setF({ ...x })}
                    className="rounded-lg border border-slate-300 px-3 py-1.5"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => del.mutate(x.id)}
                    aria-label="Eliminar"
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-rose-600"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            Sin ventas flash. El banner con cuenta regresiva solo aparece cuando programes una.
          </p>
        )}
      </div>
    </section>
  );
}

function Coupons() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: K.coupons, queryFn: () => backend.listCoupons() });
  const blank: CouponInput = {
    code: "",
    description: "",
    kind: "percent",
    value: 5,
    minSubtotal: 0,
    maxUses: null,
    startsAt: new Date().toISOString(),
    endsAt: null,
    active: true,
  };
  const [c, setC] = useState<CouponInput>(blank);
  const save = useMutation({
    mutationFn: (input: CouponInput) => backend.saveCoupon(input),
    onSuccess: () => {
      toast.success("Cupón guardado");
      setC(blank);
      qc.invalidateQueries({ queryKey: K.coupons });
    },
    onError: (e) => toast.error(e.message),
  });
  const edit = ({ id, uses: _u, createdAt: _c, ...rest }: Coupon) => setC({ ...rest, id });
  const maxPct = Math.round(PLATFORM_RATE * 100);

  return (
    <section className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(c);
        }}
        className="h-fit space-y-3 rounded-2xl border border-slate-200 bg-white p-5"
      >
        <h2 className="font-bold text-slate-900">
          <i className="fa-solid fa-ticket text-amber-500" />{" "}
          {c.id ? "Editar cupón" : "Nuevo cupón"}
        </h2>
        <input
          required
          pattern="[A-Za-z0-9-]{3,20}"
          maxLength={20}
          placeholder="CÓDIGO (ej.: BIENVENIDA)"
          value={c.code}
          onChange={(e) => setC({ ...c, code: e.target.value.toUpperCase() })}
          className={cn(field, "font-mono uppercase")}
        />
        <input
          maxLength={120}
          placeholder="Descripción para el comprador"
          value={c.description}
          onChange={(e) => setC({ ...c, description: e.target.value })}
          className={field}
        />
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label>
            Tipo
            <select
              value={c.kind}
              onChange={(e) => setC({ ...c, kind: e.target.value as CouponInput["kind"] })}
              className={field}
            >
              <option value="percent">Porcentaje</option>
              <option value="fixed">Valor fijo (COP)</option>
            </select>
          </label>
          <label>
            {c.kind === "percent" ? `% (recomendado ≤ ${maxPct})` : "Valor en pesos"}
            <input
              type="number"
              required
              min={1}
              max={c.kind === "percent" ? maxPct : undefined}
              value={c.value}
              onChange={(e) => setC({ ...c, value: Number(e.target.value) })}
              className={field}
            />
          </label>
          <label>
            Compra mínima
            <input
              type="number"
              min={0}
              step={1000}
              value={c.minSubtotal}
              onChange={(e) => setC({ ...c, minSubtotal: Number(e.target.value) })}
              className={field}
            />
          </label>
          <label>
            Usos máximos
            <input
              type="number"
              min={1}
              placeholder="Sin límite"
              value={c.maxUses ?? ""}
              onChange={(e) =>
                setC({ ...c, maxUses: e.target.value ? Number(e.target.value) : null })
              }
              className={field}
            />
          </label>
          <label>
            Inicio
            <input
              type="datetime-local"
              value={toLocal(c.startsAt)}
              onChange={(e) => setC({ ...c, startsAt: fromLocal(e.target.value) ?? c.startsAt })}
              className={field}
            />
          </label>
          <label>
            Vence (opcional)
            <input
              type="datetime-local"
              value={toLocal(c.endsAt)}
              onChange={(e) => setC({ ...c, endsAt: fromLocal(e.target.value) })}
              className={field}
            />
          </label>
        </div>
        <p className="text-[11px] text-slate-500">
          Una vez por persona. Si el descuento supera lo que Plaza X puede asumir en un pedido, el
          carrito muestra el valor real aplicado antes de pagar.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={c.active}
            onChange={(e) => setC({ ...c, active: e.target.checked })}
          />{" "}
          Activo
        </label>
        <div className="flex gap-2">
          <button
            disabled={save.isPending}
            className="flex-1 rounded-xl bg-indigo-600 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            Guardar cupón
          </button>
          {c.id && (
            <button
              type="button"
              onClick={() => setC(blank)}
              className="rounded-xl border px-3 text-sm"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="p-3">Código</th>
              <th>Descuento</th>
              <th>Mínimo</th>
              <th>Usos</th>
              <th>Vigencia</th>
              <th className="pr-3 text-right" />
            </tr>
          </thead>
          <tbody>
            {list.data?.map((x) => (
              <tr key={x.id} className={cn("border-t", !x.active && "text-slate-400")}>
                <td className="p-3 font-mono font-bold">{x.code}</td>
                <td>{x.kind === "percent" ? `${x.value}%` : cop(x.value)}</td>
                <td>{x.minSubtotal ? cop(x.minSubtotal) : "—"}</td>
                <td>
                  {x.uses}
                  {x.maxUses ? ` / ${x.maxUses}` : ""}
                </td>
                <td className="text-xs">
                  {!x.active ? "Pausado" : x.endsAt ? `hasta ${fmt(x.endsAt)}` : "Sin vencimiento"}
                </td>
                <td className="pr-3 text-right text-xs font-bold">
                  <button onClick={() => edit(x)} className="me-2 text-indigo-600">
                    Editar
                  </button>
                  <button
                    onClick={() => {
                      const { id, uses: _u, createdAt: _c, ...rest } = x;
                      save.mutate({ ...rest, id, active: !x.active });
                    }}
                    className="text-slate-600"
                  >
                    {x.active ? "Pausar" : "Activar"}
                  </button>
                </td>
              </tr>
            ))}
            {!list.data?.length && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-500">
                  Sin cupones. Los compradores solo pueden usar los que crees aquí.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
