import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AdminGate } from "@/components/admin/AdminGate";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { backend, type AdminOrder, type AdminUser } from "@/lib/backend";
import { cop, FULFILLMENT_LABEL, PAYOUT_METHODS } from "@/lib/plaza";
import { roleOf } from "@/lib/roles";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Administración · Plaza X" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <AdminGate path="/admin">
      <Dashboard />
    </AdminGate>
  ),
});

const K = {
  overview: ["user", "admin", "overview"] as const,
  orders: ["user", "admin", "orders"] as const,
  withdrawals: ["user", "admin", "withdrawals"] as const,
  products: ["user", "admin", "products"] as const,
  users: ["user", "admin", "users"] as const,
};

const date = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "2-digit" });
const field =
  "h-9 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white focus:border-amber-400 focus:outline-none sm:w-64";

function Dashboard() {
  const o = useQuery({ queryKey: K.overview, queryFn: () => backend.adminOverview() });
  const d = o.data;
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold text-white">Panel de administración</h1>
        <p className="text-sm text-slate-400">
          Toda la plaza en un lugar: ventas, pagos a vendedores y afiliados, catálogo y cuentas.
        </p>
      </header>

      <section aria-label="Cifras" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Ventas 30 días"
          value={d ? cop(d.gmv30) : "…"}
          sub={d && `${d.orders30} pedidos pagados`}
        />
        <Kpi
          label="Ingreso Plaza X"
          value={d ? cop(d.platform30) : "…"}
          sub="Comisión neta, 30 días"
          accent
        />
        <Kpi label="Comisiones afiliados" value={d ? cop(d.affiliate30) : "…"} sub="30 días" />
        <Kpi
          label="Retiros por pagar"
          value={d ? cop(d.pendingWithdrawalsAmount) : "…"}
          sub={d && `${d.pendingWithdrawals} solicitudes`}
          alert={!!d?.pendingWithdrawals}
        />
      </section>

      <section aria-label="Pendientes" className="flex flex-wrap gap-2 text-xs">
        <Chip
          to="/admin/disputas"
          icon="fa-shield-halved"
          n={d?.openDisputes}
          label="disputas abiertas"
        />
        <Chip
          to="/admin/tiendas"
          icon="fa-circle-check"
          n={d?.storesToVerify}
          label="tiendas por verificar"
        />
        <Chip icon="fa-box" n={d?.toShip} label="productos por despachar" />
        <Chip icon="fa-store" n={d?.stores} label="tiendas activas" />
        <Chip icon="fa-tag" n={d?.products} label="productos" />
        <Chip icon="fa-user" n={d?.users} label="cuentas" />
        <Chip icon="fa-users" n={d?.affiliates} label="afiliados" />
      </section>

      <Tabs defaultValue="pedidos">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
          <TabsTrigger value="retiros">
            Retiros
            {!!d?.pendingWithdrawals && (
              <span className="ms-1.5 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-slate-950">
                {d.pendingWithdrawals}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="productos">Productos</TabsTrigger>
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
        </TabsList>
        <TabsContent value="pedidos" className="mt-4">
          <Orders />
        </TabsContent>
        <TabsContent value="retiros" className="mt-4">
          <Withdrawals />
        </TabsContent>
        <TabsContent value="productos" className="mt-4">
          <Products />
        </TabsContent>
        <TabsContent value="usuarios" className="mt-4">
          <Users />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  accent,
  alert,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  accent?: boolean;
  alert?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-slate-900 p-4",
        alert ? "border-amber-400/60" : "border-slate-800",
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-extrabold md:text-2xl",
          accent ? "text-amber-400" : "text-white",
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}

function Chip({
  to,
  icon,
  n,
  label,
}: {
  to?: "/admin/disputas" | "/admin/tiendas";
  icon: string;
  n: number | undefined;
  label: string;
}) {
  const body = (
    <>
      <i className={cn("fa-solid", icon)} aria-hidden />
      <b className="text-white">{n ?? "…"}</b> {label}
    </>
  );
  const cls =
    "flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-slate-300";
  return to ? (
    <Link to={to} className={cn(cls, "hover:border-amber-400", n ? "border-amber-400/50" : "")}>
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  );
}

function Table({
  head,
  children,
  min = 720,
}: {
  head: string[];
  children: ReactNode;
  min?: number;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
      <table className="w-full text-xs" style={{ minWidth: min }}>
        <thead className="bg-slate-950 text-left text-slate-400">
          <tr>
            {head.map((h, i) => (
              <th
                key={h}
                className={cn("p-3 font-semibold", i === head.length - 1 && "text-right")}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

const Loading = () => <div className="h-40 animate-pulse rounded-2xl bg-slate-800" />;

function Orders() {
  const q = useQuery({ queryKey: K.orders, queryFn: () => backend.adminOrders() });
  const [s, setS] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);
  if (q.isPending) return <Loading />;
  const rows = (q.data ?? []).filter((o) =>
    `${o.reference} ${o.buyerEmail} ${o.items.map((i) => i.store).join(" ")}`
      .toLowerCase()
      .includes(s.trim().toLowerCase()),
  );
  return (
    <div className="space-y-3">
      <input
        value={s}
        onChange={(e) => setS(e.target.value)}
        placeholder="Buscar referencia, comprador o tienda"
        aria-label="Buscar pedidos"
        className={field}
      />
      <Table head={["Pedido", "Comprador", "Tiendas", "Estado", "Plaza X", "Total"]}>
        {rows.slice(0, limit).map((o) => (
          <OrderRow
            key={o.id}
            o={o}
            open={open === o.id}
            toggle={() => setOpen(open === o.id ? null : o.id)}
          />
        ))}
      </Table>
      {!rows.length && <p className="text-center text-xs text-slate-400">Sin pedidos.</p>}
      {rows.length > limit && (
        <button
          type="button"
          onClick={() => setLimit(limit + 50)}
          className="mx-auto block rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-amber-400"
        >
          Ver más pedidos ({rows.length - limit})
        </button>
      )}
    </div>
  );
}

const STATUS: Record<string, [string, string]> = {
  paid: ["Pagado", "text-emerald-300"],
  pending: ["Esperando pago", "text-slate-400"],
  failed: ["Rechazado", "text-red-300"],
  cancelled: ["Cancelado", "text-red-300"],
};

function OrderRow({ o, open, toggle }: { o: AdminOrder; open: boolean; toggle: () => void }) {
  const [label, color] = STATUS[o.status] ?? [o.status, "text-slate-300"];
  const plat = o.items.reduce((t, i) => t + (i.refunded ? 0 : i.platform), 0);
  return (
    <>
      <tr
        className="cursor-pointer border-t border-slate-800 hover:bg-slate-800/40"
        onClick={toggle}
      >
        <td className="p-3">
          <b className="font-mono text-white">{o.reference}</b>
          <div className="text-slate-400">{date(o.createdAt)}</div>
        </td>
        <td className="max-w-[12rem] truncate">{o.buyerEmail}</td>
        <td className="max-w-[12rem] truncate">
          {[...new Set(o.items.map((i) => i.store))].join(", ")}
        </td>
        <td className={color}>{label}</td>
        <td className="text-amber-400">{o.status === "paid" ? cop(plat) : "—"}</td>
        <td className="pr-3 text-right font-bold text-white">{cop(o.total)}</td>
      </tr>
      {open && (
        <tr className="bg-slate-950/60">
          <td colSpan={6} className="p-3">
            <ul className="space-y-1">
              {o.items.map((i, k) => (
                <li key={k} className="flex flex-wrap justify-between gap-2">
                  <span>
                    {i.qty} × {i.name} · <span className="text-slate-400">{i.store}</span> ·{" "}
                    {i.refunded ? "Reembolsado" : FULFILLMENT_LABEL[i.fulfillment]}
                  </span>
                  <span className="text-slate-400">
                    Vendedor {cop(i.seller)} · Afiliado {cop(i.affiliate)} · Plaza X{" "}
                    {cop(i.platform)}
                  </span>
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}

function Withdrawals() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: K.withdrawals, queryFn: () => backend.adminWithdrawals() });
  const set = useMutation({
    mutationFn: (v: { id: string; status: "paid" | "rejected" }) =>
      backend.adminSetWithdrawal(v.id, v.status),
    onSuccess: (_, v) => {
      toast.success(
        v.status === "paid"
          ? "Retiro marcado como pagado"
          : "Retiro rechazado: el saldo vuelve a la cuenta",
      );
      qc.invalidateQueries({ queryKey: K.withdrawals });
      qc.invalidateQueries({ queryKey: K.overview });
    },
    onError: (e) => toast.error(e.message),
  });
  if (q.isPending) return <Loading />;
  const method = (m: string) => PAYOUT_METHODS.find((x) => x.id === m)?.label ?? m;
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        Transfiere desde tu cuenta y luego márcalo como pagado. Si lo rechazas, el dinero vuelve al
        saldo disponible de la persona.
      </p>
      <Table head={["Persona", "Cuenta de cobro", "Fecha", "Monto", "Acción"]} min={640}>
        {(q.data ?? []).map((w) => (
          <tr key={w.id} className="border-t border-slate-800">
            <td className="p-3">
              <b className="text-white">{w.fullName}</b>
              <div className="text-slate-400">{w.email}</div>
            </td>
            <td>
              {method(w.method)} · <span className="font-mono">{w.account}</span>
            </td>
            <td>{date(w.createdAt)}</td>
            <td className="font-bold text-white">{cop(w.amount)}</td>
            <td className="pr-3 text-right">
              {w.status === "requested" ? (
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    disabled={set.isPending}
                    onClick={() => set.mutate({ id: w.id, status: "paid" })}
                    className="rounded-lg bg-amber-500 px-3 py-1.5 font-bold text-slate-950 disabled:opacity-50"
                  >
                    Pagado
                  </button>
                  <button
                    type="button"
                    disabled={set.isPending}
                    onClick={() => set.mutate({ id: w.id, status: "rejected" })}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 hover:text-white disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                </div>
              ) : (
                <span className={w.status === "paid" ? "text-emerald-300" : "text-slate-400"}>
                  {w.status === "paid" ? "Pagado" : "Rechazado"}
                </span>
              )}
            </td>
          </tr>
        ))}
      </Table>
      {!q.data?.length && (
        <p className="text-center text-xs text-slate-400">No hay solicitudes de retiro.</p>
      )}
    </div>
  );
}

function Products() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: K.products, queryFn: () => backend.adminProducts() });
  const [s, setS] = useState("");
  const set = useMutation({
    mutationFn: (v: { id: string; active: boolean }) =>
      backend.adminSetProductActive(v.id, v.active),
    onSuccess: (_, v) => {
      toast.success(v.active ? "Producto publicado" : "Producto retirado del catálogo");
      qc.invalidateQueries({ queryKey: K.products });
      qc.invalidateQueries({ queryKey: ["catalog"] });
    },
    onError: (e) => toast.error(e.message),
  });
  if (q.isPending) return <Loading />;
  const rows = (q.data ?? []).filter((p) =>
    `${p.name} ${p.storeName} ${p.category}`.toLowerCase().includes(s.trim().toLowerCase()),
  );
  return (
    <div className="space-y-3">
      <input
        value={s}
        onChange={(e) => setS(e.target.value)}
        placeholder="Buscar producto o tienda"
        aria-label="Buscar productos"
        className={field}
      />
      <Table head={["Producto", "Tienda", "Precio", "Stock", "Vendidos", "Comisión", "Estado"]}>
        {rows.map((p) => (
          <tr key={p.id} className={cn("border-t border-slate-800", !p.active && "opacity-60")}>
            <td className="p-3">
              <Link
                to="/producto/$id"
                params={{ id: p.id }}
                className="flex items-center gap-2 text-white hover:underline"
              >
                {p.image ? (
                  <img src={p.image} alt="" className="size-8 rounded-lg object-cover" />
                ) : (
                  <span className="grid size-8 place-items-center rounded-lg bg-slate-800">
                    {p.emoji}
                  </span>
                )}
                <span className="max-w-[14rem] truncate">{p.name}</span>
              </Link>
            </td>
            <td>{p.storeName}</td>
            <td>{cop(p.price)}</td>
            <td className={p.stock ? "" : "text-red-300"}>{p.stock}</td>
            <td>{p.soldCount}</td>
            <td>{p.commission > 0 ? `${Math.round(p.commission * 100)}%` : "Venta directa"}</td>
            <td className="pr-3 text-right">
              <button
                type="button"
                disabled={set.isPending}
                onClick={() => set.mutate({ id: p.id, active: !p.active })}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-200 hover:border-amber-400 disabled:opacity-50"
              >
                {p.active ? "Retirar" : "Publicar"}
              </button>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function Users() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: K.users, queryFn: () => backend.adminUsers() });
  const [s, setS] = useState("");
  const ban = useMutation({
    mutationFn: (u: AdminUser) => backend.setUserBanned(u.id, !u.banned),
    onSuccess: (_, u) => {
      toast.success(u.banned ? "Cuenta reactivada" : "Cuenta suspendida y tiendas pausadas");
      qc.invalidateQueries({ queryKey: K.users });
      qc.invalidateQueries({ queryKey: ["user", "admin-stores"] });
    },
    onError: (e) => toast.error(e.message),
  });
  if (q.isPending) return <Loading />;
  const rows = (q.data ?? []).filter((u) =>
    `${u.email} ${u.fullName} ${u.username ?? ""}`.toLowerCase().includes(s.trim().toLowerCase()),
  );
  return (
    <div className="space-y-3">
      <input
        value={s}
        onChange={(e) => setS(e.target.value)}
        placeholder="Buscar nombre, correo o @usuario"
        aria-label="Buscar usuarios"
        className={field}
      />
      <Table head={["Persona", "Tipo", "Usa", "Estado", "Acción"]} min={640}>
        {rows.map((u) => (
          <tr key={u.id} className="border-t border-slate-800">
            <td className="p-3">
              <b className="text-white">{u.fullName || "—"}</b>
              <div className="text-slate-400">{u.email}</div>
            </td>
            <td>{roleOf(u.accountType).label}</td>
            <td className="space-x-1">
              {u.hasStore && <Tag>Tienda</Tag>}
              {u.username && <Tag>@{u.username}</Tag>}
              {u.isAdmin && <Tag>Admin</Tag>}
            </td>
            <td className={u.banned ? "text-red-300" : "text-emerald-300"}>
              {u.banned ? "Suspendida" : "Activa"}
            </td>
            <td className="pr-3 text-right">
              {!u.isAdmin && (
                <button
                  type="button"
                  disabled={ban.isPending}
                  onClick={() => ban.mutate(u)}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-200 hover:border-amber-400 disabled:opacity-50"
                >
                  {u.banned ? "Reactivar" : "Suspender"}
                </button>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

const Tag = ({ children }: { children: ReactNode }) => (
  <span className="inline-block rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
    {children}
  </span>
);
