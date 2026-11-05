import { useId, useMemo } from "react";
import { garmentBox, garmentFor, palette } from "@/lib/outfit";
import type { Gender, Kind } from "@/lib/vestidor";
import { cn } from "@/lib/utils";

/**
 * Ícono de la prenda: el mismo molde que se pone en el modelo, en su color.
 * Así el comprador ve exactamente qué va a aparecer al tocarla.
 */
export function GarmentIcon({
  kind,
  color,
  gender = "mujer",
  className,
  title,
}: {
  kind: Kind;
  color: string;
  gender?: Gender;
  className?: string;
  title?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const g = useMemo(() => garmentFor(kind, gender), [kind, gender]);
  const box = useMemo(() => garmentBox(g), [g]);
  const pal = palette(color);
  const shade = `${uid}-v`;
  return (
    <svg
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      className={cn("block", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={shade} x1="0" x2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.25" />
          <stop offset="0.4" stopColor="#fff" stopOpacity="0.1" />
          <stop offset="1" stopColor="#000" stopOpacity="0.28" />
        </linearGradient>
      </defs>
      {g.shapes.map((s, i) => (
        <g key={i}>
          <path
            d={s.d}
            fill={pal[s.fill]}
            fillOpacity={s.fill === "lens" ? 0.85 : 1}
            stroke={pal.dark}
            strokeWidth={box.w / 90}
          />
          {s.fill !== "lens" && s.fill !== "metal" && <path d={s.d} fill={`url(#${shade})`} />}
        </g>
      ))}
      {g.seams.map((d, i) => (
        <path
          key={`s${i}`}
          d={d}
          fill="none"
          stroke={g.shapes.length ? pal.seam : pal.main}
          strokeOpacity={g.shapes.length ? 0.8 : 1}
          strokeWidth={g.shapes.length ? box.w / 110 : box.w / 50}
          strokeLinecap="round"
        />
      ))}
      {g.dots.map((d, i) => (
        <circle key={`d${i}`} cx={d.x} cy={d.y} r={d.r} fill={pal[d.fill]} />
      ))}
    </svg>
  );
}
