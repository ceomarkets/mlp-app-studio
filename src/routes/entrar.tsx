import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { backend, IS_DEMO } from "@/lib/backend";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/backend/seed";
import { keys, useUser } from "@/lib/session";

type Search = { to?: string | undefined };

export const Route = createFileRoute("/entrar")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    // Solo rutas internas: evita redirecciones abiertas.
    to:
      typeof s["to"] === "string" && s["to"].startsWith("/") && !s["to"].startsWith("//")
        ? s["to"]
        : undefined,
  }),
  head: () => ({ meta: [{ title: "Entrar · Plaza X" }, { name: "robots", content: "noindex" }] }),
  component: Login,
});

type Mode = "login" | "signup" | "reset";

function Login() {
  const { to } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useUser();
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  useEffect(() => {
    if (user) navigate({ to: to ?? "/" });
  }, [user, to, navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "reset") {
        await backend.resetPassword(form.email);
        toast.success("Te enviamos un enlace para restablecer tu contraseña");
        setMode("login");
        return;
      }
      if (mode === "signup") {
        if (form.name.trim().length < 2) throw new Error("Escribe tu nombre");
        const { needsConfirmation } = await backend.signUp({
          email: form.email,
          password: form.password,
          fullName: form.name.trim(),
        });
        if (needsConfirmation) {
          toast.success("¡Cuenta creada! Revisa tu correo para confirmarla.");
          setMode("login");
          return;
        }
      } else {
        await backend.signIn({ email: form.email, password: form.password });
      }
      await qc.invalidateQueries({ queryKey: keys.me });
      toast.success(mode === "signup" ? "¡Bienvenido a Plaza X!" : "Sesión iniciada");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<Mode, [string, string]> = {
    login: ["Hola de nuevo", "Entra para comprar, vender o cobrar tus comisiones."],
    signup: [
      "Crea tu cuenta",
      "Una sola cuenta para comprar, abrir tu tienda y ganar como afiliado.",
    ],
    reset: ["Recupera tu acceso", "Te enviaremos un enlace a tu correo."],
  };

  return (
    <Shell>
      <div className="mx-auto grid max-w-4xl overflow-hidden rounded-3xl border bg-card shadow-card md:grid-cols-2">
        <div className="hidden flex-col justify-between bg-ink p-10 text-ink-foreground md:flex">
          <div className="font-display text-3xl font-extrabold leading-tight">
            Tu tienda,
            <br />
            tu red,
            <br />
            <span className="text-sun">tus ganancias.</span>
          </div>
          <ul className="space-y-3 text-sm opacity-90">
            <li>🛒 Compra a tiendas locales con pago seguro</li>
            <li>🏪 Abre tu tienda sin pagos por adelantado</li>
            <li>🔗 Comparte enlaces y gana hasta 20% por venta</li>
          </ul>
        </div>
        <form onSubmit={submit} className="space-y-4 p-6 md:p-10">
          <div>
            <h1 className="text-3xl font-extrabold">{titles[mode][0]}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{titles[mode][1]}</p>
          </div>
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre completo</Label>
              <Input
                id="name"
                autoComplete="name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          {mode !== "reset" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contraseña</Label>
                {mode === "login" && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => setMode("reset")}
                  >
                    ¿La olvidaste?
                  </button>
                )}
              </div>
              <Input
                id="password"
                type="password"
                minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {mode === "login" ? "Entrar" : mode === "signup" ? "Crear cuenta" : "Enviar enlace"}
          </Button>
          {IS_DEMO && mode === "login" && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setForm({ ...form, email: DEMO_EMAIL, password: DEMO_PASSWORD })}
            >
              Usar la cuenta demo (vendedora y afiliada)
            </Button>
          )}
          <p className="text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                ¿No tienes cuenta?{" "}
                <button
                  type="button"
                  className="font-semibold text-primary hover:underline"
                  onClick={() => setMode("signup")}
                >
                  Regístrate gratis
                </button>
              </>
            ) : (
              <>
                ¿Ya tienes cuenta?{" "}
                <button
                  type="button"
                  className="font-semibold text-primary hover:underline"
                  onClick={() => setMode("login")}
                >
                  Entra
                </button>
              </>
            )}
          </p>
          <p className="text-center text-xs text-muted-foreground">
            Al continuar aceptas los términos de Plaza X.{" "}
            <Link to="/" className="underline">
              Volver a la plaza
            </Link>
          </p>
        </form>
      </div>
    </Shell>
  );
}
