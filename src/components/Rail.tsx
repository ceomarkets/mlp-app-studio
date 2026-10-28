import {
  Coffee,
  Flower2,
  LayoutGrid,
  Package,
  Palette,
  Shirt,
  Smartphone,
  Sofa,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Ícono premium por categoría (lucide, trazo uniforme). */
export const CATEGORY_ICON: Record<string, LucideIcon> = {
  Todo: LayoutGrid,
  Ropa: Shirt,
  Alimentos: Coffee,
  Artesanías: Palette,
  Campo: Wheat,
  Hogar: Sofa,
  Belleza: Flower2,
  Tecnología: Smartphone,
  Otros: Package,
};

/** Sección horizontal deslizable con encabezado e ícono. */
export function Rail({
  icon,
  title,
  subtitle,
  action,
  tone = "default",
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  tone?: "default" | "hot";
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "mt-10",
        tone === "hot" &&
          "-mx-4 rounded-none bg-primary/8 px-4 py-6 md:mx-0 md:rounded-3xl md:px-6",
      )}
    >
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-2xl shadow-card [&_svg]:size-5",
              tone === "hot" ? "bg-primary text-primary-foreground" : "bg-card text-primary",
            )}
          >
            {icon}
          </span>
          <div>
            <h2 className="text-xl font-extrabold leading-tight md:text-2xl">{title}</h2>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="rail -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:-mx-1 md:gap-4 md:px-1 [&>*]:w-[44vw] [&>*]:shrink-0 sm:[&>*]:w-[30%] lg:[&>*]:w-[calc(25%-12px)]">
        {children}
      </div>
    </section>
  );
}
