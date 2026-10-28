import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { OrderCard } from "@/components/OrderView";
import { Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { backend, IS_DEMO, type Order } from "@/lib/backend";
import { cart } from "@/lib/client-state";
import { cop } from "@/lib/plaza";
import { keys, useRequireUser } from "@/lib/session";

export const Route = createFileRoute("/pedido/$id")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Tu pedido · Plaza X" }, { name: "robots", content: "noindex" }],
  }),
  component: OrderPage,
});

function OrderPage() {
  const { id } = Route.useParams();
  const { user } = useRequireUser(`/pedido/${id}`);
  const qc = useQueryClient();
  const order = useQuery({
    queryKey: keys.order(id),
    queryFn: () => backend.getOrder(id),
    enabled: !!user,
    // Mientras llega la confirmación de Wompi (webhook), se consulta cada 3 s durante ~3 min.
    refetchInterval: (q) =>
      q.state.data?.status === "pending" && !IS_DEMO && q.state.dataUpdateCount < 60 ? 3000 : false,
  });

  const simulate = useMutation({
    mutationFn: (approved: boolean) => backend.simulatePayment!(id, approved),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.order(id) });
      qc.invalidateQueries({ queryKey: ["user"] });
      qc.invalidateQueries({ queryKey: ["catalog"] });
    },
  });

  const retry = useMutation({
    mutationFn: () => backend.startPayment(id, `${window.location.origin}/pedido/${id}`),
    onSuccess: (url) => (url.startsWith("http") ? window.location.assign(url) : undefined),
    onError: (e) => toast.error(e.message),
  });

  if (!user || order.isPending)
    return <Shell>{<div className="h-64 animate-pulse rounded-3xl bg-muted" />}</Shell>;
  const o = order.data;
  if (!o)
    return (
      <Shell>
        <p className="text-center text-muted-foreground">No encontramos este pedido.</p>
      </Shell>
    );

  return (
    <Shell>
      <div className="mx-auto max-w-2xl space-y-6">
        <Hero order={o} />

        {o.status === "pending" && IS_DEMO && (
          <div className="rounded-3xl border-2 border-dashed border-primary bg-card p-6 text-center">
            <div className="text-xs font-bold uppercase tracking-wider text-primary">
              Pasarela simulada (modo demo)
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              En producción aquí se abre el checkout de Wompi. Elige el resultado del pago:
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Button disabled={simulate.isPending} onClick={() => simulate.mutate(true)}>
                {simulate.isPending && <Loader2 className="animate-spin" />} Aprobar {cop(o.total)}
              </Button>
              <Button
                variant="outline"
                disabled={simulate.isPending}
                onClick={() => simulate.mutate(false)}
              >
                Rechazar
              </Button>
            </div>
          </div>
        )}
        {o.status === "pending" && !IS_DEMO && (
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Esperando confirmación de Wompi…
            <Button
              size="sm"
              variant="outline"
              disabled={retry.isPending}
              onClick={() => retry.mutate()}
            >
              Volver a la pasarela
            </Button>
          </div>
        )}
        {o.status === "failed" && (
          <div className="text-center">
            <Button
              onClick={() => {
                o.items.forEach((i) => i.productId && cart.add(i.productId, i.qty));
                toast.success("Productos devueltos al carrito");
              }}
              asChild
            >
              <Link to="/carrito">Intentar de nuevo</Link>
            </Button>
          </div>
        )}

        <OrderCard order={o} />

        <div className="rounded-2xl bg-muted p-4 text-sm">
          <div className="font-semibold">Envío a</div>
          <div className="text-muted-foreground">
            {o.shipping.name} · {o.shipping.phone}
            <br />
            {o.shipping.address}, {o.shipping.city}
            {o.shipping.notes && (
              <>
                <br />
                {o.shipping.notes}
              </>
            )}
          </div>
        </div>
        <div className="flex justify-center gap-3">
          <Button asChild variant="outline">
            <Link to="/cuenta">Mis pedidos</Link>
          </Button>
          <Button asChild>
            <Link to="/">Seguir comprando</Link>
          </Button>
        </div>
      </div>
    </Shell>
  );
}

function Hero({ order }: { order: Order }) {
  const map = {
    paid: {
      icon: <CheckCircle2 className="size-12 text-primary" />,
      title: "¡Pago aprobado!",
      text: "Las tiendas ya recibieron tu pedido y te avisarán cuando lo envíen.",
    },
    pending: {
      icon: <Clock className="size-12 text-sun" />,
      title: "Pedido creado",
      text: "Falta confirmar el pago.",
    },
    failed: {
      icon: <XCircle className="size-12 text-destructive" />,
      title: "El pago no se completó",
      text: "No se hizo ningún cobro. Puedes intentarlo de nuevo.",
    },
    cancelled: {
      icon: <XCircle className="size-12 text-muted-foreground" />,
      title: "Pedido cancelado",
      text: "",
    },
  } as const;
  const m = map[order.status];
  return (
    <div className="flex flex-col items-center text-center">
      {m.icon}
      <h1 className="mt-3 text-3xl font-extrabold">{m.title}</h1>
      <p className="mt-1 text-muted-foreground">{m.text}</p>
      <p className="mt-2 font-mono text-sm">Referencia {order.reference}</p>
    </div>
  );
}
