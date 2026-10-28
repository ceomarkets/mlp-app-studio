import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { addToCart } from "@/components/CartSheet";
import { Empty, ProductCard, ProductGridSkeleton, Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { backend, IS_DEMO } from "@/lib/backend";
import { keys } from "@/lib/session";

export const Route = createFileRoute("/tienda/$slug")({
  ssr: !IS_DEMO,
  loader: async ({ params }) => {
    const store = await backend.getStore(params.slug);
    if (!store) throw notFound();
    return { store };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.store.name} en Plaza X` },
          { name: "description", content: loaderData.store.tagline },
          { property: "og:title", content: `${loaderData.store.name} en Plaza X` },
          { property: "og:description", content: loaderData.store.tagline },
        ]
      : [{ title: "Tienda no encontrada · Plaza X" }, { name: "robots", content: "noindex" }],
  }),
  component: StorePage,
});

function StorePage() {
  const { store } = Route.useLoaderData();
  const items = useQuery({
    queryKey: keys.products({ storeSlug: store.slug }),
    queryFn: () => backend.listProducts({ storeSlug: store.slug }),
  });
  const sold = items.data?.reduce((t, p) => t + p.soldCount, 0) ?? 0;

  return (
    <Shell>
      <div className="flex flex-col gap-6 rounded-3xl bg-secondary p-6 md:flex-row md:items-center md:p-8">
        <div className="grid size-24 shrink-0 place-items-center rounded-2xl bg-card text-5xl shadow-card">
          {store.emoji}
        </div>
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">
            plazax.co/tienda/{store.slug} · {store.city}
          </p>
          <h1 className="text-4xl font-extrabold">{store.name}</h1>
          {store.tagline && <p className="mt-1 text-secondary-foreground">{store.tagline}</p>}
          <p className="mt-2 text-sm text-muted-foreground">
            {items.data?.length ?? "…"} productos · {sold} vendidos
          </p>
        </div>
        {store.whatsapp && (
          <Button asChild variant="outline">
            <a
              href={`https://wa.me/57${store.whatsapp.replace(/\D/g, "").slice(-10)}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle /> Escribir a la tienda
            </a>
          </Button>
        )}
      </div>
      <div className="mt-8">
        {items.isPending ? (
          <ProductGridSkeleton n={4} />
        ) : items.data?.length ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
            {items.data.map((p) => (
              <ProductCard
                key={p.id}
                p={p}
                action={
                  <Button
                    className="w-full"
                    variant="outline"
                    disabled={p.stock < 1}
                    onClick={() => addToCart(p)}
                  >
                    {p.stock < 1 ? "Agotado" : "Agregar"}
                  </Button>
                }
              />
            ))}
          </div>
        ) : (
          <Empty title="Esta tienda aún no publica productos" />
        )}
      </div>
    </Shell>
  );
}
