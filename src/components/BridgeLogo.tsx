import { cn } from "@/lib/utils";

/** Logo Plaza X del diseño: puente de Juanambú minimalista en un recuadro índigo. */
export function BridgeLogo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex size-9 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 transition group-hover:scale-105 group-hover:border-amber-400",
        className,
      )}
    >
      <svg
        className="size-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path d="M3 17c4-3 14-3 18 0" strokeLinecap="round" />
        <path d="M4 19h16" strokeLinecap="round" />
        <path d="M6 19v-5M18 19v-5" strokeLinecap="round" />
      </svg>
    </div>
  );
}
