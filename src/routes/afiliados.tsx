import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AtSign,
  Check,
  Link2,
  Loader2,
  MousePointerClick,
  Search,
  Send,
  Wallet,
} from "lucide-react";
import type React from "react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AffiliateTools, LevelCard } from "@/components/panels/AffiliateTools";
import { TrendChart } from "@/components/panels/TrendChart";
import { WalletPanel } from "@/components/panels/Wallet";
import { ShareLink } from "@/components/ShareLink";
import { Empty, ProductCard, ProductGridSkeleton, Shell, Stat } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  backend,
  type Click,
  type OrderItem,
  type Product,
  type ProductFilter,
} from "@/lib/backend";
import {
  affiliateLevel,
  cop,
  dailySeries,
  FULFILLMENT_LABEL,
  HOLD_DAYS,
  MIN_WITHDRAWAL,
  pct,
  REF_WINDOW_DAYS,
  splitSale,
} from "@/lib/plaza";
import { keys, useUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/afiliados")({
  head: () => ({
    meta: [
      { title: "Mi Red — Gana como afiliado en Plaza X" },
      {
        name: "description",
        content:
          "Comparte productos en redes y gana comisión por cada venta, sin comprar ni enviar nada.",
      },
      { property: "og:title", content: "Mi Red — Afiliados Plaza X" },
      { property: "og:description", content: "Gana desde tu celular sin invertir." },
    ],
  }),
  component: Affiliates,
});

function Affiliates() {
  const { user, loading } = useUser();
  if (loading) return <Shell>{<div className="h-72 animate-pulse rounded-3xl bg-muted" />}</Shell>;
  if (!user) return <Pitch />;
  if (!user.username) return <ClaimUsername />;
  return <Dashboard username={user.username} />;
}

