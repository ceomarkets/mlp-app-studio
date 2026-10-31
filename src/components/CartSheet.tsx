import { useQueries } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { backend, type Product } from "@/lib/backend";
import { cart, useCart } from "@/lib/client-state";
import { BUNDLE_MIN, BUNDLE_RATE, bundleDiscount, cop } from "@/lib/plaza";
import { keys } from "@/lib/session";
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
  if (p.stock < 1) return void toast.error("Producto agotado");
  cart.add(p.id, qty, p.stock);
  openCart();
}

/** Cajón del carrito (derecha), con el progreso del premio por volumen. */
export function CartSheet() {
  const open = cartUI.use();
  const navigate = useNavigate();
  const { rows, subtotal, discount, total, count } = useCartDetails();
  const pct = Math.min(100, Math.round((count / BUNDLE_MIN) * 100));
  const unlocked = count >= BUNDLE_MIN;

  return (
    <Sheet open={open} onOpenChange={cartUI.set}>
      <SheetContent
        side="right"
        className="flex w-screen max-w-md flex-col gap-0 border-l border-slate-200 bg-white p-0 text-slate-900 shadow-2xl sm:max-w-md [&>button]:text-slate-500"
      >
        {/* Encabezado */}
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <SheetTitle className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
            <i className="fa-solid fa-cart-shopping text-orange-500" /> Carrito de Compras
          </SheetTitle>
          <SheetDescription className="sr-only">Productos en tu carrito</SheetDescription>
        </div>

        {/* Premio por volumen */}
        <div className="border-b border-slate-200 bg-slate-50 p-3">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-bold text-amber-700">
              <i className="fa-solid fa-award text-amber-700" /> Tu Premio Comprador:
            </span>
            <span
              className={cn(
                unlocked
                  ? "animate-pulse font-black text-emerald-600"
                  : "font-extrabold text-amber-700",
              )}
            >
              {unlocked
                ? `¡${Math.round(BUNDLE_RATE * 100)}% OFF DESBLOQUEADO! 🎁`
                : `Faltan ${BUNDLE_MIN - count} ítem(s)`}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full border border-slate-200 bg-white">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Productos */}
        <div className="flex-grow space-y-3 overflow-y-auto p-4">
          {rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              <i className="fa-solid fa-cart-flatbed mb-2 block text-3xl text-slate-600" />
              Tu carrito está vacío
            </div>
          ) : (
            rows.map((r) => <CartLineRow key={r.product.id} row={r} />)
          )}
        </div>

        {/* Total y pago */}
        {rows.length > 0 && (
          <div className="space-y-2 border-t border-slate-200 bg-slate-50 p-4">
            {discount > 0 && (
              <>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Subtotal</span>
                  <span>{cop(subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-emerald-600">
                  <span>Premio {Math.round(BUNDLE_RATE * 100)}% OFF</span>
                  <span>−{cop(discount)}</span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-600">Total</span>
              <span className="text-xl font-extrabold text-slate-900">{cop(total)}</span>
            </div>
            <button
              onClick={() => {
                cartUI.close();
                navigate({ to: "/carrito" });
              }}
              className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3 text-sm font-black text-slate-950 shadow-lg shadow-orange-500/20 transition hover:from-orange-400 hover:to-amber-400"
            >
              <i className="fa-solid fa-lock me-1.5" /> Pagar Ahora
            </button>
            <p className="text-center text-[10px] text-slate-500">
              <i className="fa-solid fa-shield-halved me-1 text-emerald-600" /> Pago en custodia: el
              vendedor cobra cuando confirmas que recibiste. Si algo sale mal, abres una disputa y
              te reembolsamos.{" "}
              <Link
                to="/legal"
                hash="proteccion-comprador"
                onClick={() => cartUI.close()}
                className="font-semibold text-indigo-600 underline"
              >
                Cómo funciona
              </Link>
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function CartLineRow({ row: { product: p, qty } }: { row: CartRow }) {
  const over = qty > p.stock;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-white text-2xl">
        {p.images[0] ? (
          <img src={p.images[0]} alt="" className="size-full object-cover" />
        ) : (
          <span aria-hidden>{p.emoji}</span>
        )}
      </span>
      <div className="min-w-0 flex-grow">
        <h4 className="truncate text-xs font-bold text-slate-900">{p.name}</h4>
        <span className="text-xs font-bold text-emerald-600">{cop(p.price * qty)}</span>
        {over && (
          <span className="block text-[10px] font-bold text-red-600">Solo quedan {p.stock}</span>
        )}
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-1">
        <button
          onClick={() => cart.setQty(p.id, qty - 1)}
          aria-label="Quitar uno"
          className="flex size-5 items-center justify-center text-xs text-slate-500 hover:text-slate-900"
        >
          -
        </button>
        <span className="w-4 text-center text-xs font-bold text-slate-900">{qty}</span>
        <button
          onClick={() => cart.setQty(p.id, qty + 1)}
          disabled={qty >= p.stock}
          aria-label="Agregar uno"
          className="flex size-5 items-center justify-center text-xs text-slate-500 hover:text-slate-900 disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}
