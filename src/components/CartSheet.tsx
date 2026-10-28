import { useQueries } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useSyncExternalStore } from "react";
import { ProductImage } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { backend, type Product } from "@/lib/backend";
import { cart, useCart } from "@/lib/client-state";
import { cop } from "@/lib/plaza";
import { keys } from "@/lib/session";

export type CartRow = { product: Product; qty: number };

/** Líneas del carrito con los datos actuales de cada producto (precio y stock reales). */
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
  const total = rows.reduce((t, r) => t + r.product.price * r.qty, 0);
  const count = lines.reduce((t, l) => t + l.qty, 0);
  return { lines, rows, total, count, loading };
}

const openStore = {
  open: false,
  subs: new Set<() => void>(),
  set(v: boolean) {
    this.open = v;
    this.subs.forEach((s) => s());
  },
};
/** Abre el carrito desde cualquier parte (p. ej. al agregar un producto). */
export const openCart = () => openStore.set(true);

export function addToCart(p: Product, qty = 1) {
  if (p.stock < 1) return void toast.error("Producto agotado");
  cart.add(p.id, qty, p.stock);
  toast.success(`¡Listo! ${p.name} va en tu carrito 🛍️`, {
    action: { label: "Pagar", onClick: openCart },
  });
}

export function CartSheet() {
  const { rows, total, count } = useCartDetails();
  const open = useSyncExternalStore(
    (fn) => {
      openStore.subs.add(fn);
      return () => openStore.subs.delete(fn);
    },
    () => openStore.open,
    () => false,
  );
  const setOpen = (v: boolean) => openStore.set(v);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="relative grid size-9 place-items-center rounded-full hover:bg-muted"
          aria-label={`Carrito, ${count} productos`}
        >
          <ShoppingBag className="size-5" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
              {count}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">Tu carrito</SheetTitle>
          <SheetDescription>
            {count
              ? `${count} productos de ${new Set(rows.map((r) => r.product.storeId)).size} tiendas`
              : "Aún no agregas productos"}
          </SheetDescription>
        </SheetHeader>
        <div className="-mx-6 flex-1 space-y-3 overflow-y-auto px-6 py-4">
          {rows.map((r) => (
            <CartLineRow key={r.product.id} row={r} />
          ))}
          {!rows.length && (
            <div className="py-16 text-center text-sm text-muted-foreground">
              <ShoppingBag className="mx-auto mb-3 size-10 opacity-40" />
              Explora la plaza y agrega lo que te guste.
            </div>
          )}
        </div>
        {rows.length > 0 && (
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between text-lg">
              <span>Total</span>
              <span className="font-display font-bold">{cop(total)}</span>
            </div>
            <Button asChild size="lg" className="w-full" onClick={() => setOpen(false)}>
              <Link to="/carrito">Ir a pagar</Link>
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function CartLineRow({ row: { product: p, qty } }: { row: CartRow }) {
  const over = qty > p.stock;
  return (
    <div className="flex gap-3 rounded-2xl border bg-card p-3">
      <ProductImage p={p} className="size-16 shrink-0 text-3xl" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs text-muted-foreground">{p.store.name}</div>
        <div className="truncate font-semibold">{p.name}</div>
        <div className="mt-1 flex items-center justify-between">
          <div className="flex items-center rounded-full border">
            <button
              className="grid size-7 place-items-center"
              onClick={() => cart.setQty(p.id, qty - 1)}
              aria-label="Quitar uno"
            >
              <Minus className="size-3.5" />
            </button>
            <span className="w-6 text-center text-sm font-semibold">{qty}</span>
            <button
              className="grid size-7 place-items-center disabled:opacity-30"
              disabled={qty >= p.stock}
              onClick={() => cart.setQty(p.id, qty + 1)}
              aria-label="Agregar uno"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
          <span className="font-semibold">{cop(p.price * qty)}</span>
        </div>
        {over && (
          <div className="mt-1 text-xs font-semibold text-destructive">Solo quedan {p.stock}</div>
        )}
      </div>
      <button
        className="self-start text-muted-foreground hover:text-destructive"
        onClick={() => cart.remove(p.id)}
        aria-label="Eliminar"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}
