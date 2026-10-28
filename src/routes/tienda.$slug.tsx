import { createFileRoute, notFound } from "@tanstack/react-router";
import { ProductCard, Shell } from "@/components/Shell";
import { products, storeBy } from "@/lib/plaza";

export const Route = createFileRoute("/tienda/$slug")({
  loader: ({ params }) => {
    const store = storeBy(params.slug);
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
  const items = products.filter((p) => p.store === store.slug);
  return (
    <Shell>
      <div className="flex items-center gap-6 rounded-3xl bg-secondary p-8">
        <div className="grid size-24 place-items-center rounded-2xl bg-card text-5xl shadow-card">{store.emoji}</div>
        <div>
          <p className="text-sm text-muted-foreground">plazax.com/{store.slug} · {store.city}</p>
          <h1 className="text-4xl font-extrabold">{store.name}</h1>
          <p className="mt-1 text-secondary-foreground">{store.tagline}</p>
        </div>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-5 md:grid-cols-4">
        {items.map((p) => <ProductCard key={p.id} p={p} />)}
      </div>
    </Shell>
  );
}
