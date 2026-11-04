import { cn } from "@/lib/utils";

/** Estado de inventario del diseño: Agotado / ¡Últimas N unids! / N unidades disponibles. */
export function StockBadge({ stock, className }: { stock: number; className?: string }) {
  if (stock <= 0)
    return (
      <span
        className={cn(
          "inline-block w-full rounded-md border border-rose-500/30 bg-rose-500/15 px-3 py-1 text-center text-[11px] font-bold text-rose-400",
          className,
        )}
      >
        Agotado
      </span>
    );
  if (stock <= 5)
    return (
      <span
        className={cn(
          "inline-block w-full animate-pulse text-center text-[11px] font-bold text-amber-400 motion-reduce:animate-none",
          className,
        )}
      >
        ¡Últimas {stock} unids!
      </span>
    );
  return (
    <span
      className={cn(
        "inline-block w-full text-center text-[11px] font-medium text-slate-300",
        className,
      )}
    >
      {stock} unidades disponibles
    </span>
  );
}
