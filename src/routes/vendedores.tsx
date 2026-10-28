import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CreditCard,
  ExternalLink,
  LineChart,
  Package,
  Pencil,
  Percent,
  Plus,
  Trash2,
  Truck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FulfillmentSteps } from "@/components/OrderView";
import { ProductDialog, SplitPreview, StoreForm } from "@/components/panels/seller-forms";
import { TrendChart } from "@/components/panels/TrendChart";
import { WalletPanel } from "@/components/panels/Wallet";
import { Empty, ProductImage, Shell, Stat } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { backend, type Fulfillment, type Product, type SellerOrderItem } from "@/lib/backend";
import {
  AFFILIATE_MAX,
  AFFILIATE_MIN,
  cop,
  dailySeries,
  FULFILLMENT_LABEL,
  pct,
} from "@/lib/plaza";
import { keys, useUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/vendedores")({
  head: () => ({
    meta: [
      { title: "Mi Tienda — Vende con tu marca en Plaza X" },
      {
        name: "description",
        content:
          "Crea tu tienda, sube productos, fija comisiones para afiliados y cobra en Nequi o Bancolombia.",
      },
      { property: "og:title", content: "Mi Tienda — Vendedores Plaza X" },
      { property: "og:description", content: "Tu tienda en minutos, sin pagos por adelantado." },
    ],
  }),
  component: Sellers,
});

function Sellers() {
  const { user, loading } = useUser();
  const store = useQuery({
    queryKey: keys.myStore,
    queryFn: () => backend.myStore(),
    enabled: !!user,
  });

  if (loading || (user && store.isPending))
    return <Shell>{<div className="h-72 animate-pulse rounded-3xl bg-muted" />}</Shell>;
  if (!user) return <Pitch />;
  if (!store.data)
    return (
      <Shell>
        <div className="mx-auto max-w-xl rounded-3xl border bg-card p-6 shadow-card md:p-8">
          <p className="text-sm font-semibold text-primary">Paso 1 de 2</p>
          <h1 className="mt-1 text-3xl font-extrabold">Abre tu tienda</h1>
          <p className="mb-6 mt-1 text-muted-foreground">
            Gratis y sin pagos por adelantado. Luego subes tus productos.
          </p>
          <StoreForm />
        </div>
      </Shell>
    );
  return <Dashboard />;
}

function Pitch() {
  const [price, setPrice] = useState(100000);
  const [rate, setRate] = useState(10);
  return (
    <Shell>
      <section className="grid gap-8 md:grid-cols-[1.2fr_1fr] md:items-center">
        <div>
          <h1 className="text-4xl font-extrabold md:text-6xl">
            Vende con tu marca.
            <br />
            <span className="text-primary">Te venden otros.</span>
          </h1>
          <p className="mt-4 max-w-lg text-lg text-muted-foreground">
            Publica tus productos y cientos de afiliados los comparten en WhatsApp e Instagram. Solo
            pagas cuando vendes.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            <li className="flex items-center gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary [&_svg]:size-4">
                <CreditCard />
              </span>
              Pagos con tarjeta, PSE y Nequi vía Wompi
            </li>
            <li className="flex items-center gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary [&_svg]:size-4">
                <Percent />
              </span>
              Tú decides la comisión del afiliado (3% a 20%)
            </li>
            <li className="flex items-center gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary [&_svg]:size-4">
                <LineChart />
              </span>
              Panel con ventas, pedidos, stock y retiros a tu cuenta
            </li>
          </ul>
          <Button asChild size="lg" className="mt-6">
            <Link to="/entrar" search={{ to: "/vendedores" }}>
              Abrir mi tienda gratis
            </Link>
          </Button>
        </div>
        <div className="space-y-5 rounded-3xl border bg-card p-6 shadow-card md:p-8">
          <h2 className="text-xl font-bold">¿Cuánto recibes por venta?</h2>
          <label className="block text-sm font-semibold">
            Precio del producto
            <Input
              type="number"
              min={0}
              step={1000}
              value={price}
              onChange={(e) => setPrice(Math.max(0, Number(e.target.value)))}
              className="mt-2 h-11 text-base"
            />
          </label>
          <label className="block text-sm font-semibold">
            Comisión para afiliados: {rate}%
            <input
              type="range"
              min={AFFILIATE_MIN * 100}
              max={AFFILIATE_MAX * 100}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="mt-3 w-full accent-primary"
            />
          </label>
          <SplitPreview price={price} rate={rate / 100} />
          <p className="text-xs text-muted-foreground">
            Fondos liberados 7 días después de la entrega confirmada.
          </p>
        </div>
      </section>
    </Shell>
  );
}

