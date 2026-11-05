import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthForm } from "@/components/AuthDialog";
import { Shell } from "@/components/Shell";
import { useUser } from "@/lib/session";

type Search = { to?: string | undefined };

/**
 * Ingreso de compradores a páginas que lo necesitan (Mis pedidos, un pedido).
 * Afiliados y empresas entran por sus paneles; quien compra, al pagar.
 */
export const Route = createFileRoute("/entrar")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    // Solo rutas internas: evita redirecciones abiertas.
    to:
      typeof s["to"] === "string" && s["to"].startsWith("/") && !s["to"].startsWith("//")
        ? s["to"]
        : undefined,
  }),
  head: () => ({ meta: [{ title: "Ingresar · Plaza X" }, { name: "robots", content: "noindex" }] }),
  component: Login,
});

function Login() {
  const { to } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useUser();

  useEffect(() => {
    if (user) navigate({ to: to ?? "/cuenta" });
  }, [user, to, navigate]);

  return (
    <Shell>
      <div className="mx-auto max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 md:p-8">
        <AuthForm role="comprador" redirectTo={to ?? "/cuenta"} />
      </div>
    </Shell>
  );
}
