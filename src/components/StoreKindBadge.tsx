import type { StoreKind } from "@/lib/backend";
import { cn } from "@/lib/utils";

/** "Vendedor independiente" o "Empresa": el comprador sabe a quién le compra. */
export function StoreKindBadge({ kind, className }: { kind: StoreKind; className?: string }) {
  const persona = kind === "persona";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 align-middle text-[11px] font-bold",
        persona
          ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
          : "border-amber-500/30 bg-amber-500/10 text-amber-300",
        className,
      )}
    >
      <i className={cn("fa-solid", persona ? "fa-user-tag" : "fa-building")} aria-hidden />
      {persona ? "Vendedor independiente" : "Empresa"}
    </span>
  );
}
