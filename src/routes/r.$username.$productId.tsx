import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { backend } from "@/lib/backend";
import { cleanSource, referral } from "@/lib/client-state";

/**
 * Enlace corto de afiliado: /r/<usuario>/<producto>?src=<canal>
 * Registra el clic con su canal, guarda la atribución 30 días (último clic) y lleva al producto.
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
    const q = new URLSearchParams(window.location.search);
    const source = cleanSource(q.get("src") ?? q.get("utm_source"));
    referral.set(clean, source);
    backend
      .trackClick(clean, productId, source)
      .catch(() => undefined)
      .finally(() => navigate({ to: "/producto/$id", params: { id: productId }, replace: true }));
  }, [username, productId, navigate]);
  return (
    <div className="grid min-h-screen place-items-center text-muted-foreground">
      Abriendo producto…
    </div>
  );
}