function Dashboard() {
  const store = useQuery({ queryKey: keys.myStore, queryFn: () => backend.myStore() }).data!;
  const products = useQuery({ queryKey: keys.myProducts, queryFn: () => backend.myProducts() });
  const orders = useQuery({ queryKey: keys.sellerOrders, queryFn: () => backend.sellerOrders() });
  const toShip =
    orders.data?.filter((o) => o.fulfillment === "pending" || o.fulfillment === "preparing")
      .length ?? 0;

  return (
    <Shell wide>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="grid size-14 place-items-center rounded-2xl bg-secondary text-3xl">
            {store.emoji}
          </div>
          <div>
            <h1 className="text-3xl font-extrabold md:text-4xl">{store.name}</h1>
            <Link
              to="/tienda/$slug"
              params={{ slug: store.slug }}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
            >
              plazax.co/tienda/{store.slug} <ExternalLink className="size-3" />
            </Link>
          </div>
        </div>
      </div>

      <Tabs defaultValue="resumen" className="mt-8">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="productos">Productos ({products.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="pedidos">
            Pedidos{" "}
            {toShip > 0 && (
              <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">
                {toShip}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="billetera">Billetera</TabsTrigger>
          <TabsTrigger value="tienda">Tienda</TabsTrigger>
        </TabsList>
        <TabsContent value="resumen" className="mt-6">
          <Overview products={products.data ?? []} orders={orders.data ?? []} />
        </TabsContent>
        <TabsContent value="productos" className="mt-6">
          <Products list={products.data} />
        </TabsContent>
        <TabsContent value="pedidos" className="mt-6">
          <Orders list={orders.data} />
        </TabsContent>
        <TabsContent value="billetera" className="mt-6">
          <WalletPanel />
        </TabsContent>
        <TabsContent value="tienda" className="mt-6">
          <div className="max-w-xl rounded-3xl border bg-card p-6 shadow-card">
            <StoreForm store={store} />
          </div>
        </TabsContent>
      </Tabs>
    </Shell>
  );
}

const within = (iso: string | null, days: number) =>
  !!iso && Date.parse(iso) > Date.now() - days * 86_400_000;

function Overview({ products, orders }: { products: Product[]; orders: SellerOrderItem[] }) {
  const stats = useMemo(() => {
    const last = orders.filter((o) => within(o.paidAt, 30) && o.fulfillment !== "cancelled");
    const prev = orders.filter(
      (o) => within(o.paidAt, 60) && !within(o.paidAt, 30) && o.fulfillment !== "cancelled",
    );
    const gross = last.reduce((t, o) => t + o.subtotal, 0);
    const net = last.reduce((t, o) => t + o.sellerAmount, 0);
    const prevNet = prev.reduce((t, o) => t + o.sellerAmount, 0);
    const units = last.reduce((t, o) => t + o.qty, 0);
    const viaAff = last.filter((o) => o.affiliateAmount > 0).length;
    const series = dailySeries(
      last,
      (o) => o.paidAt,
      (o) => o.sellerAmount,
    ).map((d) => ({ label: d.label, ventas: d.value }));
    const byProduct = new Map<string, { name: string; units: number; net: number }>();
    for (const o of last) {
      const k = o.productId ?? o.productName;
      const cur = byProduct.get(k) ?? { name: o.productName, units: 0, net: 0 };
      cur.units += o.qty;
      cur.net += o.sellerAmount;
      byProduct.set(k, cur);
    }
    return {
      gross,
      net,
      growth: prevNet ? (net - prevNet) / prevNet : null,
      units,
      orders: new Set(last.map((o) => o.orderId)).size,
      viaAff: last.length ? viaAff / last.length : 0,
      series,
      top: [...byProduct.values()].sort((a, b) => b.net - a.net).slice(0, 5),
    };
  }, [orders]);
  const lowStock = products.filter((p) => p.active && p.stock <= 3);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat
          tone="ink"
          label="Tus ingresos (30 días)"
          value={cop(stats.net)}
          hint={
            stats.growth === null
              ? "Primer mes"
              : `${stats.growth >= 0 ? "▲" : "▼"} ${pct(Math.abs(stats.growth))} vs. mes anterior`
          }
        />
        <Stat label="Ventas brutas" value={cop(stats.gross)} hint={`${stats.orders} pedidos`} />
        <Stat label="Unidades vendidas" value={stats.units} />
        <Stat
          label="Ventas por afiliados"
          value={pct(stats.viaAff)}
          hint="de tus ventas llegan por tu red"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="rounded-3xl border bg-card p-5 shadow-card">
          <h3 className="font-bold">Ingresos diarios</h3>
          <TrendChart
            data={stats.series}
            series={[{ key: "ventas", label: "Ingresos", color: "var(--primary)" }]}
            money
          />
        </div>
        <div className="space-y-4">
          <div className="rounded-3xl border bg-card p-5 shadow-card">
            <h3 className="mb-3 font-bold">Más vendidos</h3>
            {stats.top.length ? (
              <ol className="space-y-2 text-sm">
                {stats.top.map((t, i) => (
                  <li key={t.name} className="flex items-center gap-3">
                    <span className="grid size-6 place-items-center rounded-full bg-muted text-xs font-bold">
                      {i + 1}
                    </span>
                    <span className="flex-1 truncate">{t.name}</span>
                    <span className="text-muted-foreground">{t.units} u.</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">Tus ventas aparecerán aquí.</p>
            )}
          </div>
          {lowStock.length > 0 && (
            <div className="rounded-3xl border border-sun bg-sun/15 p-5">
              <h3 className="flex items-center gap-2 font-bold">
                <AlertTriangle className="size-4" /> Stock bajo
              </h3>
              <ul className="mt-2 space-y-1 text-sm">
                {lowStock.map((p) => (
                  <li key={p.id} className="flex justify-between">
                    <span className="truncate">{p.name}</span>
                    <b>{p.stock}</b>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Products({ list }: { list: Product[] | undefined }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const del = useMutation({
    mutationFn: (id: string) => backend.deleteProduct(id),
    onSuccess: () => {
      toast.success("Producto eliminado");
      qc.invalidateQueries({ queryKey: keys.myProducts });
      qc.invalidateQueries({ queryKey: ["catalog"] });
    },
    onError: (e) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: (p: Product) => backend.saveProduct({ ...p, active: !p.active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.myProducts });
      qc.invalidateQueries({ queryKey: ["catalog"] });
    },
  });
  const edit = (p: Product | null) => {
    setEditing(p);
    setOpen(true);
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => edit(null)}>
          <Plus /> Nuevo producto
        </Button>
      </div>
      {list?.length ? (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted text-left text-muted-foreground">
              <tr>
                <th className="p-3">Producto</th>
                <th>Precio</th>
                <th>Stock</th>
                <th>Comisión</th>
                <th>Vendidos</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className={cn("border-t", !p.active && "opacity-60")}>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <ProductImage p={p} className="size-11 shrink-0 rounded-lg text-xl" />
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.category}</div>
                      </div>
                    </div>
                  </td>
                  <td>{cop(p.price)}</td>
                  <td className={cn(p.stock <= 3 && "font-bold text-destructive")}>{p.stock}</td>
                  <td>{pct(p.commission)}</td>
                  <td>{p.soldCount}</td>
                  <td>
                    <button
                      onClick={() => toggle.mutate(p)}
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-bold",
                        p.active
                          ? "bg-secondary text-secondary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {p.active ? "Publicado" : "Pausado"}
                    </button>
                  </td>
                  <td className="pr-3 text-right">
                    <Button size="icon" variant="ghost" onClick={() => edit(p)} aria-label="Editar">
                      <Pencil />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Eliminar"
                      onClick={() =>
                        confirm(`¿Eliminar "${p.name}"? Esta acción no se puede deshacer.`) &&
                        del.mutate(p.id)
                      }
                    >
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty icon={<Package />} title="Publica tu primer producto">
          Sube fotos, fija el precio y la comisión. Los afiliados podrán compartirlo al instante.
        </Empty>
      )}
      <ProductDialog product={editing} open={open} onOpenChange={setOpen} />
    </div>
  );
}

const NEXT: Partial<Record<Fulfillment, { to: Fulfillment; label: string }>> = {
  pending: { to: "preparing", label: "Empezar a preparar" },
  preparing: { to: "shipped", label: "Marcar enviado" },
  shipped: { to: "delivered", label: "Confirmar entrega" },
};

function Orders({ list }: { list: SellerOrderItem[] | undefined }) {
  const [filter, setFilter] = useState<"activos" | Fulfillment>("activos");
  if (!list) return <div className="h-40 animate-pulse rounded-2xl bg-muted" />;
  const shown = list.filter((o) =>
    filter === "activos"
      ? ["pending", "preparing", "shipped"].includes(o.fulfillment)
      : o.fulfillment === filter,
  );
  const tabs: ("activos" | Fulfillment)[] = ["activos", "delivered", "cancelled"];

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-semibold",
              filter === t ? "border-ink bg-ink text-ink-foreground" : "bg-card",
            )}
          >
            {t === "activos" ? "Por despachar" : FULFILLMENT_LABEL[t]}
          </button>
        ))}
      </div>
      {shown.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {shown.map((o) => (
            <OrderRow key={o.id} o={o} />
          ))}
        </div>
      ) : (
        <Empty icon={<Truck />} title="Nada por aquí">
          Cuando un pago se apruebe, el pedido aparecerá en esta lista.
        </Empty>
      )}
    </div>
  );
}

function OrderRow({ o }: { o: SellerOrderItem }) {
  const qc = useQueryClient();
  const [tracking, setTracking] = useState(o.tracking ?? "");
  const next = NEXT[o.fulfillment];
  const m = useMutation({
    mutationFn: (to: Fulfillment) => backend.setFulfillment(o.id, to, tracking),
    onSuccess: (_d, to) => {
      toast.success(`Pedido ${o.reference}: ${FULFILLMENT_LABEL[to].toLowerCase()}`);
      qc.invalidateQueries({ queryKey: keys.sellerOrders });
      qc.invalidateQueries({ queryKey: keys.wallet });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-xs text-muted-foreground">
            {o.reference} ·{" "}
            {new Date(o.paidAt ?? o.createdAt).toLocaleDateString("es-CO", {
              day: "numeric",
              month: "short",
            })}
          </div>
          <div className="mt-0.5 font-semibold">
            {o.qty} × {o.productName}
          </div>
        </div>
        <div className="text-right">
          <div className="font-display font-bold">{cop(o.sellerAmount)}</div>
          <div className="text-[11px] text-muted-foreground">
            {o.affiliateAmount > 0 ? `vía afiliado (−${cop(o.affiliateAmount)})` : "venta directa"}
          </div>
        </div>
      </div>
      <div className="mt-3 rounded-xl bg-muted p-3 text-xs">
        <b>{o.shipping.name}</b> · {o.shipping.phone}
        <br />
        {o.shipping.address}, {o.shipping.city}
        {o.shipping.notes && <div className="mt-1 italic">“{o.shipping.notes}”</div>}
      </div>
      <div className="mt-3">
        <FulfillmentSteps value={o.fulfillment} />
      </div>
      {next && (
        <div className="mt-3 flex gap-2">
          {o.fulfillment === "preparing" && (
            <Input
              placeholder="Guía de envío (opcional)"
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              className="h-9"
            />
          )}
          <Button
            size="sm"
            className="shrink-0"
            disabled={m.isPending}
            onClick={() => m.mutate(next.to)}
          >
            {next.label}
          </Button>
          {o.fulfillment === "pending" && (
            <Button
              size="sm"
              variant="ghost"
              disabled={m.isPending}
              onClick={() =>
                confirm("¿Cancelar este ítem? Deberás reembolsar al comprador.") &&
                m.mutate("cancelled")
              }
            >
              Cancelar
            </Button>
          )}
        </div>
      )}
      {o.tracking && o.fulfillment !== "preparing" && (
        <div className="mt-2 text-xs text-muted-foreground">Guía: {o.tracking}</div>
      )}
    </div>
  );
}
