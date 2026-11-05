import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { DisputeDialog } from "@/components/Disputes";
import { useRaffle } from "@/components/Rewards";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { backend, type Product } from "@/lib/backend";
import { cart, useCart } from "@/lib/client-state";
import { trackingUrl } from "@/lib/disputes";
import { isExample } from "@/lib/examples";
import { BUNDLE_MIN, BUNDLE_RATE, bundleDiscount, cop } from "@/lib/plaza";
import { keys, useUser } from "@/lib/session";
import { cartUI } from "@/lib/ui-state";
import { cn } from "@/lib/utils";

export type CartRow = { product: Product; qty: number };

/** Líneas del carrito con precio y stock actuales, y el descuento por volumen. */
export function useCartDetails() {
  const lines = useCart();
  const results = useQueries({
    queries: lines.map((l) => ({
      queryKey: keys.product(l.productId),
      queryFn: () => backend.getProduct(l.productId),
    })),
  });
  const loading = results.some((r) => r.isPending);
  const rows: CartRow[] = [];
  lines.forEach((l, i) => {
    const p = results[i]?.data;
    if (p) rows.push({ product: p, qty: l.qty });
  });
  const count = lines.reduce((t, l) => t + l.qty, 0);
  const subtotal = rows.reduce((t, r) => t + r.product.price * r.qty, 0);
  // Mismo cálculo que create_order() en la base de datos.
  const discount = rows.reduce((t, r) => t + bundleDiscount(r.product.price * r.qty, count), 0);
  return { lines, rows, subtotal, discount, total: subtotal - discount, count, loading };
}

export const openCart = cartUI.open;

export function addToCart(p: Product, qty = 1) {
  if (isExample(p.id))
    return void toast.info("Producto de ejemplo: aún no está a la venta en Plaza X");
  if (p.stock < 1) return void toast.error("Producto agotado");
  cart.add(p.id, qty, p.stock);
  toast.success(`¡"${p.name}" añadido al carrito!`);
}

const STATUS: Record<string, { text: string; cls: string }> = {
  pending: { text: "Por Despachar", cls: "bg-amber-500/20 text-amber-300" },
  preparing: { text: "Por Despachar", cls: "bg-amber-500/20 text-amber-300" },
  shipped: { text: "Enviado", cls: "bg-sky-500/20 text-sky-300" },
  delivered: { text: "Entregado", cls: "bg-emerald-500/20 text-emerald-300" },
  cancelled: { text: "Cancelado", cls: "bg-slate-700 text-slate-200" },
};

