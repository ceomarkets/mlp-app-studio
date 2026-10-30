import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Flame,
  Heart,
  Home,
  LogOut,
  Megaphone,
  Package,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Store as StoreIcon,
  User,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { CartSheet, openCart } from "@/components/CartSheet";
import { ShareButton } from "@/components/ShareSheet";
import { Ticker } from "@/components/Ticker";
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
import { favorites, useCart, useFavorites } from "@/lib/client-state";
import { discountPct, isNew } from "@/lib/feed";
import { compact, cop } from "@/lib/plaza";
import { keys, useUser } from "@/lib/session";
import { productShare } from "@/lib/share";
import { cn } from "@/lib/utils";

// Navegación centrada en comprar. Mi Tienda y Mi Red viven, discretas, en el
// menú de cuenta y en el pie de página.
const mobileNav = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/favoritos", label: "Favoritos", icon: Heart },
  { to: "/cuenta", label: "Pedidos", icon: Package },
] as const;

export function Shell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col pb-16 md:pb-0">
      {IS_DEMO && <DemoBanner />}
      <header className="sticky top-0 z-30 bg-background/90 shadow-[0_1px_0_var(--color-border)] backdrop-blur-md">
        <Ticker />
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 md:px-5">
          <Link to="/" className="flex items-center gap-2 font-display text-2xl font-extrabold">
            <span className="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground shadow-card">
              <Store className="size-4.5" strokeWidth={2.5} />
            </span>
            <span>
              Plaza<span className="text-primary">X</span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <Link
              to="/favoritos"
              aria-label="Favoritos"
              className="relative hidden size-9 place-items-center rounded-full hover:bg-muted md:grid"
            >
              <Heart className="size-5" />
              <FavCount />
            </Link>
            <CartSheet />
            <UserMenu />
          </div>
        </div>
      </header>
      <main
        className={cn(
          "mx-auto w-full flex-1 px-4 py-6 md:px-5 md:py-10",
          wide ? "max-w-7xl" : "max-w-6xl",
        )}
      >
        {children}
      </main>
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          <ShieldCheck className="size-4 text-primary" /> Pagos seguros con Wompi · Hecho en Pasto,
          Nariño
        </div>
        <div className="mt-3 flex items-center justify-center gap-4 text-xs">
          <Link to="/vendedores" className="hover:text-primary">
            Vende en Plaza X
          </Link>
          <span aria-hidden>·</span>
          <Link to="/afiliados" className="hover:text-primary">
            Gana recomendando
          </Link>
        </div>
      </footer>
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        {mobileNav.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            activeOptions={{ exact: n.to === "/" }}
            className="group flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold text-muted-foreground data-[status=active]:text-primary"
          >
            <span className="grid h-7 w-12 place-items-center rounded-full transition group-data-[status=active]:bg-primary/12">
              <n.icon className="size-5" />
            </span>
            {n.label}
          </Link>
        ))}
        <button
          onClick={openCart}
          className="flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold text-muted-foreground"
        >
          <span className="relative grid h-7 w-12 place-items-center rounded-full">
            <ShoppingBag className="size-5" />
            <CartCount />
          </span>
          Carrito
        </button>
      </nav>
    </div>
  );
}

function CartCount() {
  const n = useCart().reduce((t, l) => t + l.qty, 0);
  if (!n) return null;
  return (
    <span className="absolute right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
      {n}
    </span>
  );
}

function FavCount() {
  const n = useFavorites().length;
  if (!n) return null;
  return (
    <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
      {n}
    </span>
  );
}

function DemoBanner() {
  const qc = useQueryClient();
  return (
    <div className="bg-sun px-4 py-1.5 text-center text-[11px] font-semibold text-accent-foreground">
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
  const admin = useQuery({
    queryKey: keys.isAdmin,
    queryFn: () => backend.isAdmin(),
    enabled: !!user,
  });
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
        <DropdownMenuItem onSelect={() => navigate({ to: "/favoritos" })}>
          <Heart /> Favoritos
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate({ to: "/cuenta", hash: "perfil" })}>
          <User /> Perfil
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Gana con Plaza X
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => navigate({ to: "/vendedores" })}>
          <StoreIcon /> Mi tienda
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate({ to: "/afiliados" })}>
          <Users /> Mi red
        </DropdownMenuItem>
        {admin.data && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Administrar
            </DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => navigate({ to: "/admin/anuncios" })}>
              <Megaphone /> Anuncios
            </DropdownMenuItem>
          </>
        )}
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
  if (!value) return <span className="text-xs text-muted-foreground">Sin reseñas</span>;
  return (
    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
      <Star className="size-3.5 fill-sun text-sun" aria-hidden />
      <span className="font-semibold text-foreground">{value.toFixed(1)}</span>
      {count !== undefined && <span className="text-xs">({count})</span>}
    </span>
  );
}

