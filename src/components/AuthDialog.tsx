import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { backend, IS_DEMO } from "@/lib/backend";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/backend/seed";
import { keys } from "@/lib/session";
import { authUI } from "@/lib/ui-state";
import { cn } from "@/lib/utils";

type Role = "afiliado" | "empresa";
type Mode = "login" | "signup" | "reset";

const input =
  "w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none";

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
  const [role, setRole] = useState<Role>("afiliado");
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ email: "", password: "", name: "" });

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
        });
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
      navigate({ to: redirectTo ?? (role === "empresa" ? "/vendedores" : "/afiliados") });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const roleBtn = (r: Role, icon: string, title: string, sub: string) => (
    <button
      type="button"
      onClick={() => setRole(r)}
      aria-pressed={role === r}
      className={cn(
        "rounded-xl p-3 text-left",
        role === r
          ? "border-2 border-indigo-500 bg-indigo-500/10"
          : "border border-slate-800 bg-slate-950",
      )}
    >
      <i className={cn("fa-solid mb-1 block text-lg text-indigo-400", icon)} />
      <span className="block text-xs font-bold text-white">{title}</span>
      <span className="text-[10px] text-slate-400">{sub}</span>
    </button>
  );

  return (
    <div>
      <h3 className="mb-1 text-xl font-bold text-white">Unirse a Plaza X</h3>
      <p className="mb-6 text-xs text-slate-400">
        Selecciona cómo deseas participar en la plataforma:
      </p>

      <div className="mb-6 grid grid-cols-2 gap-3">
        {roleBtn("afiliado", "fa-user-ninja", "Soy Afiliado", "Promociono productos")}
        {roleBtn("empresa", "fa-building", "Soy Empresa", "Subo mis productos")}
      </div>

      <form onSubmit={submit} className="space-y-4">
        {mode === "signup" && (
          <div>
            <label htmlFor="auth-name" className="mb-1 block text-xs font-semibold text-slate-300">
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
          <label htmlFor="auth-email" className="mb-1 block text-xs font-semibold text-slate-300">
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
            <label htmlFor="auth-pass" className="mb-1 block text-xs font-semibold text-slate-300">
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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <button
          type="button"
          className="font-semibold text-indigo-400 hover:text-indigo-300"
          onClick={() => setMode(mode === "signup" ? "login" : "signup")}
        >
          {mode === "signup" ? "¿Ya tienes cuenta? Ingresa" : "¿Nuevo? Crea tu cuenta gratis"}
        </button>
        {mode === "login" && (
          <button type="button" className="hover:text-slate-200" onClick={() => setMode("reset")}>
            ¿Olvidaste tu contraseña?
          </button>
        )}
      </div>
      {IS_DEMO && mode === "login" && (
        <button
          type="button"
          onClick={() => setF({ ...f, email: DEMO_EMAIL, password: DEMO_PASSWORD })}
          className="mt-3 w-full rounded-lg border border-slate-800 bg-slate-950 py-2 text-xs text-slate-300 hover:border-indigo-500/50"
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
      <DialogContent className="max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-2xl [&>button]:text-slate-400">
        <DialogTitle className="sr-only">Unirse a Plaza X</DialogTitle>
        <DialogDescription className="sr-only">Inicia sesión o crea tu cuenta</DialogDescription>
        <AuthForm onDone={authUI.close} />
      </DialogContent>
    </Dialog>
  );
}
