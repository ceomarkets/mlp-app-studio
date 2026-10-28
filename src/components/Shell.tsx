import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cop, type Product, storeBy } from "@/lib/plaza";

const nav = [
  { to: "/", label: "Plaza" },
  { to: "/afiliados", label: "Mi Red" },
  { to: "/vendedores", label: "Mi Tienda" },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link to="/" className="font-display text-2xl font-extrabold">
            Plaza<span className="text-primary">X</span>
          </Link>
          <nav className="flex gap-1 text-sm font-semibold">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} activeOptions={{ exact: true }}
                className="rounded-full px-4 py-2 text-muted-foreground transition hover:text-foreground data-[status=active]:bg-ink data-[status=active]:text-ink-foreground">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10">{children}</main>
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        Plaza X · Hecho en Pasto, Nariño · Tu tienda, tu red, tus ganancias
      </footer>
    </div>
  );
}

export function ProductCard({ p, action }: { p: Product; action?: ReactNode }) {
  const s = storeBy(p.store)!;
  return (
    <div className="group flex flex-col rounded-2xl border bg-card p-4 shadow-card transition hover:-translate-y-1">
      <div className="mb-4 grid aspect-square place-items-center rounded-xl bg-muted text-6xl transition group-hover:bg-secondary">{p.emoji}</div>
      <Link to="/tienda/$slug" params={{ slug: s.slug }} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-primary">{s.name}</Link>
      <h3 className="mt-1 font-semibold leading-tight">{p.name}</h3>
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="font-display text-lg font-bold">{cop(p.price)}</span>
        <span className="text-muted-foreground">★ {p.rating}</span>
      </div>
      <div className="mt-auto pt-3">{action}</div>
    </div>
  );
}
