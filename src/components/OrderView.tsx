import { Check } from "lucide-react";
import type { Order, OrderItem } from "@/lib/backend";
import { cop, FULFILLMENT_LABEL } from "@/lib/plaza";
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

export function FulfillmentSteps({ value }: { value: OrderItem["fulfillment"] }) {
  if (value === "cancelled")
    return <span className="text-xs font-semibold text-destructive">Cancelado por la tienda</span>;
  const at = STEPS.indexOf(value);
  return (
    <ol className="flex items-center gap-1 text-[11px] font-semibold">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-1">
          <span
            className={cn(
              "grid size-4 place-items-center rounded-full",
              i <= at ? "bg-ink text-ink-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {i < at ? <Check className="size-2.5" /> : i + 1}
          </span>
          <span className={i <= at ? "" : "text-muted-foreground"}>{FULFILLMENT_LABEL[s]}</span>
          {i < STEPS.length - 1 && <span className="mx-0.5 h-px w-3 bg-border" />}
        </li>
      ))}
    </ol>
  );
}

export function OrderCard({ order }: { order: Order }) {
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
              {i.tracking && (
                <div className="mt-0.5 text-xs text-muted-foreground">Guía: {i.tracking}</div>
              )}
            </div>
            <span className="text-sm">{cop(i.subtotal)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
