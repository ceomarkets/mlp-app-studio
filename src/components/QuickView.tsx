import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Flame,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Star,
  Timer,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { openAuth } from "@/components/AuthDialog";
import { addToCart } from "@/components/CartSheet";
import { FavoriteButton, Price, ProductImage } from "@/components/Shell";
import { ShareButton } from "@/components/ShareSheet";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { Product } from "@/lib/backend";
import { cart } from "@/lib/client-state";
import { discountPct, LOW_STOCK } from "@/lib/feed";
import { cop, splitSale } from "@/lib/plaza";
import { useUser } from "@/lib/session";
import { productShare } from "@/lib/share";

/**
 * "Afiliarse": con usuario de afiliado copia su enlace al instante; si aún no
 * lo tiene, lo lleva a activarlo; sin sesión, abre el inicio de sesión.
 */
export function useAffiliate() {
  const { user } = useUser();
  const navigate = useNavigate();
  return async (p: Product) => {
    if (!user) return openAuth();
    if (!user.username) return navigate({ to: "/afiliados" });
    const link = `${window.location.origin}/r/${user.username}/${p.id}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("¡Tu enlace de afiliado está listo!", {
        description: `Ganas ${cop(splitSale(p.price, p.commission).affiliate)} por cada venta. Ya está copiado.`,
      });
    } catch {
      toast.message("Tu enlace de afiliado", { description: link });
    }
  };
}

/**
 * Vista rápida: todo lo necesario para decidir y comprar sin salir de la portada.
 * Solo usa datos reales (descuento, vendidos, reseñas, stock): nada de contadores falsos.
 */
export function QuickView({
  product: p,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const [qty, setQty] = useState(1);
  const navigate = useNavigate();
  const { user } = useUser();
  const affiliate = useAffiliate();
  useEffect(() => setQty(1), [p?.id]);
  if (!p) return null;
  const off = discountPct(p);

  return (
    <Dialog open={!!p} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto p-0">
        <div className="grid md:grid-cols-2">
          <div className="relative">
            <ProductImage p={p} className="rounded-none text-[8rem] md:h-full md:rounded-l-lg" />
            {off > 0 && (
              <span className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-sm font-extrabold text-primary-foreground shadow-card">
                −{off}%
              </span>
            )}
            <div className="absolute right-3 top-3 flex gap-2">
              <FavoriteButton id={p.id} />
              <ShareButton
                data={() => productShare(p, user?.username)}
                className="grid size-9 place-items-center rounded-full bg-background/90 shadow-card backdrop-blur transition hover:scale-105"
              />
            </div>
          </div>
          <div className="flex flex-col gap-3 p-5 md:p-6">
            <Link
              to="/tienda/$slug"
              params={{ slug: p.store.slug }}
              onClick={onClose}
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-primary"
            >
              {p.store.emoji} {p.store.name}
            </Link>
            <DialogTitle className="text-2xl font-extrabold leading-tight">{p.name}</DialogTitle>
            <DialogDescription className="sr-only">Vista rápida de {p.name}</DialogDescription>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {p.ratingCount > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Star className="size-4 fill-sun text-sun" />
                  <b>{p.rating.toFixed(1)}</b>
                  <span className="text-muted-foreground">({p.ratingCount})</span>
                </span>
              )}
              {p.soldCount > 0 && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Flame className="size-4 text-primary" /> {p.soldCount} ya lo compraron
                </span>
              )}
            </div>

            <div>
              <Price p={p} size="lg" />
              {off > 0 && (
                <p className="text-sm font-bold text-primary">
                  Ahorras {cop(p.compareAtPrice! - p.price)}
                </p>
              )}
            </div>

            {p.stock > 0 && p.stock <= LOW_STOCK && (
              <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-sm font-bold text-destructive">
                <Timer className="size-4" /> ¡Solo quedan {p.stock}!
              </p>
            )}

            {p.description && (
              <p className="line-clamp-3 text-sm text-muted-foreground">{p.description}</p>
            )}

            <div className="mt-auto space-y-2.5 pt-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-full border">
                  <button
                    className="grid size-10 place-items-center"
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    aria-label="Menos"
                  >
                    <Minus className="size-4" />
                  </button>
                  <span className="w-6 text-center font-semibold">{qty}</span>
                  <button
                    className="grid size-10 place-items-center disabled:opacity-30"
                    disabled={qty >= p.stock}
                    onClick={() => setQty(qty + 1)}
                    aria-label="Más"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
                <Button
                  size="lg"
                  className="flex-1 text-base"
                  disabled={p.stock < 1}
                  onClick={() => {
                    cart.add(p.id, qty, p.stock);
                    onClose();
                    navigate({ to: "/carrito" });
                  }}
                >
                  {p.stock < 1 ? "Agotado" : "Comprar ya"}
                </Button>
              </div>
              <Button
                variant="outline"
                className="w-full"
                disabled={p.stock < 1}
                onClick={() => {
                  addToCart(p, qty);
                  onClose();
                }}
              >
                <ShoppingBag /> Agregar al carrito
              </Button>
              <Button
                variant="outline"
                className="w-full border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-600"
                onClick={() => affiliate(p)}
              >
                <i className="fa-solid fa-sack-dollar" /> Afiliarse y ganar{" "}
                {cop(splitSale(p.price, p.commission).affiliate)}
              </Button>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="size-3.5 text-primary" /> Pago seguro con Wompi
                </span>
                <Link
                  to="/producto/$id"
                  params={{ id: p.id }}
                  onClick={onClose}
                  className="inline-flex items-center gap-0.5 font-semibold text-primary"
                >
                  Ver todo <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