function Pitch() {
  const steps: [React.ReactNode, string, string][] = [
    [
      <Link2 key="i" />,
      "Elige productos",
      "Escoge de la vitrina los que más te gusten y genera tu enlace.",
    ],
    [<Send key="i" />, "Comparte", "Por WhatsApp, Instagram, TikTok o con un código QR impreso."],
    [
      <Wallet key="i" />,
      "Cobra",
      `Ganas hasta 20% de cada venta durante ${REF_WINDOW_DAYS} días y retiras a Nequi.`,
    ],
  ];
  return (
    <Shell>
      <section className="text-center">
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold md:text-6xl">
          Gana dinero <span className="text-primary">recomendando</span> lo que te gusta.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Sin comprar inventario, sin hacer envíos. Tú compartes, las tiendas venden y tú cobras.
        </p>
        <Button asChild size="lg" className="mt-6">
          <Link to="/entrar" search={{ to: "/afiliados" }}>
            Quiero ser afiliado
          </Link>
        </Button>
      </section>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {steps.map(([icon, title, text]) => (
          <div key={title} className="rounded-3xl border bg-card p-6 shadow-card">
            <span className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-card [&_svg]:size-6">
              {icon}
            </span>
            <h3 className="mt-3 text-xl font-bold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>
    </Shell>
  );
}

function ClaimUsername() {
  const qc = useQueryClient();
  const { user } = useUser();
  const [name, setName] = useState(() =>
    (user?.fullName.split(" ")[0] ?? "")
      .normalize("NFD")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase(),
  );
  const deferred = useDeferredValue(name);
  const valid = /^[a-z0-9-]{3,30}$/.test(deferred);
  const avail = useQuery({
    queryKey: ["username", deferred],
    queryFn: () => backend.usernameAvailable(deferred),
    enabled: valid,
  });
  const save = useMutation({
    mutationFn: () => backend.updateProfile({ username: name }),
    onSuccess: (p) => {
      qc.setQueryData(keys.me, p);
      toast.success(`¡Listo, @${p.username}! Ya puedes compartir.`);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Shell>
      <div className="mx-auto max-w-lg rounded-3xl border bg-card p-6 text-center shadow-card md:p-8">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-card">
          <AtSign className="size-7" />
        </span>
        <h1 className="mt-3 text-3xl font-extrabold">Elige tu usuario de afiliado</h1>
        <p className="mt-1 text-muted-foreground">Aparecerá en todos tus enlaces.</p>
        <form
          className="mt-6 space-y-3 text-left"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="flex items-center rounded-xl border bg-background pl-4 focus-within:ring-2 focus-within:ring-ring">
            <span className="text-muted-foreground">plazax.co/r/</span>
            <input
              className="h-12 flex-1 bg-transparent pr-3 font-semibold outline-none"
              value={name}
              autoFocus
              onChange={(e) =>
                setName(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, "")
                    .slice(0, 30),
                )
              }
            />
          </div>
          <p className="h-5 text-sm">
            {!valid ? (
              <span className="text-muted-foreground">3 a 30 letras, números o guiones</span>
            ) : avail.isPending ? (
              <span className="text-muted-foreground">Verificando…</span>
            ) : avail.data ? (
              <span className="text-primary">
                <Check className="inline size-4" /> Disponible
              </span>
            ) : (
              <span className="text-destructive">Ya está en uso</span>
            )}
          </p>
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!valid || !avail.data || save.isPending || name !== deferred}
          >
            {save.isPending && <Loader2 className="animate-spin" />} Activar mis enlaces
          </Button>
        </form>
      </div>
    </Shell>
  );
}

function Dashboard({ username }: { username: string }) {
  const clicks = useQuery({ queryKey: keys.clicks, queryFn: () => backend.myClicks() });
  const items = useQuery({ queryKey: keys.affItems, queryFn: () => backend.myAffiliateItems() });
  const wallet = useQuery({ queryKey: keys.wallet, queryFn: () => backend.wallet() });

  return (
    <Shell wide>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold md:text-4xl">Mi Red</h1>
          <p className="text-muted-foreground">
            @{username} · rastreamos {REF_WINDOW_DAYS} días desde cada clic
          </p>
        </div>
        {wallet.data && wallet.data.available >= MIN_WITHDRAWAL && (
          <div className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Tienes {cop(wallet.data.available)} para retirar
          </div>
        )}
      </div>
      <Tabs defaultValue="resumen" className="mt-8">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="vitrina">Vitrina</TabsTrigger>
          <TabsTrigger value="herramientas">Herramientas</TabsTrigger>
          <TabsTrigger value="ventas">Mis ventas</TabsTrigger>
          <TabsTrigger value="billetera">Billetera</TabsTrigger>
        </TabsList>
        <TabsContent value="resumen" className="mt-6">
          <Overview clicks={clicks.data ?? []} items={items.data ?? []} />
        </TabsContent>
        <TabsContent value="vitrina" className="mt-6">
          <Showcase username={username} />
        </TabsContent>
        <TabsContent value="herramientas" className="mt-6">
          <AffiliateTools username={username} />
        </TabsContent>
        <TabsContent value="ventas" className="mt-6">
          <Sales items={items.data} />
        </TabsContent>
        <TabsContent value="billetera" className="mt-6">
          <WalletPanel />
        </TabsContent>
      </Tabs>
    </Shell>
  );
}

const within = (iso: string | null, days: number) =>
  !!iso && Date.parse(iso) > Date.now() - days * 86_400_000;

function Overview({ clicks, items }: { clicks: Click[]; items: OrderItem[] }) {
  const products = useQuery({ queryKey: keys.products({}), queryFn: () => backend.listProducts() });
  const s = useMemo(() => {
    const c30 = clicks.filter((c) => within(c.createdAt, 30));
    const sales = items.filter(
      (i) => i.paidAt && i.fulfillment !== "cancelled" && within(i.paidAt, 30),
    );
    const earned = sales.reduce((t, i) => t + i.affiliateAmount, 0);
    const clickSeries = dailySeries(
      c30,
      (c) => c.createdAt,
      () => 1,
    );
    const saleSeries = dailySeries(
      sales,
      (i) => i.paidAt,
      () => 1,
    );
    const series = clickSeries.map((d, i) => ({
      label: d.label,
      clics: d.value,
      ventas: saleSeries[i]!.value,
    }));
    const per = new Map<string, { clicks: number; sales: number; earned: number }>();
    c30.forEach((c) => {
      if (!c.productId) return;
      const r = per.get(c.productId) ?? { clicks: 0, sales: 0, earned: 0 };
      r.clicks++;
      per.set(c.productId, r);
    });
    sales.forEach((i) => {
      if (!i.productId) return;
      const r = per.get(i.productId) ?? { clicks: 0, sales: 0, earned: 0 };
      r.sales += 1;
      r.earned += i.affiliateAmount;
      per.set(i.productId, r);
    });
    return {
      clicks: c30.length,
      sales: sales.length,
      earned,
      conversion: c30.length ? sales.length / c30.length : 0,
      epc: c30.length ? earned / c30.length : 0,
      series,
      per: [...per.entries()]
        .sort((a, b) => b[1].earned - a[1].earned || b[1].clicks - a[1].clicks)
        .slice(0, 8),
    };
  }, [clicks, items]);
  const name = (id: string) => products.data?.find((p) => p.id === id);

  const level = affiliateLevel(
    items.filter((i) => i.paidAt && i.fulfillment !== "cancelled").length,
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-5">
        <LevelCard level={level} />
        <Stat
          tone="ink"
          label="Comisiones (30 días)"
          value={cop(s.earned)}
          hint={`${s.sales} ventas`}
        />
        <Stat label="Clics (30 días)" value={s.clicks.toLocaleString("es-CO")} />
        <Stat label="Conversión" value={pct(s.conversion)} hint="ventas por cada clic" />
        <Stat label="Ganancia por clic" value={cop(Math.round(s.epc))} hint="promedio" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="rounded-3xl border bg-card p-5 shadow-card">
          <h3 className="font-bold">Clics y ventas por día</h3>
          <TrendChart
            data={s.series}
            series={[
              { key: "clics", label: "Clics", color: "var(--sun)" },
              { key: "ventas", label: "Ventas", color: "var(--ink)" },
            ]}
          />
        </div>
        <div className="rounded-3xl border bg-card p-5 shadow-card">
          <h3 className="mb-3 font-bold">Tus mejores productos</h3>
          {s.per.length ? (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="pb-2">Producto</th>
                  <th>Clics</th>
                  <th>Conv.</th>
                  <th className="text-right">Ganado</th>
                </tr>
              </thead>
              <tbody>
                {s.per.map(([id, r]) => (
                  <tr key={id} className="border-t">
                    <td className="max-w-[140px] truncate py-2">
                      {name(id)?.emoji} {name(id)?.name ?? "Producto"}
                    </td>
                    <td>{r.clicks}</td>
                    <td>{r.clicks ? pct(r.sales / r.clicks) : "—"}</td>
                    <td className="text-right font-semibold">{cop(r.earned)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty icon={<MousePointerClick />} title="Aún sin clics">
              Comparte tu primer enlace desde la Vitrina.
            </Empty>
          )}
        </div>
      </div>
    </div>
  );
}

function Showcase({ username }: { username: string }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<NonNullable<ProductFilter["sort"]>>("commission");
  const filter = { q: useDeferredValue(q), sort };
  const list = useQuery({
    queryKey: keys.products(filter),
    queryFn: () => backend.listProducts(filter),
  });
  // Los productos de la tienda propia no generan comisión: no se muestran.
  const myStore = useQuery({ queryKey: keys.myStore, queryFn: () => backend.myStore() });
  const shown = list.data?.filter((p) => p.storeId !== myStore.data?.id);

  return (
    <div>
      {myStore.data && (
        <p className="mb-3 text-sm text-muted-foreground">
          No mostramos los productos de {myStore.data.name}: las ventas de tu propia tienda ya son
          100% tuyas.
        </p>
      )}
      <div className="mb-5 flex flex-col gap-3 md:flex-row">
        <label className="relative flex-1">
          <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar productos para promocionar…"
            className="h-11 w-full rounded-full border bg-card pl-11 pr-5 outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="h-11 rounded-full border bg-card px-4 text-sm font-semibold"
          aria-label="Ordenar"
        >
          <option value="commission">Mayor comisión</option>
          <option value="popular">Más vendidos</option>
          <option value="price-desc">Mayor precio</option>
          <option value="new">Novedades</option>
        </select>
      </div>
      {list.isPending ? (
        <ProductGridSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {shown?.map((p) => (
            <ShowcaseCard key={p.id} p={p} username={username} />
          ))}
        </div>
      )}
    </div>
  );
}

function ShowcaseCard({ p, username }: { p: Product; username: string }) {
  const earn = splitSale(p.price, p.commission).affiliate;
  return (
    <ProductCard
      p={p}
      action={
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
            <span>
              Ganas <b>{cop(earn)}</b>
            </span>
            <span className="font-bold">{pct(p.commission)}</span>
          </div>
          <ShareLink username={username} product={p} compact />
        </div>
      }
    />
  );
}

function Sales({ items }: { items: OrderItem[] | undefined }) {
  const [now, setNow] = useState(0);
  useEffect(() => setNow(Date.now()), []);
  if (!items) return <div className="h-40 animate-pulse rounded-2xl bg-muted" />;
  const paid = items
    .filter((i) => i.paidAt)
    .sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""));
  if (!paid.length)
    return (
      <Empty title="Aún no tienes ventas">
        Cuando alguien compre con tu enlace, verás aquí tu comisión.
      </Empty>
    );

  const state = (i: OrderItem) => {
    if (i.fulfillment === "cancelled")
      return { label: "Cancelada", cls: "bg-muted text-muted-foreground" };
    if (
      i.fulfillment === "delivered" &&
      i.deliveredAt &&
      Date.parse(i.deliveredAt) <= now - HOLD_DAYS * 86_400_000
    )
      return { label: "Disponible", cls: "bg-secondary text-secondary-foreground" };
    return {
      label: `Retenida · ${FULFILLMENT_LABEL[i.fulfillment].toLowerCase()}`,
      cls: "bg-sun/40 text-accent-foreground",
    };
  };

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-muted text-left text-muted-foreground">
          <tr>
            <th className="p-3">Fecha</th>
            <th>Producto</th>
            <th>Venta</th>
            <th>Tu comisión</th>
            <th className="pr-3 text-right">Estado</th>
          </tr>
        </thead>
        <tbody>
          {paid.map((i) => {
            const st = state(i);
            return (
              <tr key={i.id} className="border-t">
                <td className="p-3">
                  {new Date(i.paidAt!).toLocaleDateString("es-CO", {
                    day: "numeric",
                    month: "short",
                  })}
                </td>
                <td className="max-w-[220px] truncate">
                  {i.productEmoji} {i.qty > 1 && `${i.qty} × `}
                  {i.productName}
                </td>
                <td>{cop(i.subtotal)}</td>
                <td className="font-semibold">{cop(i.affiliateAmount)}</td>
                <td className="pr-3 text-right">
                  <span
                    className={cn(
                      "whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold",
                      st.cls,
                    )}
                  >
                    {st.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
