import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { addToCart } from "@/components/CartSheet";
import { Empty, ProductCard, ProductGridSkeleton, Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { backend } from "@/lib/backend";
import { useFavorites } from "@/lib/client-state";
import { keys } from "@/lib/session";

export const Route = createFileRoute("/favoritos")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Favoritos · Plaza X" }, { name: "robots", content: "noindex" }],
  }),
  component: Favorites,
});

function Favorites() {
  const favs = useFavorites();
  const products = useQuery({ queryKey: keys.products({}), queryFn: () => backend.listProducts() });
  const list = favs
    .map((id) => products.data?.find((p) => p.id === id))
    .filter((p) => p !== undefined);

  return (
    <Shell>
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-card">
          <Heart className="size-5 fill-current" />
        </span>
        <div>
          <h1 className="text-3xl font-extrabold">Favoritos</h1>
          <p className="text-sm text-muted-foreground">
            {favs.length
              ? `${favs.length} guardados en este dispositivo`
              : "Toca el corazón para guardar"}
          </p>
        </div>
      </div>
      <div className="mt-6">
        {products.isPending && favs.length ? (
          <ProductGridSkeleton n={Math.min(4, favs.length)} />
        ) : list.length ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
            {list.map((p) => (
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
          <Empty icon={<Heart />} title="Aún no guardas productos">
            <Link to="/" className="font-semibold text-primary">
              Explora la plaza
            </Link>{" "}
            y toca el corazón de lo que te guste. Te recomendaremos cosas parecidas.
          </Empty>
        )}
      </div>
    </Shell>
  );
}
