import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import {
  BadgePercent,
  Flame,
  Minus,
  Plus,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { addToCart } from "@/components/CartSheet";
import { ShareLink } from "@/components/ShareLink";
import { FavoriteButton, Price, ProductCard, ProductImage, Shell, Stars } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { backend, IS_DEMO } from "@/lib/backend";
import { cart, useReferral, viewed } from "@/lib/client-state";
import { discountPct, isNew } from "@/lib/feed";
import { cop, pct, splitSale } from "@/lib/plaza";
import { keys, useUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/producto/$id")({
  ssr: !IS_DEMO,
  loader: async ({ params }) => {
    const product = await backend.getProduct(params.id);
    if (!product) throw notFound();
    return { product };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.product.name} · ${loaderData.product.store.name} · Plaza X` },
          {
            name: "description",
            content: loaderData.product.description.slice(0, 155) || loaderData.product.name,
          },
          { property: "og:title", content: loaderData.product.name },
          {
            property: "og:description",
            content: `${cop(loaderData.product.price)} · ${loaderData.product.store.name}`,
          },
          ...(loaderData.product.images[0]?.startsWith("http")
            ? [{ property: "og:image", content: loaderData.product.images[0] }]
            : []),
        ]
      : [{ title: "Producto no encontrado · Plaza X" }],
  }),
  component: ProductPage,
});

function ProductPage() {
  const initial = Route.useLoaderData().product;
  const product = useQuery({
    queryKey: keys.product(initial.id),
    queryFn: () => backend.getProduct(initial.id),
    initialData: initial,
  });
  const p = product.data ?? initial;
  const { user } = useUser();
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);
  const [img, setImg] = useState(0);
  const more = useQuery({
    queryKey: keys.products({ storeSlug: p.store.slug }),
    queryFn: () => backend.listProducts({ storeSlug: p.store.slug }),
  });
  const earn = splitSale(p.price, p.commission).affiliate;
  const myStore = useQuery({
    queryKey: keys.myStore,
    queryFn: () => backend.myStore(),
    enabled: !!user,
  });
  const isMine = !!myStore.data && myStore.data.id === p.storeId;
  const ref = useReferral();
  const off = discountPct(p);
  useEffect(() => viewed.add(initial.id), [initial.id]);

  async function shareProduct() {
    // Si quien comparte es afiliado, el enlace lleva su usuario y gana comisión.
    const url = user?.username
      ? `${window.location.origin}/r/${user.username}/${p.id}`
      : `${window.location.origin}/producto/${p.id}`;
    const text = `${p.name} a ${cop(p.price)}${off ? ` (−${off}%)` : ""} en ${p.store.name}`;
    try {
      if (navigator.share) await navigator.share({ title: p.name, text, url });
      else {
        await navigator.clipboard.writeText(`${text} 👉 ${url}`);
        toast.success("Enlace copiado", { description: "Pégalo en WhatsApp o tus redes." });
      }
    } catch {
      /* cancelado */
    }
  }

  const buyNow = () => {
    cart.add(p.id, qty, p.stock);
    navigate({ to: "/carrito" });
  };

  return (
    <Shell>
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Plaza
        </Link>{" "}
        /{" "}
        <Link to="/tienda/$slug" params={{ slug: p.store.slug }} className="hover:text-foreground">
          {p.store.name}
        </Link>{" "}
        / <span className="text-foreground">{p.name}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-2 md:gap-12">
        <div className="md:sticky md:top-32 md:self-start">
          <div className="relative">
            <ProductImage
              p={{ ...p, images: p.images.slice(img) }}
              className="rounded-3xl text-[9rem] shadow-card"
            />
            <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
              {off > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-sm font-extrabold text-primary-foreground shadow-card">
                  <BadgePercent className="size-4" /> −{off}%
                </span>
              )}
              {isNew(p) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-sun px-3 py-1 text-sm font-bold text-accent-foreground shadow-card">
                  <Sparkles className="size-4" /> Nuevo
                </span>
              )}
            </div>
            <div className="absolute right-3 top-3 flex flex-col gap-2">
              <FavoriteButton id={p.id} className="size-11" />
              <button
                onClick={shareProduct}
                aria-label="Compartir"
                className="grid size-11 place-items-center rounded-full bg-background/90 shadow-card backdrop-blur transition hover:scale-105"
              >
                <Share2 className="size-4.5" />
              </button>
            </div>
          </div>
          {p.images.length > 1 && (
            <div className="mt-3 flex gap-2">
              {p.images.map((src, i) => (
                <button
                  key={src}
                  onClick={() => setImg(i)}
                  className={cn(
                    "size-16 overflow-hidden rounded-xl border-2",
                    i === img ? "border-primary" : "border-transparent",
                  )}
                >
                  <img src={src} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <Link
            to="/tienda/$slug"
            params={{ slug: p.store.slug }}
            className="text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:text-primary"
          >
            {p.store.emoji} {p.store.name} · {p.store.city}
          </Link>
          <h1 className="mt-2 text-3xl font-extrabold md:text-4xl">{p.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Stars value={p.rating} count={p.ratingCount} />
            {p.soldCount > 0 && (
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <Flame className="size-4 text-primary" /> {p.soldCount} vendidos
              </span>
            )}
          </div>
          <div className="mt-5">
            <Price p={p} size="lg" />
            {off > 0 && (
              <p className="mt-1 text-sm font-semibold text-primary">
                Ahorras {cop(p.compareAtPrice! - p.price)}
              </p>
            )}
          </div>
          {p.description && (
            <p className="mt-5 whitespace-pre-line leading-relaxed text-muted-foreground">
              {p.description}
            </p>
          )}

          <div className="mt-6 flex items-center gap-3">
            <div className="flex items-center rounded-full border bg-card">
              <button
                className="grid size-11 place-items-center"
                onClick={() => setQty(Math.max(1, qty - 1))}
                aria-label="Menos"
              >
                <Minus className="size-4" />
              </button>
              <span className="w-8 text-center font-semibold">{qty}</span>
              <button
                className="grid size-11 place-items-center disabled:opacity-30"
                disabled={qty >= p.stock}
                onClick={() => setQty(qty + 1)}
                aria-label="Más"
              >
                <Plus className="size-4" />
              </button>
            </div>
            <span className="text-sm text-muted-foreground">
              {p.stock > 0 ? `${p.stock} disponibles` : "Agotado"}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Button
              size="lg"
              variant="outline"
              disabled={p.stock < 1}
              onClick={() => addToCart(p, qty)}
            >
              Agregar al carrito
            </Button>
            <Button size="lg" disabled={p.stock < 1} onClick={buyNow}>
              Comprar ahora
            </Button>
          </div>
          {ref && !isMine && (
            <p className="mt-3 text-xs text-muted-foreground">Te lo recomendó @{ref}.</p>
          )}

          <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" /> Pago seguro con Wompi: tarjeta, PSE,
              Nequi o Bancolombia
            </li>
            <li className="flex items-center gap-2">
              <Truck className="size-4 text-primary" /> Envío coordinado por la tienda a todo
              Colombia
            </li>
          </ul>

          {isMine ? (
            <div className="mt-6 flex items-center justify-between rounded-2xl bg-secondary p-4 text-sm text-secondary-foreground">
              Este producto es de tu tienda.
              <Link to="/vendedores" className="font-bold underline underline-offset-2">
                Editarlo →
              </Link>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl bg-accent p-4 text-accent-foreground">
              <div className="text-sm">
                Comparte este producto y gana <b>{cop(earn)}</b> por cada venta ({pct(p.commission)}
                ).
              </div>
              {user?.username ? (
                <ShareLink username={user.username} product={p} className="mt-3" />
              ) : (
                <Link
                  to="/afiliados"
                  className="mt-2 inline-block text-sm font-bold underline underline-offset-2"
                >
                  Activa tu enlace de afiliado →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      <Reviews productId={p.id} />

      {(more.data?.length ?? 0) > 1 && (
        <section className="mt-14">
          <h2 className="text-2xl font-bold">Más de {p.store.name}</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
            {more
              .data!.filter((x) => x.id !== p.id)
              .slice(0, 4)
              .map((x) => (
                <ProductCard key={x.id} p={x} />
              ))}
          </div>
        </section>
      )}
      {/* Barra de compra fija en móvil (sobre la navegación inferior) */}
      {p.stock > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 flex items-center gap-3 border-t bg-background/95 px-4 py-2.5 backdrop-blur-md md:hidden">
          <div className="min-w-0 flex-1">
            <Price p={p} />
          </div>
          <Button
            size="icon"
            variant="outline"
            onClick={() => addToCart(p, qty)}
            aria-label="Agregar al carrito"
          >
            <ShoppingBag />
          </Button>
          <Button onClick={buyNow}>Comprar</Button>
        </div>
      )}
      <div className="h-16 md:hidden" aria-hidden />
    </Shell>
  );
}

function Reviews({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const { user } = useUser();
  const reviews = useQuery({
    queryKey: keys.reviews(productId),
    queryFn: () => backend.listReviews(productId),
  });
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const add = useMutation({
    mutationFn: () => backend.addReview(productId, rating, comment.trim()),
    onSuccess: () => {
      toast.success("¡Gracias por tu reseña!");
      setComment("");
      qc.invalidateQueries({ queryKey: keys.reviews(productId) });
      qc.invalidateQueries({ queryKey: keys.product(productId) });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <section id="resenas" className="mt-14 grid gap-8 md:grid-cols-[1fr_340px]">
      <div>
        <h2 className="text-2xl font-bold">Reseñas</h2>
        <div className="mt-4 space-y-3">
          {reviews.data?.map((r) => (
            <div key={r.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{r.author}</span>
                <span className="text-sun">
                  {"★".repeat(r.rating)}
                  <span className="text-muted">{"★".repeat(5 - r.rating)}</span>
                </span>
              </div>
              {r.comment && <p className="mt-1 text-sm text-muted-foreground">{r.comment}</p>}
            </div>
          ))}
          {reviews.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">Aún no hay reseñas.</p>
          )}
        </div>
      </div>
      {user && (
        <div className="h-fit rounded-2xl border bg-card p-5">
          <h3 className="font-bold">¿Ya lo recibiste?</h3>
          <div className="mt-2 flex gap-1 text-2xl" role="radiogroup" aria-label="Calificación">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                role="radio"
                aria-checked={n === rating}
                onClick={() => setRating(n)}
                className={n <= rating ? "text-sun" : "text-muted"}
              >
                ★
              </button>
            ))}
          </div>
          <Textarea
            className="mt-3"
            placeholder="Cuéntanos cómo te fue (opcional)"
            value={comment}
            maxLength={600}
            onChange={(e) => setComment(e.target.value)}
          />
          <Button className="mt-3 w-full" disabled={add.isPending} onClick={() => add.mutate()}>
            Publicar reseña
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Solo compradores con entrega confirmada.
          </p>
        </div>
      )}
    </section>
  );
}
