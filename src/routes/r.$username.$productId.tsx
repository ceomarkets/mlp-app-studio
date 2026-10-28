import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { backend } from "@/lib/backend";
import { referral } from "@/lib/client-state";

/**
 * Enlace de afiliado: /r/<usuario>/<producto>
 * Registra el clic, guarda la atribución por 30 días y lleva al producto.
 */
export const Route = createFileRoute("/r/$username/$productId")({
  ssr: false,
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: Redirect,
});

function Redirect() {
  const { username, productId } = Route.useParams();
  const navigate = useNavigate();
  useEffect(() => {
    const clean = username.toLowerCase().replace(/[^a-z0-9-]/g, "");
    referral.set(clean);
    backend
      .trackClick(clean, productId)
      .catch(() => undefined)
      .finally(() => navigate({ to: "/producto/$id", params: { id: productId }, replace: true }));
  }, [username, productId, navigate]);
  return (
    <div className="grid min-h-screen place-items-center text-muted-foreground">
      Abriendo producto…
    </div>
  );
}
