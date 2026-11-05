import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthForm } from "@/components/AuthDialog";
import { Shell } from "@/components/Shell";
import { roleOf, ROLES } from "@/lib/roles";
import { useUser } from "@/lib/session";

type Search = { to?: string | undefined; registro?: 1 | 2 | 3 | undefined };

export const Route = createFileRoute("/entrar")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    // Solo rutas internas: evita redirecciones abiertas.
    to:
      typeof s["to"] === "string" && s["to"].startsWith("/") && !s["to"].startsWith("//")
        ? s["to"]
        : undefined,
    // ?registro=1|2|3 abre el registro con ese tipo de cuenta.
    registro: [1, 2, 3].includes(Number(s["registro"]))
      ? (Number(s["registro"]) as 1 | 2 | 3)
      : undefined,
  }),
  head: () => ({ meta: [{ title: "Entrar · Plaza X" }, { name: "robots", content: "noindex" }] }),
  component: Login,
});

function Login() {
  const { to, registro } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useUser();
  const role = ROLES.find((r) => r.n === registro);

  useEffect(() => {
    // Ya con sesión: a donde iba, o al espacio de su tipo de cuenta.
    if (user) navigate({ to: to ?? roleOf(user.accountType).home ?? "/" });
  }, [user, to, navigate]);

  return (
    <Shell>
      <div className="mx-auto grid max-w-4xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 md:grid-cols-2">
        <div className="hidden flex-col justify-between border-r border-slate-800 bg-slate-950 p-10 md:flex">
          <div>
            <p className="text-xs font-bold tracking-wider text-slate-500 uppercase">
              Registro general
            </p>
            <h2 className="mt-2 text-3xl leading-tight font-extrabold text-white">
              Una cuenta,
              <br />
              <span className="gold-gradient-text">tres formas de usarla.</span>
            </h2>
          </div>
          <ol className="space-y-4 text-sm">
            {ROLES.map((r) => (
              <li key={r.id} className="flex items-start gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-slate-700 text-xs font-black text-slate-300">
                  {r.n}
                </span>
                <span>
                  <b className="block text-white">{r.label}</b>
                  <span className="text-slate-400">{r.short}</span>
                </span>
              </li>
            ))}
          </ol>
          <Link to="/legal" className="text-xs text-slate-500 hover:text-slate-300">
            Al continuar aceptas los Términos y Condiciones de Plaza X.
          </Link>
        </div>
        <div className="p-6 md:p-10">
          <AuthForm
            key={registro ?? 0}
            redirectTo={to}
            initialMode={role ? "signup" : "login"}
            initialRole={role?.id ?? "comprador"}
          />
        </div>
      </div>
    </Shell>
  );
}
