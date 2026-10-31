import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Lock, ShoppingBag } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { CartLineRow, useCartDetails } from "@/components/CartSheet";
import { Empty, Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { backend, IS_DEMO, type Shipping } from "@/lib/backend";
import { cart, useReferral } from "@/lib/client-state";
import { rememberCoupon, savedCoupon } from "@/lib/coupon";
import { BUNDLE_RATE, cop, priceOrder, type CouponRule } from "@/lib/plaza";
import { keys, useUser } from "@/lib/session";

export const Route = createFileRoute("/carrito")({
  head: () => ({ meta: [{ title: "Carrito · Plaza X" }, { name: "robots", content: "noindex" }] }),
  ssr: false,
  component: Checkout,
});

const SHIP_KEY = "plazax-shipping";

function Checkout() {
  const { rows, loading, lines, count } = useCartDetails();
  const [code, setCode] = useState("");
  const [coupon, setCoupon] = useState<CouponRule | null>(null);
  const priced = priceOrder(
    rows.map((r) => ({ productId: r.product.id, subtotal: r.product.price * r.qty })),
    count,
    coupon,
  );
  const total = priced.total;
  const { user } = useUser();
  const ref = useReferral();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [ship, setShip] = useState<Shipping>({
    name: "",
    phone: "",
    city: "",
    address: "",
    notes: "",
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SHIP_KEY);
      if (saved) return setShip(JSON.parse(saved));
    } catch {
      /* ignorar */
    }
    if (user)
      setShip((s) => ({ ...s, name: s.name || user.fullName, phone: s.phone || user.phone || "" }));
  }, [user]);

  const apply = useMutation({
    mutationFn: (c: string) => backend.checkCoupon(c),
    onSuccess: (c) => {
      setCoupon(c);
      setCode(c.code);
      rememberCoupon(c.code);
    },
    onError: (e) => {
      setCoupon(null);
      rememberCoupon(null);
      toast.error(e.message);
    },
  });
  // Cupón traído desde la venta flash (se valida al tener sesión).
  const pending = useQuery({
    queryKey: ["user", "saved-coupon", savedCoupon()],
    queryFn: () => backend.checkCoupon(savedCoupon()),
    enabled: !!user && !!savedCoupon() && !coupon,
    retry: false,
  });
  useEffect(() => {
    if (pending.data && !coupon) {
      setCoupon(pending.data);
      setCode(pending.data.code);
    }
  }, [pending.data, coupon]);

  const stores = [...new Set(rows.map((r) => r.product.store.name))];
  const problems = rows.filter((r) => r.qty > r.product.stock);
  const missing = lines.length - rows.length;

  const pay = useMutation({
    mutationFn: async () => {
      const order = await backend.createOrder(
        rows.map((r) => ({ productId: r.product.id, qty: r.qty })),
        ref,
        ship,
        coupon && !priced.missing ? coupon.code : null,
      );
      rememberCoupon(null);
      try {
        localStorage.setItem(SHIP_KEY, JSON.stringify(ship));
      } catch {
        /* ignorar */
      }
      qc.invalidateQueries({ queryKey: keys.myOrders });
      let url = `/pedido/${order.orderId}`;
      try {
        url = await backend.startPayment(
          order.orderId,
          `${window.location.origin}/pedido/${order.orderId}`,
        );
      } catch (e) {
        // El pedido ya existe: desde su página se puede reintentar el pago.
        toast.error((e as Error).message);
      }
      cart.clear();
      return { order, url };
    },
    onSuccess: ({ url }) => {
      if (url.startsWith("http")) window.location.assign(url);
      else navigate({ href: url });
    },
    onError: (e) => toast.error(e.message),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!user) {
      navigate({ to: "/entrar", search: { to: "/carrito" } });
      return;
    }
    pay.mutate();
  }

  if (!loading && !lines.length)
    return (
      <Shell>
        <Empty icon={<ShoppingBag />} title="Tu carrito está vacío">
          <Link to="/" className="font-semibold text-primary">
            Volver a la plaza
          </Link>
        </Empty>
      </Shell>
    );

  const field = (k: keyof Shipping, label: string, props: Record<string, unknown> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={k}>{label}</Label>
      <Input
        id={k}
        required
        value={ship[k] ?? ""}
        onChange={(e) => setShip({ ...ship, [k]: e.target.value })}
        {...props}
      />
    </div>
  );

  return (
    <Shell>
      <h1 className="text-4xl font-extrabold">Finalizar compra</h1>
      <form onSubmit={submit} className="mt-8 grid gap-8 md:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-xl font-bold">
              Productos{" "}
              <span className="text-sm font-normal text-muted-foreground">
                · {stores.length} tiendas
              </span>
            </h2>
            {rows.map((r) => (
              <CartLineRow key={r.product.id} row={r} />
            ))}
            {missing > 0 && (
              <p className="text-sm text-muted-foreground">
                {missing} producto(s) ya no están disponibles.
              </p>
            )}
          </section>

          <section className="space-y-4 rounded-3xl border bg-card p-5 shadow-card md:p-6">
            <h2 className="text-xl font-bold">Datos de envío</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {field("name", "Nombre de quien recibe", { autoComplete: "name" })}
              {field("phone", "Celular", {
                inputMode: "tel",
                autoComplete: "tel",
                pattern: "[0-9+ ]{7,20}",
              })}
              {field("city", "Ciudad / municipio", { autoComplete: "address-level2" })}
              {field("address", "Dirección", { autoComplete: "street-address" })}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Indicaciones (opcional)</Label>
              <Textarea
                id="notes"
                rows={2}
                value={ship.notes ?? ""}
                onChange={(e) => setShip({ ...ship, notes: e.target.value })}
                placeholder="Barrio, apto, punto de referencia…"
              />
            </div>
          </section>
        </div>

        <aside className="h-fit space-y-4 rounded-3xl bg-ink p-6 text-ink-foreground md:sticky md:top-24">
          <h2 className="text-xl font-bold">Resumen</h2>
          <div className="space-y-2 text-sm">
            {rows.map((r) => (
              <div key={r.product.id} className="flex justify-between gap-3">
                <span className="truncate opacity-80">
                  {r.qty} × {r.product.name}
                </span>
                <span>{cop(r.product.price * r.qty)}</span>
              </div>
            ))}
            {priced.bundle > 0 && (
              <div className="flex justify-between font-semibold text-emerald-300">
                <span>Premio {Math.round(BUNDLE_RATE * 100)}% OFF por volumen</span>
                <span>−{cop(priced.bundle)}</span>
              </div>
            )}
            {coupon && priced.coupon > 0 && (
              <div className="flex justify-between font-semibold text-emerald-300">
                <span>Cupón {coupon.code}</span>
                <span>−{cop(priced.coupon)}</span>
              </div>
            )}
            <div className="flex justify-between opacity-80">
              <span>Envío</span>
              <span>Lo coordina cada tienda</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="¿Tienes un cupón?"
                aria-label="Código de cupón"
                maxLength={20}
                className="h-9 min-w-0 flex-1 rounded-lg border border-ink-foreground/20 bg-ink-foreground/10 px-3 font-mono text-sm uppercase placeholder:normal-case placeholder:opacity-60 focus:outline-none"
              />
              {coupon ? (
                <button
                  type="button"
                  onClick={() => {
                    setCoupon(null);
                    setCode("");
                    rememberCoupon(null);
                  }}
                  className="rounded-lg px-3 text-xs font-semibold underline"
                >
                  Quitar
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!code.trim() || apply.isPending || !user}
                  onClick={() => apply.mutate(code.trim())}
                  className="rounded-lg bg-ink-foreground px-3 text-xs font-bold text-ink disabled:opacity-50"
                >
                  {apply.isPending ? <Loader2 className="size-3 animate-spin" /> : "Aplicar"}
                </button>
              )}
            </div>
            {coupon && (
              <p className="text-[11px] opacity-80">
                {priced.missing > 0
                  ? `Te faltan ${cop(priced.missing)} en productos para usar ${coupon.code}.`
                  : priced.capped
                    ? "Aplicamos el máximo que permite este pedido (lo asume Plaza X)."
                    : coupon.description || "Cupón aplicado."}
              </p>
            )}
            {!user && <p className="text-[11px] opacity-70">Entra para usar un cupón.</p>}
          </div>
          <div className="flex items-center justify-between border-t border-ink-foreground/20 pt-4 text-lg">
            <span>Total</span>
            <span className="font-display text-2xl font-bold">{cop(total)}</span>
          </div>
          {ref && (
            <p className="rounded-xl bg-ink-foreground/10 px-3 py-2 text-xs">
              Compra recomendada por @{ref}. ¡Gracias por apoyar a tu red!
            </p>
          )}
          {problems.length > 0 && (
            <p className="rounded-xl bg-destructive px-3 py-2 text-xs text-destructive-foreground">
              Ajusta las cantidades: hay productos sin stock suficiente.
            </p>
          )}
          <Button
            // Sin sesión no se valida el formulario: primero se entra y se vuelve aquí.
            type={user ? "submit" : "button"}
            onClick={
              user ? undefined : () => navigate({ to: "/entrar", search: { to: "/carrito" } })
            }
            size="lg"
            variant="secondary"
            className="w-full"
            disabled={pay.isPending || loading || !rows.length || problems.length > 0}
          >
            {pay.isPending ? <Loader2 className="animate-spin" /> : <Lock />}
            {user ? `Pagar ${cop(total)}` : "Entrar para pagar"}
          </Button>
          <p className="text-center text-xs opacity-70">
            {IS_DEMO
              ? "Modo demo: el pago se simula."
              : "Serás redirigido a Wompi (Bancolombia): tarjeta, PSE, Nequi o botón Bancolombia."}
          </p>
        </aside>
      </form>
    </Shell>
  );
}
