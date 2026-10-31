import { cn } from "@/lib/utils";

/** Logo Plaza X: el Puente Amarillo de Juanambú, vectorial y minimalista. */
export function BridgeLogo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "group relative flex size-8 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm",
        className,
      )}
    >
      <svg
        className="size-6 transition-transform duration-300 group-hover:scale-105"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        {/* Montañas de fondo (cañón) */}
        <path d="M0 80 L35 35 L60 65 L100 25 L100 100 L0 100 Z" fill="#1e293b" />
        <path d="M0 90 L25 45 L50 80 L100 40 L100 100 L0 100 Z" fill="#0f172a" opacity="0.6" />
        {/* Cables de suspensión */}
        <path
          d="M15 48 Q 50 72 85 48"
          stroke="#eab308"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        <path d="M15 50 Q 50 74 85 50" stroke="#f59e0b" strokeWidth="1.5" fill="none" />
        {/* Torres amarillas */}
        <path
          d="M18 42 L18 78 M12 42 L24 42 M14 55 L22 55 M14 68 L22 68"
          stroke="#facc15"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M82 42 L82 78 M76 42 L88 42 M78 55 L86 55 M78 68 L86 68"
          stroke="#facc15"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Plataforma */}
        <path d="M5 64 L95 64" stroke="#facc15" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M5 65 L95 65" stroke="#ca8a04" strokeDasharray="2 2" strokeWidth="1.5" />
        {/* Tirantes verticales */}
        <line x1="30" y1="58" x2="30" y2="64" stroke="#eab308" strokeWidth="1.2" />
        <line x1="40" y1="62" x2="40" y2="64" stroke="#eab308" strokeWidth="1.2" />
        <line x1="50" y1="63" x2="50" y2="64" stroke="#eab308" strokeWidth="1.2" />
        <line x1="60" y1="62" x2="60" y2="64" stroke="#eab308" strokeWidth="1.2" />
        <line x1="70" y1="58" x2="70" y2="64" stroke="#eab308" strokeWidth="1.2" />
      </svg>
    </div>
  );
}
