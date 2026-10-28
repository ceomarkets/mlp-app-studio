import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Package, ShoppingBag, Store as StoreIcon, User, Users } from "lucide-react";
import type { ReactNode } from "react";
import { CartSheet } from "@/components/CartSheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { backend, IS_DEMO, type Product } from "@/lib/backend";
import { resetDemo } from "@/lib/backend/demo";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/backend/seed";
import { cop } from "@/lib/plaza";
import { useUser } from "@/lib/session";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Plaza" },
  { to: "/afiliados", label: "Mi Red" },
  { to: "/vendedores", label: "Mi Tienda" },
] as const;

export function Shell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col">
      {IS_DEMO && <DemoBanner />}
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-5">
          <Link to="/" className="font-display text-2xl font-extrabold">
            Plaza<span className="text-primary">X</span>
          </Link>
          <nav className="hidden gap-1 text-sm font-semibold md:flex">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.to === "/" }}
                className="rounded-full px-4 py-2 text-muted-foreground transition hover:text-foreground data-[status=active]:bg-ink data-[status=active]:text-ink-foreground"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <CartSheet />
            <UserMenu />
          </div>
        </div>
        <nav className="flex justify-around border-t text-xs font-semibold md:hidden">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              className="flex-1 py-2.5 text-center text-muted-foreground data-[status=active]:text-primary"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main
        className={cn(
          "mx-auto w-full flex-1 px-4 py-8 md:px-5 md:py-10",
          wide ? "max-w-7xl" : "max-w-6xl",
        )}
      >
        {children}
      </main>
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        Plaza X · Hecho en Pasto, Nariño · Pagos seguros con Wompi
      </footer>
    </div>
  );
}

function DemoBanner() {
  const qc = useQueryClient();
  return (
    <div className="bg-sun px-4 py-2 text-center text-xs font-semibold text-accent-foreground">
      Modo demo: los datos viven en este navegador. Entra con <b>{DEMO_EMAIL}</b> /{" "}
      <b>{DEMO_PASSWORD}</b> ·{" "}
      <button
        className="underline underline-offset-2"
        onClick={() => {
          resetDemo();
          qc.clear();
          location.assign("/");
        }}
      >
        Reiniciar datos
      </button>
    </div>
  );
}

function UserMenu() {
  const { user, loading } = useUser();
  const navigate = useNavigate();
  if (loading) return <div className="size-9" />;
  if (!user)
    return (
      <Button asChild size="sm" className="rounded-full">
        <Link to="/entrar" search={{ to: undefined }}>
          Entrar
        </Link>
      </Button>
    );
  const initials = (user.fullName || user.email)
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="grid size-9 place-items-center rounded-full bg-ink text-xs font-bold text-ink-foreground"
          aria-label="Mi cuenta"
        >
          {initials}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="font-semibold">{user.fullName || "Mi cuenta"}</div>
          <div className="truncate text-xs text-muted-foreground">{user.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate({ to: "/cuenta" })}>
          <Package /> Mis pedidos
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate({ to: "/vendedores" })}>
          <StoreIcon /> Mi tienda
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate({ to: "/afiliados" })}>
          <Users /> Mi red de afiliado
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate({ to: "/cuenta", hash: "perfil" })}>
          <User /> Perfil
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await backend.signOut();
            navigate({ to: "/" });
          }}
        >
          <LogOut /> Salir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ProductImage({
  p,
  className,
}: {
  p: Pick<Product, "images" | "emoji" | "name">;
  className?: string;
}) {
  const src = p.images[0];
  return (
    <div
      className={cn(
        "grid aspect-square place-items-center overflow-hidden rounded-xl bg-muted text-6xl",
        className,
      )}
    >
      {src ? (
        <img src={src} alt={p.name} loading="lazy" className="size-full object-cover" />
      ) : (
        <span aria-hidden>{p.emoji}</span>
      )}
    </div>
  );
}

export function Stars({ value, count }: { value: number; count?: number }) {
  if (!value) return <span className="text-xs text-muted-foreground">Nuevo</span>;
  return (
    <span className="text-sm text-muted-foreground">
      <span className="text-sun">★</span> {value.toFixed(1)}
      {count !== undefined && <span className="text-xs"> ({count})</span>}
    </span>
  );
}

export function ProductCard({ p, action }: { p: Product; action?: ReactNode }) {
  const low = p.stock > 0 && p.stock <= 5;
  return (
    <div className="group flex flex-col rounded-2xl border bg-card p-3 shadow-card transition hover:-translate-y-1 md:p-4">
      <Link to="/producto/$id" params={{ id: p.id }} className="relative mb-3 block">
        <ProductImage p={p} className="transition group-hover:bg-secondary" />
        {p.stock === 0 && (
          <span className="absolute left-2 top-2 rounded-full bg-ink px-2 py-0.5 text-xs font-bold text-ink-foreground">
            Agotado
          </span>
        )}
        {low && (
          <span className="absolute left-2 top-2 rounded-full bg-sun px-2 py-0.5 text-xs font-bold text-accent-foreground">
            ¡Quedan {p.stock}!
          </span>
        )}
      </Link>
      <Link
        to="/tienda/$slug"
        params={{ slug: p.store.slug }}
        className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-primary"
      >
        {p.store.name}
      </Link>
      <Link
        to="/producto/$id"
        params={{ id: p.id }}
        className="mt-1 line-clamp-2 font-semibold leading-tight hover:text-primary"
      >
        {p.name}
      </Link>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="font-display text-lg font-bold">{cop(p.price)}</span>
        <Stars value={p.rating} />
      </div>
      {action && <div className="mt-auto pt-3">{action}</div>}
    </div>
  );
}

export function ProductGridSkeleton({ n = 8 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="rounded-2xl border bg-card p-4">
          <div className="aspect-square animate-pulse rounded-xl bg-muted" />
          <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function Empty({
  icon = <ShoppingBag />,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed bg-card/50 px-6 py-14 text-center">
      <div className="mb-3 grid size-12 place-items-center rounded-full bg-muted text-muted-foreground [&_svg]:size-6">
        {icon}
      </div>
      <h3 className="text-lg font-bold">{title}</h3>
      {children && <div className="mt-2 max-w-sm text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "card",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "card" | "ink" | "primary";
}) {
  const tones = {
    card: "border bg-card",
    ink: "bg-ink text-ink-foreground",
    primary: "bg-primary text-primary-foreground",
  };
  return (
    <div className={cn("rounded-2xl p-4 shadow-card md:p-5", tones[tone])}>
      <div
        className={cn(
          "text-xs md:text-sm",
          tone === "card" ? "text-muted-foreground" : "opacity-80",
        )}
      >
        {label}
      </div>
      <div className="mt-1 font-display text-xl font-bold md:text-2xl">{value}</div>
      {hint && (
        <div
          className={cn("mt-1 text-xs", tone === "card" ? "text-muted-foreground" : "opacity-75")}
        >
          {hint}
        </div>
      )}
    </div>
  );
}