export function FavoriteButton({ id, className }: { id: string; className?: string }) {
  const favs = useFavorites();
  const on = favs.includes(id);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "Quitar de favoritos" : "Guardar en favoritos"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const added = favorites.toggle(id);
        const el = e.currentTarget;
        el.classList.remove("animate-pop");
        void el.offsetWidth;
        el.classList.add("animate-pop");
        if (added) navigator.vibrate?.(10);
      }}
      className={cn(
        "grid size-9 place-items-center rounded-full bg-background/90 shadow-card backdrop-blur transition hover:scale-105",
        className,
      )}
    >
      <Heart
        className={cn("size-4.5 transition", on ? "fill-primary text-primary" : "text-foreground")}
      />
    </button>
  );
}

export function Price({
  p,
  size = "md",
}: {
  p: Pick<Product, "price" | "compareAtPrice">;
  size?: "md" | "lg";
}) {
  const off = discountPct(p);
  return (
    <span className="flex flex-wrap items-baseline gap-x-2">
      <span
        className={cn(
          "font-display font-bold",
          size === "lg" ? "text-4xl" : "text-lg",
          off && "text-primary",
        )}
      >
        {cop(p.price)}
      </span>
      {off > 0 && (
        <span
          className={cn(
            "text-muted-foreground line-through",
            size === "lg" ? "text-lg" : "text-xs",
          )}
        >
          {cop(p.compareAtPrice!)}
        </span>
      )}
    </span>
  );
}

export function ProductCard({
  p,
  action,
  className,
}: {
  p: Product;
  action?: ReactNode;
  className?: string;
}) {
  const low = p.stock > 0 && p.stock <= 5;
  const off = discountPct(p);
  const fresh = isNew(p);
  return (
    <div
      className={cn(
        "group flex flex-col rounded-2xl border bg-card p-2.5 shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-lg md:p-3",
        className,
      )}
    >
      <Link to="/producto/$id" params={{ id: p.id }} className="relative mb-3 block">
        <ProductImage
          p={p}
          className="transition duration-300 group-hover:bg-secondary [&_img]:transition [&_img]:duration-500 group-hover:[&_img]:scale-105"
        />
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          {off > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-extrabold text-primary-foreground shadow-card">
              −{off}%
            </span>
          )}
          {fresh && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sun px-2 py-0.5 text-xs font-bold text-accent-foreground shadow-card">
              <Sparkles className="size-3" /> Nuevo
            </span>
          )}
          {p.stock === 0 && (
            <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-bold text-ink-foreground">
              Agotado
            </span>
          )}
          {low && (
            <span className="rounded-full bg-background/90 px-2 py-0.5 text-xs font-bold text-destructive shadow-card">
              ¡Quedan {p.stock}!
            </span>
          )}
        </div>
        <div className="absolute right-2 top-2 flex flex-col gap-1.5">
          <FavoriteButton id={p.id} />
          <ShareButton
            data={() => productShare(p)}
            className="grid size-9 place-items-center rounded-full bg-background/90 opacity-100 shadow-card backdrop-blur transition hover:scale-105 md:opacity-0 md:group-hover:opacity-100"
          />
        </div>
      </Link>
      <Link
        to="/tienda/$slug"
        params={{ slug: p.store.slug }}
        className="truncate px-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-primary"
      >
        {p.store.name}
      </Link>
      <Link
        to="/producto/$id"
        params={{ id: p.id }}
        className="mt-0.5 line-clamp-2 px-0.5 text-sm font-semibold leading-tight hover:text-primary md:text-base"
      >
        {p.name}
      </Link>
      <div className="mt-1.5 px-0.5">
        <Price p={p} />
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 px-0.5 text-xs text-muted-foreground">
        <Stars value={p.rating} />
        {p.soldCount > 0 && (
          <span className="inline-flex items-center gap-0.5">
            <Flame className="size-3 text-primary" /> {compact(p.soldCount)} vendidos
          </span>
        )}
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
