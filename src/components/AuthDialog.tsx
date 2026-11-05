import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "@/components/icons";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { backend, IS_DEMO, type AccountType } from "@/lib/backend";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/backend/seed";
import { PAYOUT_METHODS, type PayoutMethod } from "@/lib/plaza";
import { keys } from "@/lib/session";
import { authUI } from "@/lib/ui-state";
import { cn } from "@/lib/utils";

type Role = AccountType;

/** Nombre comercial elegido al registrarse como empresa (prellena el formulario de tienda). */
export const COMPANY_NAME_KEY = "plazax-company-name";
export type Mode = "login" | "signup" | "reset";

const input =
  "w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none";

/** Textos de cada puerta de entrada: el rol lo decide dónde entra la persona. */
const COPY: Record<Role, { signup: [string, string]; login: [string, string] }> = {
  comprador: {
    signup: [
      "Crea tu cuenta para pagar",
      "Tu carrito queda intacto. Solo te pedimos lo necesario.",
    ],
    login: ["Ingresa para pagar", "Tu carrito queda intacto y sigues al pago."],
  },
  afiliado: {
    signup: ["Únete como afiliado", "Recomienda productos y gana comisión por cada venta."],
    login: ["Panel de afiliados", "Ingresa para ver tus enlaces, clics y comisiones."],
  },
  empresa: {
    signup: ["Abre tu tienda", "Para empresas y emprendimientos. Sin pagos por adelantado."],
    login: ["Panel de empresas", "Ingresa para gestionar tu tienda, pedidos y saldo."],
  },
};

/**
 * Formulario de registro e ingreso. No hay selector de rol: el rol lo fija la puerta
 * de entrada (pago → comprador, Panel Afiliados → afiliado, Panel Empresas → empresa).
 */
export function AuthForm({
  role,
  redirectTo,
  onDone,
  initialMode = "login",
}: {
  role: Role;
  redirectTo?: string | undefined;
  /** Se llama con la sesión ya abierta (por ejemplo, para seguir al pago). */
  onDone?: () => void;
  initialMode?: Mode;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(initialMode);
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
      toast.success(mode === "signup" ? "¡Listo! Cuenta creada" : "¡Hola de nuevo!");
      onDone?.();
      if (redirectTo) navigate({ to: redirectTo });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h3 className="mb-1 text-xl font-bold text-white">
        {(mode === "signup" ? COPY[role].signup : COPY[role].login)[0]}
      </h3>
      <p className="mb-5 text-xs text-slate-400">
        {mode === "reset"
          ? "Te enviaremos un enlace a tu correo."
          : (mode === "signup" ? COPY[role].signup : COPY[role].login)[1]}
      </p>

      <form onSubmit={submit} className="space-y-4">
        {mode === "signup" && role === "afiliado" && (
          <div>
            <label htmlFor="auth-pay" className="mb-1 block text-xs font-semibold text-slate-300">
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
            <label htmlFor="auth-co" className="mb-1 block text-xs font-semibold text-slate-300">
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
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-500/30 transition hover:bg-amber-400 disabled:opacity-60"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          {mode === "login" ? "Ingresar" : mode === "signup" ? "Registrarme" : "Enviar enlace"}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <button
          type="button"
          className="font-semibold text-amber-400 hover:text-amber-400"
          onClick={() => setMode(mode === "signup" ? "login" : "signup")}
        >
          {mode === "signup" ? "¿Ya tienes cuenta? Ingresa" : "¿Nuevo? Crea tu cuenta gratis"}
        </button>
        {mode === "login" && (
          <button type="button" className="hover:text-white" onClick={() => setMode("reset")}>
            ¿Olvidaste tu contraseña?
          </button>
        )}
      </div>
      {IS_DEMO && mode === "login" && (
        <button
          type="button"
          onClick={() => setF({ ...f, email: DEMO_EMAIL, password: DEMO_PASSWORD })}
          className="mt-3 w-full rounded-lg border border-slate-800 bg-slate-950 py-2 text-xs text-slate-300 hover:border-amber-400"
        >
          Usar la cuenta demo
        </button>
      )}
    </div>
  );
}

/* La ventana se abre solo para pagar: comprador, en el modo que se pida. */
let intent: { mode: Mode; n: number; onDone?: (() => void) | undefined } = { mode: "signup", n: 0 };
const intentSubs = new Set<() => void>();
const useIntent = () =>
  useSyncExternalStore(
    (fn) => {
      intentSubs.add(fn);
      return () => intentSubs.delete(fn);
    },
    () => intent,
    () => intent,
  );

/** Pide cuenta para pagar; `onDone` corre con la sesión abierta (p. ej. seguir al pago). */
export function openAuth(opts?: { mode?: Mode; onDone?: () => void }) {
  intent = { mode: opts?.mode ?? "signup", n: intent.n + 1, onDone: opts?.onDone };
  intentSubs.forEach((f) => f());
  authUI.open();
}

export function AuthDialog() {
  const open = authUI.use();
  const it = useIntent();
  return (
    <Dialog open={open} onOpenChange={authUI.set}>
      <DialogContent className="max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-white shadow-2xl [&>button]:text-slate-500">
        <DialogTitle className="sr-only">Unirse a Plaza X</DialogTitle>
        <DialogDescription className="sr-only">Inicia sesión o crea tu cuenta</DialogDescription>
        <AuthForm
          key={it.n}
          role="comprador"
          initialMode={it.mode}
          onDone={() => {
            authUI.close();
            it.onDone?.();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
