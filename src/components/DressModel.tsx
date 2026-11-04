import { useId, useMemo } from "react";
import {
  baseLayer,
  bodyShapes,
  BODIES,
  garmentFor,
  H,
  legBoxesFrom,
  LAYER,
  limbBoxes,
  mix,
  palette,
  W,
  type Garment,
} from "@/lib/outfit";
import type { Gender, Kind, Material } from "@/lib/vestidor";

export type WornItem = { id: string; kind: Kind; color: string; material: Material };

export const SKIN_TONES = [
  { id: "clara", skin: "#f0c8a4", hair: "#3a2416" },
  { id: "trigueña", skin: "#d39a72", hair: "#26180f" },
  { id: "morena", skin: "#a8704b", hair: "#1c120b" },
  { id: "oscura", skin: "#6f452b", hair: "#120c08" },
] as const;
export type SkinId = (typeof SKIN_TONES)[number]["id"];

const BASE_COLOR = "#cfc9bf";

/**
 * Modelo del vestidor dibujado con volumen: cada prenda es un molde construido sobre
 * los puntos del cuerpo (ver lib/outfit), con sombra, pliegues, costuras y textura.
 */
export function DressModel({
  gender,
  skin,
  items,
  className,
}: {
  gender: Gender;
  skin: SkinId;
  items: WornItem[];
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const tone = SKIN_TONES.find((t) => t.id === skin) ?? SKIN_TONES[1];
  const body = useMemo(() => bodyShapes(gender), [gender]);
  const boxes = useMemo(() => limbBoxes(gender), [gender]);
  // Torso y piernas (sin brazos): el cuerpo y las prendas de dos piernas.
  const legBoxes = boxes.slice(0, 3);
  const pantsBoxes = useMemo(() => legBoxesFrom(gender), [gender]);
  const b = BODIES[gender];
  const { cx, cy } = b.head;
  const f = gender === "mujer";
  const sorted = [...items].sort((a, z) => LAYER[a.kind] - LAYER[z.kind]);
  const skinDark = mix(tone.skin, "#000000", 0.22);
  const skinLine = mix(tone.skin, "#000000", 0.35);
  const id = (s: string) => `${uid}-${s}`;

  const garment = (key: string, g: Garment, color: string, material: Material) => {
    const pal = palette(color);
    const clip = id(`c-${key}`);
    const tex =
      material === "denim"
        ? id("denim")
        : material === "knit"
          ? id("knit")
          : material === "leather"
            ? null
            : id("weave");
    return (
      <g key={key}>
        <clipPath id={clip}>
          {g.shapes.map((s, i) => (
            <path key={i} d={s.d} />
          ))}
        </clipPath>
        {g.shapes.map((s, i) => (
          <path
            key={i}
            d={s.d}
            fill={pal[s.fill]}
            fillOpacity={s.fill === "lens" ? 0.78 : 1}
            stroke={mix(pal.main, "#000000", 0.45)}
            strokeOpacity={0.35}
            strokeWidth={0.8}
          />
        ))}
        {g.shapes.map((sh, i) => {
          const part = sh.part ?? "self";
          if (part === "none" || sh.fill === "lens" || sh.fill === "metal") return null;
          return part === "legs" ? (
            <g key={`v${i}`} clipPath={`url(#${clip}-${i})`} pointerEvents="none">
              <clipPath id={`${clip}-${i}`}>
                <path d={sh.d} />
              </clipPath>
              {pantsBoxes.map((r, j) => (
                <rect
                  key={j}
                  x={r.x}
                  y={r.y}
                  width={r.w}
                  height={r.h}
                  fill={`url(#${id("vol")})`}
                />
              ))}
            </g>
          ) : (
            <path
              key={`v${i}`}
              d={sh.d}
              fill={`url(#${id(g.shade ? "vol" : "gloss")})`}
              pointerEvents="none"
            />
          );
        })}
        {g.shapes.length > 0 && (
          <g clipPath={`url(#${clip})`} pointerEvents="none">
            {tex && <rect x={0} y={0} width={W} height={H} fill={`url(#${tex})`} />}
            {material === "leather" && (
              <rect x={0} y={0} width={W} height={H} fill={`url(#${id("sheen")})`} />
            )}
          </g>
        )}
        {g.folds.map((d, i) => (
          <path
            key={`f${i}`}
            d={d}
            fill="none"
            stroke="#000"
            strokeOpacity={0.2}
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        ))}
        {g.seams.map((d, i) => (
          <path
            key={`s${i}`}
            d={d}
            fill="none"
            stroke={pal.seam}
            strokeOpacity={0.75}
            strokeWidth={0.9}
            strokeDasharray={material === "denim" ? "2.2 1.6" : undefined}
            strokeLinecap="round"
          />
        ))}
        {g.dots.map((d, i) => (
          <circle
            key={`d${i}`}
            cx={d.x}
            cy={d.y}
            r={d.r}
            fill={pal[d.fill]}
            stroke={pal.dark}
            strokeWidth={0.5}
          />
        ))}
      </g>
    );
  };

  const eye = (s: 1 | -1) => {
    const x = cx - s * 11;
    const y = cy + 2;
    const w = f ? 7.5 : 7;
    return (
      <g key={s}>
        <path
          d={`M${x - w} ${y} Q${x} ${y - 5.5} ${x + w} ${y} Q${x} ${y + 4} ${x - w} ${y} Z`}
          fill="#f6f1ea"
        />
        <circle cx={x} cy={y - 0.3} r={3.3} fill="#4a2f1d" />
        <circle cx={x} cy={y - 0.3} r={1.5} fill="#120b07" />
        <circle cx={x + 1} cy={y - 1.4} r={0.8} fill="#fff" fillOpacity={0.85} />
        <path
          d={`M${x - w - 0.5} ${y + 0.3} Q${x} ${y - 6.3} ${x + w + 0.5} ${y + 0.3}`}
          fill="none"
          stroke="#1a110b"
          strokeWidth={f ? 1.5 : 1.1}
          strokeLinecap="round"
        />
        <path
          d={`M${x - w - 1} ${y - 9 + (f ? 0 : 1)} Q${x - 1} ${y - 13} ${x + w + 1} ${y - 9.5}`}
          fill="none"
          stroke={tone.hair}
          strokeWidth={f ? 1.6 : 2.6}
          strokeLinecap="round"
        />
      </g>
    );
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      role="img"
      aria-label={`Modelo ${f ? "mujer" : "hombre"} del vestidor virtual`}
    >
      <defs>
        <linearGradient id={id("vol")} x1="0" x2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.26" />
          <stop offset="0.18" stopColor="#000" stopOpacity="0.07" />
          <stop offset="0.4" stopColor="#fff" stopOpacity="0.07" />
          <stop offset="0.62" stopColor="#000" stopOpacity="0" />
          <stop offset="0.85" stopColor="#000" stopOpacity="0.1" />
          <stop offset="1" stopColor="#000" stopOpacity="0.28" />
        </linearGradient>
        <linearGradient id={id("gloss")} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id={id("sheen")} x1="0" x2="1" y1="0" y2="0.3">
          <stop offset="0.3" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.42" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={id("cheek")}>
          <stop offset="0" stopColor="#d0605a" stopOpacity={f ? 0.28 : 0.12} />
          <stop offset="1" stopColor="#d0605a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("floor")}>
          <stop offset="0" stopColor="#000" stopOpacity="0.55" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <pattern
          id={id("denim")}
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(35)"
        >
          <path d="M0 0 L0 4" stroke="#fff" strokeOpacity="0.13" strokeWidth="1" />
          <path d="M2 0 L2 4" stroke="#000" strokeOpacity="0.1" strokeWidth="0.8" />
        </pattern>
        <pattern id={id("knit")} width="6" height="7" patternUnits="userSpaceOnUse">
          <path
            d="M0 0 L3 5.5 L6 0"
            fill="none"
            stroke="#000"
            strokeOpacity="0.2"
            strokeWidth="1.1"
          />
          <path
            d="M0 1.5 L3 7 L6 1.5"
            fill="none"
            stroke="#fff"
            strokeOpacity="0.08"
            strokeWidth="0.8"
          />
        </pattern>
        <pattern id={id("weave")} width="3" height="3" patternUnits="userSpaceOnUse">
          <rect width="1.5" height="1.5" fill="#000" fillOpacity="0.045" />
          <rect x="1.5" y="1.5" width="1.5" height="1.5" fill="#fff" fillOpacity="0.04" />
        </pattern>
        <clipPath id={id("skin")}>
          <path d={body.torso} />
        </clipPath>
      </defs>

      <ellipse cx={W / 2} cy={b.footY + 4} rx={84} ry={10} fill={`url(#${id("floor")})`} />

      {/* Cabello de atrás */}
      {body.hairBack && <path d={body.hairBack} fill={tone.hair} />}

      {/* Cuerpo: brazos detrás del torso, cada parte con su volumen */}
      {[...body.arms, ...body.hands].map((d, i) => (
        <g key={`a${i}`}>
          <path d={d} fill={tone.skin} stroke={skinLine} strokeOpacity={0.35} strokeWidth={0.8} />
          <path d={d} fill={`url(#${id("vol")})`} pointerEvents="none" />
        </g>
      ))}
      {body.ears.map((d, i) => (
        <path key={`e${i}`} d={d} fill={skinDark} />
      ))}
      <path
        d={body.torso}
        fill={tone.skin}
        stroke={skinLine}
        strokeOpacity={0.35}
        strokeWidth={0.8}
      />
      <g clipPath={`url(#${id("skin")})`} pointerEvents="none">
        {legBoxes.map((r, i) => (
          <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={`url(#${id("vol")})`} />
        ))}
      </g>
      {[...body.feet, body.neck].map((d, i) => (
        <g key={`p${i}`}>
          <path d={d} fill={tone.skin} stroke={skinLine} strokeOpacity={0.35} strokeWidth={0.8} />
          <path d={d} fill={`url(#${id("vol")})`} pointerEvents="none" />
        </g>
      ))}
      {/* Sombra del mentón sobre el cuello (la cabeza la tapa por arriba) */}
      <path
        d={`M${W / 2 - b.neck.half} ${cy + b.head.ry - 6} Q${W / 2} ${cy + b.head.ry + 9} ${W / 2 + b.neck.half} ${cy + b.head.ry - 6}`}
        fill="none"
        stroke={skinDark}
        strokeOpacity={0.55}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <path
        d={body.head}
        fill={tone.skin}
        stroke={skinLine}
        strokeOpacity={0.35}
        strokeWidth={0.8}
      />
      <path d={body.head} fill={`url(#${id("vol")})`} opacity={0.7} pointerEvents="none" />
      <path
        d={`M${b.sh[0] + 2} ${b.neck.base + 2} Q${W / 2 - 14} ${b.neck.base + 8} ${W / 2 - 4} ${b.neck.base + 4} M${W - b.sh[0] - 2} ${b.neck.base + 2} Q${W / 2 + 14} ${b.neck.base + 8} ${W / 2 + 4} ${b.neck.base + 4}`}
        fill="none"
        stroke={skinDark}
        strokeOpacity={0.5}
        strokeWidth={1}
      />
      {/* Rodillas y dedos */}
      <g fill="none" stroke={skinDark} strokeOpacity={0.45} strokeWidth={1} strokeLinecap="round">
        <path
          d={`M${b.ko[0] + 10} ${b.ko[1] + 2} q8 4 16 0 M${W - b.ko[0] - 10} ${b.ko[1] + 2} q-8 4 -16 0`}
        />
        {[1, -1].map((s) => {
          const wo = b.armOuter[b.armOuter.length - 1]!;
          const x = s === 1 ? wo[0] + 6 : W - wo[0] - 6;
          return (
            <path
              key={s}
              d={`M${x} ${wo[1] + 24} l${s * 1} 14 M${x + s * 4} ${wo[1] + 26} l${s * 1} 14`}
            />
          );
        })}
      </g>

      {/* Cara */}
      <ellipse cx={cx - 15} cy={cy + 14} rx={8} ry={5} fill={`url(#${id("cheek")})`} />
      <ellipse cx={cx + 15} cy={cy + 14} rx={8} ry={5} fill={`url(#${id("cheek")})`} />
      {eye(1)}
      {eye(-1)}
      <path
        d={`M${cx - 1.5} ${cy + 4} Q${cx - 3} ${cy + 13} ${cx - 5} ${cy + 16} Q${cx} ${cy + 19} ${cx + 5} ${cy + 16}`}
        fill="none"
        stroke={skinLine}
        strokeOpacity={0.55}
        strokeWidth={1.1}
        strokeLinecap="round"
      />
      <path
        d={`M${cx - (f ? 7.5 : 7)} ${cy + 24.5} Q${cx - 3} ${cy + 21.5} ${cx} ${cy + 22.8} Q${cx + 3} ${cy + 21.5} ${cx + (f ? 7.5 : 7)} ${cy + 24.5} Q${cx} ${cy + 26} ${cx - (f ? 7.5 : 7)} ${cy + 24.5} Z`}
        fill={f ? "#b5535a" : mix(tone.skin, "#7a3b33", 0.55)}
      />
      <path
        d={`M${cx - (f ? 7.5 : 7)} ${cy + 24.5} Q${cx} ${cy + 26} ${cx + (f ? 7.5 : 7)} ${cy + 24.5} Q${cx} ${cy + 31} ${cx - (f ? 7.5 : 7)} ${cy + 24.5} Z`}
        fill={f ? "#c96a6f" : mix(tone.skin, "#8a4a40", 0.45)}
      />

      {/* Ropa base */}
      {garment("base", baseLayer(gender), BASE_COLOR, "plain")}

      {/* Prendas */}
      {sorted.map((it) =>
        it.kind === "beanie" || it.kind === "cap" || it.kind === "hat"
          ? null
          : garment(it.id, garmentFor(it.kind, gender), it.color, it.material),
      )}

      {/* Cabello de adelante y lo que va en la cabeza */}
      <path d={body.hairFront} fill={tone.hair} />
      {sorted
        .filter((it) => it.kind === "beanie" || it.kind === "cap" || it.kind === "hat")
        .map((it) => garment(it.id, garmentFor(it.kind, gender), it.color, it.material))}
    </svg>
  );
}
