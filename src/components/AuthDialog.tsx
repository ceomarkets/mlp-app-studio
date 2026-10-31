import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { backend, IS_DEMO } from "@/lib/backend";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/backend/seed";
import { PAYOUT_METHODS, type PayoutMethod } from "@/lib/plaza";
import { keys } from "@/lib/session";
import { authUI } from "@/lib/ui-state";
import { cn } from "@/lib/utils";

type Role = "comprador" | "afiliado" | "empresa";

/** Nombre comercial elegido al registrarse como empresa (prellena el formulario de tienda). */
export const COMPANY_NAME_KEY = "plazax-company-name";
type Mode = "login" | "signup" | "reset";

const input =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none";

/**
 * Formulario "Unirse a Plaza X": elige rol (afiliado o empresa), correo y
 * contraseña. Al entrar lleva al panel del rol elegido (o a `redirectTo`).
 */
export function AuthForm({
  redirectTo,
  onDone,
}: {
  redirectTo?: string | undefined;
  onDone?: () => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>("comprador");
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ email: "", password: "", name: "", company: "" });
  const [payout, setPayout] = useState<PayoutMethod>("nequi");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "reset") {
        await backend.resetPassword(f.email);
        toast.success("Te enviamos un enlace para restablecer tu contraseña");
        setMode("login");
        return;
      }
      if (mode === "signup") {
        const name = f.name.trim() || f.email.split("@")[0] || "";
        const { needsConfirmation } = await backend.signUp({
          email: f.email,
          password: f.password,
          fullName: name,
          accountType: role,
          payoutMethod: role === "afiliado" ? payout : null,
        });
        if (role === "empresa" && f.company.trim()) {
          try {
            sessionStorage.setItem(COMPANY_NAME_KEY, f.company.trim());
          } catch {
            /* sin almacenamiento */
          }
        }
        if (needsConfirmation) {
          toast.success("¡Cuenta creada! Revisa tu correo para confirmarla.");
          setMode("login");
          return;
        }
      } else {
        await backend.signIn({ email: f.email, password: f.password });
      }
      await qc.invalidateQueries({ queryKey: keys.me });
      toast.success("¡Sesión iniciada con éxito!");
      onDone?.();
      const home = role === "empresa" ? "/vendedores" : role === "afiliado" ? "/afiliados" : null;
      if (redirectTo ?? home) navigate({ to: redirectTo ?? home! });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const ROLES: { id: Role; label: string; icon: string }[] = [
    { id: "comprador", label: "Comprador", icon: "fa-bag-shopping" },
    { id: "afiliado", label: "Afiliado", icon: "fa-users" },
    { id: "empresa", label: "Empresa", icon: "fa-building" },
  ];

  return (
    <div>
      <h3 className="mb-1 text-xl font-bold text-slate-900">
        {mode === "signup" ? "Crea tu cuenta" : "Bienvenido a Plaza X"}
      </h3>
      <p className="mb-5 text-xs text-slate-500">¿Cómo quieres usar la plataforma?</p>

      <div
        role="radiogroup"
        aria-label="Tipo de cuenta"
        className="mb-6 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 text-xs font-bold"
      >
        {ROLES.map((r) => (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={role === r.id}
            onClick={() => setRole(r.id)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg py-2 transition",
              role === r.id
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            <i className={cn("fa-solid", r.icon)} /> {r.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4">
        {mode === "signup" && role === "afiliado" && (
          <div>
            <label htmlFor="auth-pay" className="mb-1 block text-xs font-semibold text-slate-600">
              Método de cobro preferido
            </label>
            <select
              id="auth-pay"
              value={payout}
              onChange={(e) => setPayout(e.target.value as PayoutMethod)}
              className={input}
            >
              {PAYOUT_METHODS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {mode === "signup" && role === "empresa" && (
          <div>
            <label htmlFor="auth-co" className="mb-1 block text-xs font-semibold text-slate-600">
              Nombre comercial de la empresa
            </label>
            <input
              id="auth-co"
              placeholder="Ej.: Moda & Estilo SAS"
              maxLength={60}
              value={f.company}
              onChange={(e) => setF({ ...f, company: e.target.value })}
              className={input}
            />
          </div>
        )}
        {mode === "signup" && (
          <div>
            <label htmlFor="auth-name" className="mb-1 block text-xs font-semibold text-slate-600">
              Nombre
            </label>
            <input
              id="auth-name"
              autoComplete="name"
              placeholder="Tu nombre"
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              className={input}
            />
          </div>
        )}
        <div>
          <label htmlFor="auth-email" className="mb-1 block text-xs font-semibold text-slate-600">
            Correo Electrónico
          </label>
          <input
            id="auth-email"
            type="email"
            required
            autoComplete="email"
            placeholder="tu@email.com"
            value={f.email}
            onChange={(e) => setF({ ...f, email: e.target.value })}
            className={input}
          />
        </div>
        {mode !== "reset" && (
          <div>
            <label htmlFor="auth-pass" className="mb-1 block text-xs font-semibold text-slate-600">
              Contraseña
            </label>
            <input
              id="auth-pass"
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              placeholder="••••••••"
              value={f.password}
              onChange={(e) => setF({ ...f, password: e.target.value })}
              className={input}
            />
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 disabled:opacity-60"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          {mode === "login" ? "Ingresar" : mode === "signup" ? "Registrarme" : "Enviar enlace"}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <button
          type="button"
          className="font-semibold text-indigo-600 hover:text-indigo-600"
          onClick={() => setMode(mode === "signup" ? "login" : "signup")}
        >
          {mode === "signup" ? "¿Ya tienes cuenta? Ingresa" : "¿Nuevo? Crea tu cuenta gratis"}
        </button>
        {mode === "login" && (
          <button type="button" className="hover:text-slate-800" onClick={() => setMode("reset")}>
            ¿Olvidaste tu contraseña?
          </button>
        )}
      </div>
      {IS_DEMO && mode === "login" && (
        <button
          type="button"
          onClick={() => setF({ ...f, email: DEMO_EMAIL, password: DEMO_PASSWORD })}
          className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 py-2 text-xs text-slate-600 hover:border-indigo-200"
        >
          Usar la cuenta demo
        </button>
      )}
    </div>
  );
}

export const openAuth = authUI.open;

export function AuthDialog() {
  const open = authUI.use();
  return (
    <Dialog open={open} onOpenChange={authUI.set}>
      <DialogContent className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl [&>button]:text-slate-500">
        <DialogTitle className="sr-only">Unirse a Plaza X</DialogTitle>
        <DialogDescription className="sr-only">Inicia sesión o crea tu cuenta</DialogDescription>
        <AuthForm onDone={authUI.close} />
      </DialogContent>
    </Dialog>
  );
}
