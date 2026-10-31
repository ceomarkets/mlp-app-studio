import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Package } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DisputeCard, DisputeDialog, disputeKeys } from "@/components/Disputes";
import { OrderCard } from "@/components/OrderView";
import { Empty, Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { backend } from "@/lib/backend";
import { keys, useRequireUser } from "@/lib/session";

export const Route = createFileRoute("/cuenta")({
  head: () => ({
    meta: [{ title: "Mi cuenta · Plaza X" }, { name: "robots", content: "noindex" }],
  }),
  ssr: false,
  component: Account,
});

function Account() {
  const { user } = useRequireUser("/cuenta");
  const qc = useQueryClient();
  const orders = useQuery({
    queryKey: keys.myOrders,
    queryFn: () => backend.myOrders(),
    enabled: !!user,
  });
  const [form, setForm] = useState({ fullName: "", phone: "" });
  useEffect(() => {
    if (user) setForm({ fullName: user.fullName, phone: user.phone ?? "" });
  }, [user]);

  const save = useMutation({
    mutationFn: () =>
      backend.updateProfile({ fullName: form.fullName.trim(), phone: form.phone.trim() || null }),
    onSuccess: (p) => {
      qc.setQueryData(keys.me, p);
      toast.success("Perfil actualizado");
    },
    onError: (e) => toast.error(e.message),
  });

  if (!user) return <Shell>{null}</Shell>;

  return (
    <Shell>
      <h1 className="text-4xl font-extrabold">Mi cuenta</h1>
      <div className="mt-8 grid gap-8 md:grid-cols-[1fr_320px]">
        <section>
          <h2 className="mb-4 text-2xl font-bold">Mis pedidos</h2>
          {orders.isPending ? (
            <div className="h-40 animate-pulse rounded-2xl bg-muted" />
          ) : orders.data?.length ? (
            <div className="space-y-4">
              {orders.data.map((o) => (
                <div key={o.id}>
                  <OrderCard order={o} />
                  <div className="mt-2 flex flex-wrap gap-2 px-1">
                    {o.status === "pending" && (
                      <Button asChild size="sm">
                        <Link to="/pedido/$id" params={{ id: o.id }}>
                          Completar pago
                        </Link>
                      </Button>
                    )}
                    {o.items
                      .filter((i) => i.fulfillment === "delivered" && i.productId)
                      .map((i) => (
                        <Button key={i.id} asChild size="sm" variant="outline">
                          <Link to="/producto/$id" params={{ id: i.productId! }} hash="resenas">
                            ★ Calificar {i.productName}
                          </Link>
                        </Button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty icon={<Package />} title="Aún no tienes pedidos">
              <Link to="/" className="font-semibold text-primary">
                Explora la plaza
              </Link>
            </Empty>
          )}
        </section>

        <MyReports />

        <aside
          id="perfil"
          className="h-fit md:col-start-2 md:row-span-2 md:row-start-1 space-y-4 rounded-3xl border bg-card p-6 shadow-card"
        >
          <h2 className="text-xl font-bold">Perfil</h2>
          <div className="space-y-1.5">
            <Label>Correo</Label>
            <Input value={user.email} disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fn">Nombre</Label>
            <Input
              id="fn"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ph">Celular</Label>
            <Input
              id="ph"
              inputMode="tel"
              placeholder="300 123 4567"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <Button className="w-full" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending && <Loader2 className="animate-spin" />} Guardar
          </Button>
          {user.username && (
            <p className="text-xs text-muted-foreground">
              Tu usuario de afiliado: @{user.username}
            </p>
          )}
        </aside>
      </div>
    </Shell>
  );
}

function MyReports() {
  const [open, setOpen] = useState(false);
  const list = useQuery({ queryKey: disputeKeys.mine, queryFn: () => backend.myDisputes() });
  return (
    <section id="reportes" className="scroll-mt-32 md:col-start-1">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Disputas y reportes</h2>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <i className="fa-solid fa-triangle-exclamation text-amber-600" /> Reportar trato externo
        </Button>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        ¿Un problema con algo que pagaste aquí? Usa <b>Abrir disputa</b> en el artículo de tu
        pedido: congelamos el pago mientras revisamos.
      </p>
      {list.data?.length ? (
        <div className="space-y-4">
          {list.data.map((d) => (
            <DisputeCard key={d.id} d={d} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No tienes reportes.
        </p>
      )}
      <DisputeDialog open={open} onOpenChange={setOpen} />
    </section>
  );
}
