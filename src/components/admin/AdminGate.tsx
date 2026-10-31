import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { Empty, Shell } from "@/components/Shell";
import { backend } from "@/lib/backend";
import { keys, useRequireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { to: "/admin/anuncios", label: "Anuncios", icon: "fa-bullhorn" },
  { to: "/admin/disputas", label: "Disputas", icon: "fa-shield-halved" },
  { to: "/admin/tiendas", label: "Tiendas", icon: "fa-store" },
  { to: "/admin/promos", label: "Flash y cupones", icon: "fa-bolt" },
] as const;

/** Solo administración: pide sesión y permiso, y muestra la navegación del panel. */
export function AdminGate({ path, children }: { path: string; children: ReactNode }) {
  const { user } = useRequireUser(path);
  const admin = useQuery({
    queryKey: keys.isAdmin,
    queryFn: () => backend.isAdmin(),
    enabled: !!user,
  });
  if (!user || admin.isPending)
    return <Shell>{<div className="h-64 animate-pulse rounded-3xl bg-slate-200" />}</Shell>;
  if (!admin.data)
    return (
      <Shell>
        <Empty icon={<Lock />} title="Solo para administradores">
          Pide a quien administra Plaza X que te dé acceso.{" "}
          <Link to="/" className="font-semibold text-primary">
            Volver a la plaza
          </Link>
        </Empty>
      </Shell>
    );
  return (
    <Shell wide>
      <nav aria-label="Administración" className="mb-6 flex flex-wrap gap-2 text-xs">
        {SECTIONS.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className={cn(
              "flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 transition hover:bg-slate-50",
              "data-[status=active]:border-indigo-600 data-[status=active]:bg-indigo-600 data-[status=active]:text-white",
            )}
          >
            <i className={cn("fa-solid", s.icon)} /> {s.label}
          </Link>
        ))}
      </nav>
      {children}
    </Shell>
  );
}
