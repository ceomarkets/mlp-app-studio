import { useQuery } from "@tanstack/react-query";
import { BuyerItemActions, disputeKeys, TrackingInfo } from "@/components/Disputes";
import { backend, type Order, type OrderItem } from "@/lib/backend";
import { cop, FULFILLMENT_LABEL, waNumber } from "@/lib/plaza";
import { keys } from "@/lib/session";
import { cn } from "@/lib/utils";

export const ORDER_STATUS: Record<Order["status"], { label: string; cls: string }> = {
  pending: { label: "Pendiente de pago", cls: "bg-sun text-accent-foreground" },
  paid: { label: "Pagado", cls: "bg-secondary text-secondary-foreground" },
  failed: { label: "Pago rechazado", cls: "bg-destructive text-destructive-foreground" },
  cancelled: { label: "Cancelado", cls: "bg-muted text-muted-foreground" },
};

export function StatusPill({ status }: { status: Order["status"] }) {
  const s = ORDER_STATUS[status];
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", s.cls)}>{s.label}</span>
  );
}

const STEPS: OrderItem["fulfillment"][] = ["pending", "preparing", "shipped", "delivered"];

/** Progreso del envío: barra de 4 pasos y el paso actual en palabras (cabe en el celular). */
export function FulfillmentSteps({ value }: { value: OrderItem["fulfillment"] }) {
  if (value === "cancelled")
    return <span className="text-xs font-semibold text-slate-400">Cancelado</span>;
  const at = STEPS.indexOf(value);
  const next = STEPS[at + 1];
  return (
    <div
      className="mt-1.5 max-w-xs"
      aria-label={`Paso ${at + 1} de 4: ${FULFILLMENT_LABEL[value]}`}
    >
      <div className="flex gap-1" aria-hidden>
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={cn("h-1 flex-1 rounded-full", i <= at ? "bg-amber-400" : "bg-slate-700")}
          />
        ))}
      </div>
      <p className="mt-1 text-[11px] text-slate-400">
        <b className="font-semibold text-slate-200">{FULFILLMENT_LABEL[value]}</b>
        {next ? ` · sigue: ${FULFILLMENT_LABEL[next].toLowerCase()}` : " · ¡listo!"}
      </p>
    </div>
  );
}

export function OrderCard({ order }: { order: Order }) {
  // WhatsApp de cada tienda, para escribirle sobre el pedido.
  const stores = useQuery({ queryKey: keys.stores, queryFn: () => backend.listStores() });
  const disputes = useQuery({
    queryKey: disputeKeys.mine,
    queryFn: () => backend.myDisputes(),
    enabled: order.status === "paid",
  });
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-card md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-mono text-sm font-semibold">{order.reference}</div>
          <div className="text-xs text-muted-foreground">
            {new Date(order.createdAt).toLocaleString("es-CO", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill status={order.status} />
          <span className="font-display text-lg font-bold">{cop(order.total)}</span>
        </div>
      </div>
      <ul className="mt-4 space-y-3">
        {order.items.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-3 border-t pt-3">
            <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted text-xl">
              {i.productImage ? (
                <img src={i.productImage} alt="" className="size-full object-cover" />
              ) : (
                i.productEmoji
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">
                {i.qty} × {i.productName}
              </div>
              {order.status === "paid" && <FulfillmentSteps value={i.fulfillment} />}
              <TrackingInfo item={i} />
              {order.status === "paid" && (
                <StoreContact
                  phone={stores.data?.find((s) => s.id === i.storeId)?.whatsapp}
                  text={`Hola, les escribo por mi pedido ${order.reference} (${i.productName}) en Plaza X.`}
                />
              )}
            </div>
            <span className="text-sm">{cop(i.subtotal)}</span>
            {order.status === "paid" && (
              <div className="basis-full pl-13">
                <BuyerItemActions
                  item={i}
                  dispute={disputes.data?.find((d) => d.itemId === i.id)}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StoreContact({ phone, text }: { phone: string | null | undefined; text: string }) {
  const n = waNumber(phone);
  if (!n) return null;
  return (
    <a
      href={`https://wa.me/${n}?text=${encodeURIComponent(text)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-white"
    >
      <i className="fa-brands fa-whatsapp" aria-hidden /> Escribir a la tienda
    </a>
  );
}