/** Carrito y desafío en una sola ventana (diseño Plaza X: "Tu Carrito & Desafío"). */
export function CartSheet() {
  const open = cartUI.use();
  const navigate = useNavigate();
  const { rows, total, count } = useCartDetails();
  const { raffle, open: raffleOpen } = useRaffle();
  const goal = raffleOpen && raffle ? raffle.minUnits : BUNDLE_MIN;
  const pct = Math.min(100, Math.round((count / goal) * 100));

  return (
    <Dialog open={open} onOpenChange={cartUI.set}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-2xl">
        <div className="mb-4 text-center">
          <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-amber-500/20 text-xl text-amber-400">
            <i className="fa-solid fa-gift" />
          </div>
          <DialogTitle className="mb-1 text-base font-bold text-white">
            Tu Carrito & Desafío {goal} Productos
          </DialogTitle>
          <DialogDescription className="sr-only">
            Productos en tu carrito, progreso del desafío y estado de tu último pedido
          </DialogDescription>
          <div className="my-3 rounded-xl border border-slate-800 bg-slate-950 p-3 text-left">
            <div className="mb-1 flex justify-between text-xs font-semibold">
              <span className="text-slate-200">
                {raffleOpen
                  ? "Progreso para el Sorteo del Premio:"
                  : `Progreso para tu ${Math.round(BUNDLE_RATE * 100)}% OFF:`}
              </span>
              <span className="font-bold text-amber-400">
                {Math.min(count, goal)} / {goal} artículos
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            {raffleOpen && raffle && (
              <p className="mt-2 text-[10px] text-slate-400">
                Premio: <b>{raffle.prize}</b> · Sorteo autorizado por Coljuegos No.{" "}
                {raffle.coljuegosAuth}
              </p>
            )}
          </div>
        </div>

        <div className="mb-4 max-h-60 flex-grow space-y-2 overflow-y-auto pr-1">
          {rows.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">Tu carrito está vacío.</p>
          ) : (
            rows.map(({ product: p, qty }) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-2.5"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  {p.images[0] ? (
                    <img
                      src={p.images[0]}
                      alt=""
                      className="size-8 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <span className="grid size-8 shrink-0 place-items-center rounded bg-slate-800">
                      {p.emoji}
                    </span>
                  )}
                  <div className="truncate">
                    <h6 className="truncate text-xs font-bold text-white">
                      {qty > 1 && `${qty} × `}
                      {p.name}
                    </h6>
                    <span className="text-[10px] font-bold text-amber-400">
                      {cop(p.price * qty)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => cart.setQty(p.id, 0)}
                  aria-label={`Quitar ${p.name}`}
                  data-tip={`Quitar ${p.name}`}
                  className="px-2 text-xs text-slate-400 hover:text-red-400"
                >
                  <i className="fa-solid fa-trash-can" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="mb-4 border-t border-slate-800 pt-2">
          <button
            onClick={() => {
              cartUI.close();
              navigate({ to: "/cuenta", hash: "reportes" });
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-800 py-2 text-xs font-bold text-slate-200 transition hover:bg-slate-700"
          >
            <i className="fa-solid fa-shield-cat text-rose-500" /> ¿Tuviste un problema o recibiste
            algo diferente? Abrir Disputa
          </button>
        </div>

        <OrderTracking />

        <div className="mt-auto border-t border-slate-800 pt-4">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs text-slate-400">Total Estimado:</span>
            <span className="text-base font-extrabold text-amber-400">{cop(total)}</span>
          </div>
          <button
            onClick={() => {
              if (!rows.length)
                return void toast.info("Tu carrito está vacío. Agrega al menos un producto.");
              cartUI.close();
              navigate({ to: "/carrito" });
            }}
            className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-2.5 text-xs font-bold text-white shadow transition hover:from-amber-600 hover:to-orange-600"
          >
            Proceder al Pago Seguro (PSE / Carrito)
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Estado del envío y custodia del último pedido pagado (datos reales). */
function OrderTracking() {
  const { user } = useUser();
  const qc = useQueryClient();
  const [dispute, setDispute] = useState(false);
  const orders = useQuery({
    queryKey: keys.myOrders,
    queryFn: () => backend.myOrders(),
    enabled: !!user,
  });
  const item = orders.data
    ?.filter((o) => o.status === "paid")
    .flatMap((o) => o.items)
    .find((i) => i.fulfillment !== "cancelled");
  const confirm = useMutation({
    mutationFn: () => backend.confirmReceipt(item!.id),
    onSuccess: () => {
      toast.success("¡Recepción confirmada con éxito!");
      qc.invalidateQueries({ queryKey: keys.myOrders });
    },
    onError: (e) => toast.error(e.message),
  });
  const st = STATUS[item?.fulfillment ?? "pending"]!;
  const url = item ? trackingUrl(item.carrier, item.tracking) : null;

  return (
    <div className="mb-4 space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs">
      <div className="flex items-center justify-between font-bold text-slate-100">
        <span>Estado del Envío & Custodia</span>
        <span className={cn("rounded px-2 py-0.5 text-[10px]", st.cls)}>{st.text}</span>
      </div>
      {!item ? (
        <p className="text-[11px] text-slate-400 italic">
          Una vez realices el pago y la empresa despache, podrás ver aquí el número de guía,
          transportadora y botón de confirmación.
        </p>
      ) : item.fulfillment === "delivered" ? (
        <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-[11px] text-emerald-300">
          <i className="fa-solid fa-circle-check text-emerald-400" />
          <span>
            ¡Recepción confirmada! {item.productName}: el pago se libera a la empresa y al afiliado
            tras el periodo de garantía.
          </span>
        </div>
      ) : item.fulfillment === "shipped" ? (
        <div className="space-y-2">
          <p className="text-[11px] text-slate-200">
            {item.productName} · Transportadora: <b>{item.carrier ?? "—"}</b>
            {item.tracking && (
              <>
                {" "}
                | Guía: <b className="font-mono">{item.tracking}</b>
              </>
            )}
          </p>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:underline"
            >
              <i className="fa-solid fa-arrow-up-right-from-square" /> Rastrear en {item.carrier} ↗
            </a>
          )}
          <div className="grid grid-cols-2 gap-2 border-t border-slate-800 pt-1">
            <button
              onClick={() => confirm.mutate()}
              disabled={confirm.isPending}
              className="rounded-lg bg-emerald-600 px-2 py-1.5 text-[10px] font-bold text-white transition hover:bg-emerald-700"
            >
              Confirmar Recepción
            </button>
            <button
              onClick={() => setDispute(true)}
              className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[10px] font-bold text-rose-400 transition hover:bg-rose-500/20"
            >
              Reportar Problema
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mb-1 text-[11px] font-semibold text-slate-200">
            Pedido registrado exitosamente.
          </p>
          <p className="text-[10px] text-slate-400">
            Esperando que la empresa vendedora ingrese la transportadora y número de guía.
          </p>
        </>
      )}
      {item && <DisputeDialog open={dispute} onOpenChange={setDispute} item={item} />}
    </div>
  );
}

export function CartLineRow({ row: { product: p, qty } }: { row: CartRow }) {
  const over = qty > p.stock;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
      <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-900 text-2xl">
        {p.images[0] ? (
          <img src={p.images[0]} alt="" className="size-full object-cover" />
        ) : (
          <span aria-hidden>{p.emoji}</span>
        )}
      </span>
      <div className="min-w-0 flex-grow">
        <h4 className="truncate text-xs font-bold text-white">{p.name}</h4>
        <span className="text-xs font-bold text-emerald-400">{cop(p.price * qty)}</span>
        {over && (
          <span className="block text-[10px] font-bold text-red-400">Solo quedan {p.stock}</span>
        )}
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 p-1">
        <button
          onClick={() => cart.setQty(p.id, qty - 1)}
          aria-label="Quitar uno"
          data-tip="Quitar uno"
          className="flex size-5 items-center justify-center text-xs text-slate-400 hover:text-amber-400"
        >
          -
        </button>
        <span className="w-4 text-center text-xs font-bold text-white">{qty}</span>
        <button
          onClick={() => cart.setQty(p.id, qty + 1)}
          disabled={qty >= p.stock}
          aria-label="Agregar uno"
          data-tip="Agregar uno"
          className="flex size-5 items-center justify-center text-xs text-slate-400 hover:text-amber-400 disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}
