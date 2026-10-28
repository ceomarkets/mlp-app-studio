import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BadgePercent, Flame, ShoppingBag, Sparkles, Timer, type LucideIcon } from "lucide-react";
import { useMemo } from "react";
import { backend } from "@/lib/backend";
import { buildTicker, type TickerItem, type TickerKind } from "@/lib/feed";
import { keys } from "@/lib/session";
import { cn } from "@/lib/utils";

const KIND: Record<TickerKind, { icon: LucideIcon; tone: string; label: string }> = {
  deal: { icon: BadgePercent, tone: "text-[oklch(0.86_0.17_150)]", label: "Oferta" },
  sale: { icon: ShoppingBag, tone: "text-[oklch(0.86_0.17_150)]", label: "Venta" },
  new: { icon: Sparkles, tone: "text-sun", label: "Nuevo" },
  hot: { icon: Flame, tone: "text-[oklch(0.78_0.17_45)]", label: "Tendencia" },
  low: { icon: Timer, tone: "text-[oklch(0.8_0.14_25)]", label: "Últimas" },
};

/**
 * Banda de cotizaciones de la cabecera: promociones, novedades, tendencias y
 * ventas en vivo, en movimiento continuo como una pizarra de bolsa.
 * Se pausa al pasar el mouse o con el foco, y respeta "reducir movimiento".
 */
export function Ticker() {
  const products = useQuery({ queryKey: keys.products({}), queryFn: () => backend.listProducts() });
  const activity = useQuery({
    queryKey: ["catalog", "activity"],
    queryFn: () => backend.recentActivity(),
    refetchInterval: 60_000,
  });
  const items = useMemo(
    () => buildTicker(products.data ?? [], activity.data ?? []),
    [products.data, activity.data],
  );

  if (!items.length) return <div className="h-9 bg-ink" aria-hidden />;
  // Velocidad constante sin importar cuántos elementos haya (~3,5 s por elemento).
  const duration = `${Math.max(30, items.length * 3.5)}s`;

  return (
    <div className="ticker relative flex h-9 items-center overflow-hidden bg-ink text-ink-foreground">
      <div className="z-10 flex h-full shrink-0 items-center gap-1.5 bg-primary px-3 text-[11px] font-extrabold uppercase tracking-wider text-primary-foreground shadow-[6px_0_12px_-4px_rgb(0_0_0/0.4)]">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary-foreground opacity-75 motion-reduce:hidden" />
          <span className="relative inline-flex size-2 rounded-full bg-primary-foreground" />
        </span>
        En vivo
      </div>
      <div className="ticker-mask relative flex-1 overflow-hidden motion-reduce:overflow-x-auto">
        <div className="ticker-track flex w-max" style={{ animationDuration: duration }}>
          {[0, 1].map((copy) => (
            <ul key={copy} className="flex shrink-0" aria-hidden={copy === 1 || undefined}>
              {items.map((it) => (
                <TickerEntry key={`${copy}-${it.key}`} it={it} tabbable={copy === 0} />
              ))}
            </ul>
          ))}
        </div>
      </div>
    </div>
  );
}

function TickerEntry({ it, tabbable }: { it: TickerItem; tabbable: boolean }) {
  const k = KIND[it.kind];
  const Icon = k.icon;
  return (
    <li className="flex items-center border-r border-ink-foreground/10">
      <Link
        to="/producto/$id"
        params={{ id: it.productId }}
        tabIndex={tabbable ? 0 : -1}
        title={`${k.label}: ${it.name}`}
        className="flex items-center gap-2 whitespace-nowrap px-4 text-xs transition hover:bg-ink-foreground/10 focus-visible:bg-ink-foreground/10 focus-visible:outline-none"
      >
        <Icon className={cn("size-3.5", k.tone)} aria-hidden />
        <span className="font-mono font-bold tracking-wide">{it.symbol}</span>
        <span className="max-w-[16ch] truncate opacity-75">{it.name}</span>
        <span className="font-semibold">{it.value}</span>
        <span className={cn("font-mono font-bold", k.tone)}>{it.change}</span>
      </Link>
    </li>
  );
}
