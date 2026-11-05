import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Package } from "@/components/icons";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DisputeCard, DisputeDialog, disputeKeys } from "@/components/Disputes";
import { OrderCard } from "@/components/OrderView";
import { Empty, Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { backend, type AccountType, type Profile } from "@/lib/backend";
import { ROLES } from "@/lib/roles";
import { cn } from "@/lib/utils";
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
          <AccountType user={user} />
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
          <i className="fa-solid fa-triangle-exclamation text-amber-400" /> Reportar trato externo
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

/** Cómo usa Plaza X: se puede cambiar cuando quiera (solo comprar, vender, recomendar). */
function AccountType({ user }: { user: Profile }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const change = useMutation({
    mutationFn: (t: AccountType) => backend.updateProfile({ accountType: t }),
    onSuccess: (p) => {
      qc.setQueryData(keys.me, p);
      const role = ROLES.find((r) => r.id === p.accountType)!;
      toast.success(`Listo: ahora usas Plaza X como ${role.label.toLowerCase()}`);
      if (role.home) navigate({ to: role.home });
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div id="tipo" className="scroll-mt-32 space-y-2 border-t border-slate-800 pt-4">
      <h3 className="text-sm font-bold">¿Cómo usas Plaza X?</h3>
      <p className="text-xs text-muted-foreground">
        Cambia cuando quieras. Para vender no necesitas ser empresa.
      </p>
      <div role="radiogroup" aria-label="Tipo de cuenta" className="grid gap-2">
        {ROLES.map((r) => {
          const on = user.accountType === r.id;
          return (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={change.isPending}
              onClick={() => !on && change.mutate(r.id)}
              className={cn(
                "flex min-h-0 items-center gap-3 rounded-xl border p-2.5 text-left text-xs transition",
                on
                  ? "border-amber-400 bg-amber-500/10"
                  : "border-slate-800 bg-slate-950 hover:border-amber-500/50",
              )}
            >
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-lg",
                  on ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-amber-400",
                )}
              >
                <i className={cn("fa-solid", r.icon)} aria-hidden />
              </span>
              <span className="flex-1">
                <b className="block text-[13px] text-white">{r.label}</b>
                <span className="text-slate-400">{r.short}</span>
              </span>
              {on && <i className="fa-solid fa-circle-check text-amber-400" aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
