/**
 * Geometría del modelo del vestidor y moldes de cada prenda.
 *
 * Todo vive en el mismo lienzo (300 × 720) y cada prenda se construye a partir de los
 * puntos del cuerpo del modelo (hombros, axilas, cintura, cadera, rodillas…), con un
 * margen de holgura. Así la prenda sigue la forma del cuerpo en vez de ser una foto
 * pegada encima.
 */
import type { Gender, Kind } from "@/lib/vestidor";

export type Pt = readonly [number, number] | readonly [number, number, 1];
type XY = readonly [number, number];

export const W = 300;
export const H = 720;
const C = W / 2;

export type Body = {
  head: { cx: number; cy: number; rx: number; ry: number };
  neck: { half: number; top: number; base: number };
  /** Hombro junto al cuello. */
  sh: XY;
  /** Hombro exterior. */
  so: XY;
  ap: XY;
  ch: XY;
  wa: XY;
  hi: XY;
  th: XY;
  ko: XY;
  ki: XY;
  co: XY;
  ci: XY;
  ao: XY;
  ai: XY;
  ti: XY;
  crotch: number;
  armOuter: XY[];
  armInner: XY[];
  footY: number;
};

export const BODIES: Record<Gender, Body> = {
  mujer: {
    head: { cx: C, cy: 72, rx: 27, ry: 35 },
    neck: { half: 10, top: 96, base: 127 },
    sh: [116, 131],
    so: [96, 141],
    ap: [107, 174],
    ch: [104, 192],
    wa: [119, 250],
    hi: [100, 310],
    th: [103, 372],
    ko: [113, 474],
    ki: [146, 474],
    co: [112, 532],
    ci: [143, 536],
    ao: [124, 612],
    ai: [140, 612],
    ti: [148, 392],
    crotch: 352,
    armOuter: [
      [96, 141],
      [87, 200],
      [82, 262],
      [79, 320],
      [79, 350],
    ],
    armInner: [
      [107, 174],
      [105, 206],
      [99, 262],
      [95, 315],
      [92, 350],
    ],
    footY: 652,
  },
  hombre: {
    head: { cx: C, cy: 70, rx: 28, ry: 36 },
    neck: { half: 14, top: 95, base: 128 },
    sh: [114, 132],
    so: [83, 148],
    ap: [98, 182],
    ch: [95, 205],
    wa: [109, 266],
    hi: [105, 314],
    th: [106, 376],
    ko: [111, 478],
    ki: [147, 478],
    co: [110, 538],
    ci: [144, 540],
    ao: [122, 616],
    ai: [141, 616],
    ti: [148, 396],
    crotch: 356,
    armOuter: [
      [83, 148],
      [74, 206],
      [69, 270],
      [67, 328],
      [68, 358],
    ],
    armInner: [
      [98, 182],
      [97, 212],
      [90, 270],
      [86, 318],
      [84, 358],
    ],
    footY: 658,
  },
};

/* ---------- Trazos ---------- */

const r1 = (n: number) => Math.round(n * 10) / 10;
const sharp = (p: Pt) => p.length === 3;

/** Curva suave (Catmull-Rom) por los puntos; los marcados con 1 quedan en punta. */
export function curve(pts: readonly Pt[], closed = true): string {
  const n = pts.length;
  if (n < 2) return "";
  const at = (i: number) => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))]!;
  let d = `M${r1(pts[0]![0])} ${r1(pts[0]![1])}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1),
      p1 = at(i),
      p2 = at(i + 1),
      p3 = at(i + 2);
    const c1 = sharp(p1)
      ? p1
      : ([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6] as const);
    const c2 = sharp(p2)
      ? p2
      : ([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6] as const);
    d += ` C${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return closed ? `${d} Z` : d;
}

export const mirror = (p: Pt): Pt => (sharp(p) ? [W - p[0], p[1], 1] : [W - p[0], p[1]]);

/** Mitad izquierda (del centro de arriba al centro de abajo) → figura simétrica cerrada. */
export function sym(left: readonly Pt[]): string {
  const right = left.slice(1, -1).reverse().map(mirror);
  return curve([...left, ...right]);
}

/** Refleja un trazo completo (pieza izquierda → derecha). */
export const mirrorPath = (pts: readonly Pt[]) => pts.map(mirror);

/** x de una línea (puntos ordenados por y) a la altura y. */
export function xAt(line: readonly XY[], y: number): number {
  if (y <= line[0]![1]) return line[0]![0];
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!,
      b = line[i]!;
    if (y <= b[1]) return a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1] || 1);
  }
  return line[line.length - 1]![0];
}

const torsoSide = (b: Body): XY[] => [b.ap, b.ch, b.wa, b.hi, b.th];
const legOuter = (b: Body): XY[] => [b.hi, b.th, b.ko, b.co, b.ao];
const legInner = (b: Body): XY[] => [[C, b.crotch], b.ti, b.ki, b.ci, b.ai];

/* ---------- Cuerpo ---------- */

export type BodyShapes = {
  head: string;
  ears: string[];
  neck: string;
  torso: string;
  arms: string[];
  hands: string[];
  feet: string[];
  hairBack: string | null;
  hairFront: string;
};

function handPts(b: Body): Pt[] {
  const wo = b.armOuter[b.armOuter.length - 1]!;
  const wi = b.armInner[b.armInner.length - 1]!;
  const mid = (wo[0] + wi[0]) / 2;
  return [
    [wo[0], wo[1] - 2],
    [wo[0] - 3, wo[1] + 16],
    [mid - 3, wo[1] + 40],
    [mid + 3, wo[1] + 42],
    [wi[0] + 2, wo[1] + 30],
    [wi[0] + 2, wi[1] + 12],
    [wi[0], wi[1] - 2],
  ];
}

function footPts(b: Body): Pt[] {
  const { ao, ai, footY } = b;
  return [
    [ao[0], ao[1] - 4, 1],
    [ao[0] - 3, ao[1] + 16],
    [ao[0] - 6, footY - 8],
    [ao[0] - 3, footY],
    [ai[0] + 3, footY],
    [ai[0] + 4, footY - 9],
    [ai[0] + 1, ai[1] + 14],
    [ai[0], ai[1] - 4, 1],
  ];
}

export function bodyShapes(g: Gender): BodyShapes {
  const b = BODIES[g];
  const { cx, cy, rx, ry } = b.head;
  const { half, top, base } = b.neck;
  const f = g === "mujer";
  const head = sym([
    [cx, cy - ry],
    [cx - rx * 0.78, cy - ry * 0.78],
    [cx - rx, cy - 8],
    [cx - rx + 1, cy + 8],
    [cx - rx * (f ? 0.74 : 0.8), cy + ry * 0.62],
    [cx - rx * (f ? 0.3 : 0.38), cy + ry * 0.94],
    [cx, cy + ry],
  ]);
  const ear = (s: 1 | -1) =>
    curve([
      [cx - s * (rx - 2), cy - 6],
      [cx - s * (rx + 5), cy - 2],
      [cx - s * (rx + 4), cy + 12],
      [cx - s * (rx - 2), cy + 14],
    ]);
  const neck = sym([
    [C, top],
    [C - half, top],
    [C - half - 1, base - 8],
    [C - half - 6, base + 2],
    [C, base + 4],
  ]);
  const torso = sym([
    [C, base - 6],
    [C - half - 3, base - 5],
    b.sh,
    [b.so[0] + 4, b.so[1]],
    b.ap,
    b.ch,
    b.wa,
    b.hi,
    b.th,
    b.ko,
    b.co,
    [b.ao[0], b.ao[1], 1],
    [b.ai[0], b.ai[1], 1],
    b.ci,
    b.ki,
    b.ti,
    [C, b.crotch],
  ]);
  const armL: Pt[] = [
    [b.sh[0] + 2, b.sh[1] + 2],
    ...b.armOuter.slice(0, -1),
    [...b.armOuter[b.armOuter.length - 1]!, 1],
    [...b.armInner[b.armInner.length - 1]!, 1],
    ...b.armInner.slice(0, -1).reverse(),
  ];
  const hairBack = f
    ? sym([
        [C, cy - ry - 6],
        [cx - rx - 6, cy - 22],
        [cx - rx - 8, cy + 26],
        [cx - rx - 12, base + 26],
        [cx - rx - 8, b.ch[1] + 8],
        [cx - rx + 6, b.ch[1] + 14, 1],
        [C - half - 2, base + 8],
        [C, base],
      ])
    : null;
  const hairFront = f
    ? sym([
        [C, cy - ry - 5],
        [cx - rx * 0.8, cy - ry * 0.86],
        [cx - rx - 4, cy - 12],
        [cx - rx - 3, cy + 30],
        [cx - rx + 2, cy + 14],
        [cx - rx + 5, cy - 8],
        [cx - rx * 0.55, cy - ry * 0.62],
        [C, cy - ry * 0.72],
      ])
    : sym([
        [C, cy - ry - 7],
        [cx - rx * 0.78, cy - ry * 0.9],
        [cx - rx - 3, cy - ry * 0.4],
        [cx - rx - 1, cy - 2],
        [cx - rx + 3, cy - 4, 1],
        [cx - rx + 5, cy - ry * 0.48],
        [cx - rx * 0.4, cy - ry * 0.66],
        [C, cy - ry * 0.7],
      ]);
  return {
    head,
    ears: [ear(1), ear(-1)],
    neck,
    torso,
    arms: [curve(armL), curve(mirrorPath(armL))],
    hands: [curve(handPts(b)), curve(mirrorPath(handPts(b)))],
    feet: [curve(footPts(b)), curve(mirrorPath(footPts(b)))],
    hairBack,
    hairFront,
  };
}

/** Rectángulos de volumen (torso, brazos, piernas, cabeza) para sombrear cuerpo y prendas. */
export function limbBoxes(g: Gender) {
  const b = BODIES[g];
  const minArm = Math.min(...b.armOuter.map((p) => p[0]));
  const wrist = b.armOuter[b.armOuter.length - 1]![1];
  const { cx, cy, rx, ry } = b.head;
  // El cambio de volumen torso → piernas queda oculto bajo la ropa base.
  const split = b.hi[1] - 28;
  const torso = {
    x: b.ap[0] - 10,
    y: b.neck.top,
    w: W - 2 * (b.ap[0] - 10),
    h: split - b.neck.top,
  };
  const legL = { x: b.hi[0] - 12, y: split, w: C - (b.hi[0] - 12), h: b.footY + 8 - split };
  const armL = {
    x: minArm - 12,
    y: b.so[1] - 8,
    w: b.ap[0] + 4 - (minArm - 12),
    h: wrist + 48 - b.so[1],
  };
  const flip = (r: typeof torso) => ({ ...r, x: W - r.x - r.w });
  const head = { x: cx - rx - 10, y: cy - ry - 24, w: 2 * rx + 20, h: 2 * ry + 24 };
  return [torso, legL, flip(legL), armL, flip(armL), head];
}

/** Volumen de cada pierna desde la cintura (pantalones, shorts, faldas). */
export function legBoxesFrom(g: Gender) {
  const b = BODIES[g];
  const y = b.wa[1] - 20;
  const legL = { x: b.hi[0] - 16, y, w: C - (b.hi[0] - 16), h: b.footY + 8 - y };
  return [legL, { ...legL, x: W - legL.x - legL.w }];
}

/* ---------- Prendas ---------- */

export type Fill = "main" | "dark" | "light" | "sole" | "lens" | "metal";
/** Sombra de volumen: la de la propia pieza ("self"), la de las dos piernas ("legs") o ninguna. */
export type Part = "self" | "legs" | "none";
export type Shape = { d: string; fill: Fill; part?: Part };
export type Garment = {
  /** Piezas de tela, en orden de dibujo. */
  shapes: Shape[];
  /** Costuras y pliegues (líneas). */
  seams: string[];
  folds: string[];
  /** Botones, ojales y remaches (círculos). */
  dots: { x: number; y: number; r: number; fill: Fill }[];
  /** Sombra de volumen del cuerpo dentro de la prenda. */
  shade: boolean;
};

const G = (p: Partial<Garment> & { shapes: Shape[] }): Garment => ({
  seams: [],
  folds: [],
  dots: [],
  shade: true,
  ...p,
});

type NeckStyle = "crew" | "v" | "scoop" | "collar";

function torsoPts(b: Body, e: number, hemY: number, neck: NeckStyle, loose: boolean): Pt[] {
  const { half, base } = b.neck;
  const ny = { crew: base + 6, v: base + 34, scoop: base + 22, collar: base + 2 }[neck];
  const hemX = xAt(torsoSide(b), hemY) - e;
  const waistX = loose ? Math.min(b.wa[0], (b.ch[0] + hemX) / 2 + 1) - e : b.wa[0] - e;
  const pts: Pt[] = [
    [C, ny],
    [C - half - 3, base - 6],
    [b.sh[0] - 2, b.sh[1] - 1],
    [b.so[0] + 8 - e * 0.5, b.so[1] + 1],
    [b.ap[0] - e, b.ap[1] + 2],
    [b.ch[0] - e, b.ch[1]],
  ];
  if (hemY > b.wa[1] + 6) pts.push([waistX, b.wa[1]]);
  if (hemY > b.hi[1] + 6) pts.push([b.hi[0] - e, b.hi[1]]);
  pts.push([hemX, hemY, 1], [C, hemY + 2]);
  return pts;
}

/** Manga izquierda hasta la altura endY. */
function sleevePts(b: Body, e: number, endY: number): Pt[] {
  const outer = b.armOuter.filter((p) => p[1] < endY - 4).map((p): Pt => [p[0] - e, p[1]]);
  const inner = b.armInner.filter((p) => p[1] < endY - 4).map((p): Pt => [p[0] + e * 0.5, p[1]]);
  return [
    [b.sh[0] + 2, b.sh[1] - 2],
    ...outer,
    [xAt(b.armOuter, endY) - e, endY, 1],
    [xAt(b.armInner, endY) + e * 0.5, endY + 3, 1],
    ...inner.reverse(),
  ];
}

const both = (pts: Pt[]): string[] => [curve(pts), curve(mirrorPath(pts))];
const pair = (d: (s: 1 | -1) => string): string[] => [d(1), d(-1)];
/** Coordenada x reflejada según el lado (1 = izquierda del lienzo). */
const sx = (s: 1 | -1, x: number) => (s === 1 ? x : W - x);

function sleeves(b: Body, e: number, endY: number, cuff = 0): Garment {
  const shapes = both(sleevePts(b, e, endY)).map((d) => ({ d, fill: "main" as Fill }));
  const seams: string[] = [];
  const folds = pair(
    (s) =>
      `M${sx(s, xAt(b.armOuter, b.armOuter[2]![1]) - e + 3)} ${b.armOuter[2]![1] - 4} q${s * 6} 6 ${s * 12} 2`,
  );
  if (cuff) {
    for (const s of [1, -1] as const) {
      const xo = sx(s, xAt(b.armOuter, endY - cuff) - e);
      const xi = sx(s, xAt(b.armInner, endY - cuff) + e * 0.5);
      seams.push(`M${xo} ${endY - cuff} L${xi} ${endY - cuff + 2}`);
    }
  }
  return G({ shapes, seams, folds: endY > b.armOuter[2]![1] ? folds : [] });
}

function merge(...gs: Garment[]): Garment {
  return {
    shapes: gs.flatMap((g) => g.shapes),
    seams: gs.flatMap((g) => g.seams),
    folds: gs.flatMap((g) => g.folds),
    dots: gs.flatMap((g) => g.dots),
    shade: gs.every((g) => g.shade),
  };
}

const wristY = (b: Body) => b.armOuter[b.armOuter.length - 1]![1];

function top(b: Body, kind: Kind, g: Gender): Garment {
  const { half, base } = b.neck;
  const f = g === "mujer";
  switch (kind) {
    case "tshirt": {
      const hem = b.hi[1] - (f ? 10 : 2);
      const body = G({
        shapes: [{ d: sym(torsoPts(b, 4, hem, "crew", true)), fill: "main" }],
        seams: [
          `M${C - half - 3} ${base - 6} Q${C} ${base + 14} ${C + half + 3} ${base - 6}`,
          `M${xAt(torsoSide(b), hem - 6) - 4} ${hem - 6} L${W - xAt(torsoSide(b), hem - 6) + 4} ${hem - 6}`,
        ],
        folds: [
          `M${b.wa[0]} ${b.wa[1] - 10} q14 6 26 2`,
          `M${W - b.wa[0]} ${b.wa[1] - 4} q-12 7 -24 3`,
          `M${C - 14} ${b.ch[1] + 22} q8 10 4 24`,
        ],
      });
      return merge(sleeves(b, 4, b.ap[1] + (f ? 30 : 36), 0), body);
    }
    case "blouse": {
      const hem = b.wa[1] + 36;
      const body = G({
        shapes: [{ d: sym(torsoPts(b, 3, hem, "v", true)), fill: "main" }],
        seams: [`M${C - half - 3} ${base - 6} L${C} ${base + 34} L${C + half + 3} ${base - 6}`],
        folds: [
          `M${b.ch[0] + 6} ${b.ch[1] + 30} q10 20 6 40`,
          `M${W - b.ch[0] - 8} ${b.ch[1] + 28} q-8 22 -4 42`,
        ],
      });
      return merge(sleeves(b, 4, 290, 0), body);
    }
    case "shirt": {
      const hem = b.hi[1] + 8;
      const body = G({
        shapes: [
          { d: sym(torsoPts(b, 4, hem, "collar", true)), fill: "main" },
          ...both([
            [C, base + 12],
            [C - half - 5, base - 9],
            [C - half - 12, base + 12, 1],
          ]).map((d) => ({ d, fill: "light" as Fill })),
        ],
        seams: [`M${C + 3} ${base + 12} L${C + 3} ${hem}`],
        folds: [
          `M${b.wa[0] + 4} ${b.wa[1] - 6} q12 8 22 4`,
          `M${W - b.wa[0] - 4} ${b.wa[1]} q-12 6 -22 2`,
        ],
        dots: [0, 1, 2, 3, 4]
          .map((i) => base + 26 + i * ((hem - base - 40) / 4))
          .map((y) => ({ x: C, y, r: 1.8, fill: "light" as Fill })),
      });
      return merge(sleeves(b, 4, wristY(b) - 4, 10), body);
    }
    case "sweater":
    case "hoodie": {
      const e = kind === "hoodie" ? 7 : 6;
      const hem = b.hi[1] + 6;
      const hx = xAt(torsoSide(b), hem - 12) - e;
      const parts: Garment[] = [
        sleeves(b, e, wristY(b) - 2, 12),
        G({
          shapes: [{ d: sym(torsoPts(b, e, hem, "crew", true)), fill: "main" }],
          seams: [
            `M${hx} ${hem - 12} L${W - hx} ${hem - 12}`,
            `M${C - half - 3} ${base - 2} Q${C} ${base + 18} ${C + half + 3} ${base - 2}`,
          ],
          folds: [
            `M${b.wa[0] - 2} ${b.wa[1] + 8} q16 6 30 0`,
            `M${W - b.wa[0] + 2} ${b.wa[1] + 14} q-14 6 -28 0`,
          ],
        }),
      ];
      if (kind === "hoodie")
        parts.push(
          G({
            shapes: [
              {
                d: sym([
                  [C, base + 6],
                  [C - half - 2, b.neck.top + 14],
                  [C - half - 16, base - 6],
                  [b.sh[0] - 4, b.sh[1] + 10],
                  [C - 18, base + 30],
                  [C, base + 24],
                ]),
                fill: "dark",
              },
              {
                d: sym([
                  [C, b.wa[1] - 2],
                  [C - 34, b.wa[1], 1],
                  [C - 46, hem - 16, 1],
                  [C, hem - 16],
                ]),
                fill: "main",
              },
            ],
            seams: [
              `M${C - 8} ${base + 22} l-1 40`,
              `M${C + 8} ${base + 22} l1 40`,
              `M${C - 34} ${b.wa[1]} L${C + 34} ${b.wa[1]}`,
            ],
          }),
        );
      return merge(...parts);
    }
    case "jacket":
    case "coat": {
      const coat = kind === "coat";
      const e = coat ? 9 : 8;
      const hem = coat ? b.ko[1] - 30 : b.hi[1] + 16;
      const lapel: Pt[] = [
        [C, base + (coat ? 60 : 44)],
        [C - half - 4, base - 10],
        [C - half - 16, base + 6],
        [C - 20, base + (coat ? 70 : 54), 1],
      ];
      return merge(
        sleeves(b, e, wristY(b), 12),
        G({
          shapes: [
            { d: sym(torsoPts(b, e, hem, "collar", true)), fill: "main" },
            ...both(lapel).map((d) => ({ d, fill: "dark" as Fill })),
          ],
          seams: [
            `M${C} ${base + (coat ? 60 : 44)} L${C} ${hem}`,
            `M${b.wa[0] - 4} ${b.wa[1] + 22} l26 0`,
            `M${W - b.wa[0] + 4} ${b.wa[1] + 22} l-26 0`,
            ...(coat ? [`M${b.wa[0] - e} ${b.wa[1]} L${W - b.wa[0] + e} ${b.wa[1]}`] : []),
          ],
          folds: [
            `M${b.ap[0] + 4} ${b.ap[1] + 20} q10 18 6 40`,
            `M${W - b.ap[0] - 4} ${b.ap[1] + 24} q-10 18 -6 40`,
            ...(coat
              ? [
                  `M${b.hi[0] + 10} ${b.hi[1] + 20} l-4 80`,
                  `M${W - b.hi[0] - 10} ${b.hi[1] + 20} l4 80`,
                ]
              : []),
          ],
          dots: coat
            ? [0, 1, 2].flatMap((i) => [
                { x: C - 10, y: base + 80 + i * 44, r: 2.6, fill: "dark" as Fill },
                { x: C + 10, y: base + 80 + i * 44, r: 2.6, fill: "dark" as Fill },
              ])
            : [],
        }),
      );
    }
    case "ruana": {
      const hem = b.hi[1] + 64;
      const left: Pt[] = [
        [C, b.ch[1] + 8],
        [C - half - 2, base - 6],
        [b.sh[0] - 6, b.sh[1]],
        [b.so[0] - 8, b.so[1] + 8],
        [b.so[0] - 24, 236],
        [b.so[0] - 28, hem, 1],
        [C - 4, hem + 4, 1],
      ];
      const fringe: string[] = [];
      for (const s of [1, -1] as const)
        for (let x = b.so[0] - 26; x < C - 6; x += 6)
          fringe.push(`M${sx(s, x)} ${hem + 1} l${s * 0.5} 11`);
      return G({
        shapes: both(left).map((d) => ({ d, fill: "main" })),
        seams: [
          ...fringe,
          ...pair((s) => `M${sx(s, b.so[0] - 22)} ${hem - 10} L${sx(s, C - 6)} ${hem - 8}`),
          ...pair((s) => `M${sx(s, b.so[0] - 21)} ${hem - 16} L${sx(s, C - 6)} ${hem - 14}`),
        ],
        folds: [
          ...pair((s) => `M${sx(s, b.so[0] - 6)} ${b.so[1] + 30} q${s * -4} 60 ${s * -2} 120`),
          ...pair((s) => `M${sx(s, b.ap[0] + 10)} ${b.ch[1] + 30} q${s * 2} 50 ${s * 6} 110`),
        ],
      });
    }
    case "dress": {
      const hem = b.ko[1] + 8;
      return G({
        shapes: [
          {
            d: sym([
              [C, base + 22],
              [C - half - 4, base - 3],
              [b.sh[0] - 4, b.sh[1] + 1],
              [b.sh[0] - 14, b.sh[1] + 4, 1],
              [b.ap[0] + 3, b.ap[1] + 6],
              [b.ch[0] - 2, b.ch[1]],
              [b.wa[0] - 1, b.wa[1]],
              [b.hi[0] - 7, b.hi[1] + 10],
              [b.hi[0] - 18, hem, 1],
              [C, hem + 4],
            ]),
            fill: "main",
          },
        ],
        seams: [`M${b.wa[0] - 1} ${b.wa[1]} Q${C} ${b.wa[1] + 6} ${W - b.wa[0] + 1} ${b.wa[1]}`],
        folds: [
          ...pair(
            (s) =>
              `M${sx(s, b.wa[0] + 6)} ${b.wa[1] + 8} q${s * -8} 90 ${s * -16} ${hem - b.wa[1] - 14}`,
          ),
          ...pair(
            (s) =>
              `M${sx(s, C - 14)} ${b.wa[1] + 12} q${s * -2} 90 ${s * -6} ${hem - b.wa[1] - 10}`,
          ),
        ],
      });
    }
    default:
      return G({ shapes: [] });
  }
}

function bottom(b: Body, kind: Kind): Garment {
  const waistY = b.wa[1] - 2;
  const waistX = b.wa[0] - 1;
  const legs = (e: number, hemY: number, hemOut: number, hemIn: number, low = 0): string => {
    const outer = legOuter(b)
      .filter((p) => p[1] < hemY - 6)
      .map((p): Pt => [p[0] - e, p[1]]);
    const inner = legInner(b)
      .slice(1)
      .filter((p) => p[1] < hemY - 6)
      .map((p): Pt => [p[0] + e, p[1]]);
    return sym([
      [C, waistY + low],
      [waistX - e * 0.5, waistY + low, 1],
      ...outer,
      [hemOut, hemY, 1],
      [hemIn, hemY + 1, 1],
      ...inner.reverse(),
      [C, b.crotch + e],
    ]);
  };
  const band = `M${waistX} ${waistY + 9} L${W - waistX} ${waistY + 9}`;
  switch (kind) {
    case "jeans":
    case "pants":
    case "joggers":
    case "leggings": {
      const e = { jeans: 3, pants: 4, joggers: 7, leggings: 1 }[kind];
      const hemY = b.ao[1] - (kind === "joggers" ? 2 : 6);
      const flare = kind === "pants" ? 7 : kind === "jeans" ? 4 : kind === "joggers" ? 1 : 0;
      const hemOut = b.ao[0] - e - flare;
      const hemIn = b.ai[0] + e + flare;
      const seams = [band];
      const folds = [
        ...pair((s) => `M${sx(s, b.ko[0] + 4)} ${b.ko[1] - 6} q${s * 10} 6 ${s * 20} 0`),
        ...pair((s) => `M${sx(s, b.ko[0] + 6)} ${b.ko[1] + 8} q${s * 8} 4 ${s * 16} 0`),
        ...pair((s) => `M${sx(s, b.ti[0] - 4)} ${b.crotch + 8} q${s * -10} 10 ${s * -16} 4`),
      ];
      if (kind === "jeans")
        seams.push(
          `M${C + 2} ${waistY + 9} q2 30 -6 44`,
          ...pair((s) => `M${sx(s, waistX + 2)} ${waistY + 12} q${s * 14} 18 ${s * 26} 14`),
          ...pair((s) => `M${sx(s, b.hi[0] + 2)} ${b.hi[1]} L${sx(s, hemOut + 3)} ${hemY - 2}`),
          ...pair((s) => `M${sx(s, hemOut)} ${hemY - 8} L${sx(s, hemIn)} ${hemY - 7}`),
        );
      if (kind === "pants")
        seams.push(
          ...pair(
            (s) =>
              `M${sx(s, (b.ko[0] + b.ki[0]) / 2)} ${b.hi[1] + 10} L${sx(s, (hemOut + hemIn) / 2)} ${hemY - 2}`,
          ),
        );
      if (kind === "joggers")
        seams.push(
          ...pair((s) => `M${sx(s, hemOut)} ${hemY - 12} L${sx(s, hemIn)} ${hemY - 11}`),
          `M${C - 4} ${waistY + 9} l-2 22 M${C + 4} ${waistY + 9} l2 22`,
        );
      return G({
        shapes: [{ d: legs(e, hemY, hemOut, hemIn), fill: "main", part: "legs" }],
        seams: kind === "leggings" ? [] : seams,
        folds: kind === "leggings" ? [] : folds,
        dots: kind === "jeans" ? [{ x: C, y: waistY + 5, r: 2.2, fill: "metal" }] : [],
      });
    }
    case "shorts": {
      const hemY = b.crotch + 46;
      const e = 6;
      return G({
        shapes: [
          {
            d: legs(e, hemY, xAt(legOuter(b), hemY) - e - 2, xAt(legInner(b), hemY) + e, 0),
            fill: "main",
            part: "legs",
          },
        ],
        seams: [
          band,
          ...pair((s) => `M${sx(s, waistX + 2)} ${waistY + 12} q${s * 14} 18 ${s * 26} 14`),
        ],
        folds: pair((s) => `M${sx(s, b.ti[0] - 4)} ${b.crotch + 8} q${s * -10} 10 ${s * -16} 4`),
      });
    }
    case "skirt": {
      const hemY = b.ko[1] - 8;
      return G({
        shapes: [
          {
            d: sym([
              [C, waistY],
              [waistX, waistY, 1],
              [b.hi[0] - 5, b.hi[1]],
              [b.hi[0] - 16, hemY, 1],
              [C, hemY + 3],
            ]),
            fill: "main",
          },
        ],
        seams: [band],
        folds: [
          ...pair((s) => `M${sx(s, b.hi[0] + 10)} ${b.hi[1] - 10} L${sx(s, b.hi[0] + 2)} ${hemY}`),
          ...pair((s) => `M${sx(s, C - 18)} ${b.hi[1] - 20} L${sx(s, C - 20)} ${hemY + 2}`),
        ],
      });
    }
    default:
      return G({ shapes: [] });
  }
}

function shoes(b: Body, kind: Kind): Garment {
  const { ao, ai, footY } = b;
  const mid = (ao[0] + ai[0]) / 2;
  const sole = (h: number): Pt[] => [
    [ao[0] - 9, footY - h, 1],
    [ai[0] + 7, footY - h, 1],
    [ai[0] + 7, footY + 2, 1],
    [ao[0] - 9, footY + 2, 1],
  ];
  switch (kind) {
    case "sneakers": {
      const up: Pt[] = [
        [ao[0] - 2, ao[1] - 10, 1],
        [ao[0] - 5, ao[1] + 14],
        [ao[0] - 9, footY - 6],
        [ao[0] - 8, footY + 1, 1],
        [ai[0] + 7, footY + 1, 1],
        [ai[0] + 6, footY - 8],
        [ai[0] + 3, ai[1] + 12],
        [ai[0] + 2, ai[1] - 10, 1],
      ];
      const laces = [0, 1, 2].map((i) => `M${mid - 5} ${ao[1] + 6 + i * 7} l10 0`);
      return G({
        shapes: [
          ...both(up).map((d) => ({ d, fill: "main" as Fill })),
          ...both(sole(8)).map((d) => ({ d, fill: "sole" as Fill })),
        ],
        seams: [
          ...laces,
          ...laces.map((l) => l.replace(/M([\d.]+)/, (_, x) => `M${W - Number(x) - 10}`)),
        ],
        folds: pair((s) => `M${sx(s, ao[0] - 6)} ${footY - 18} q${s * 10} -6 ${s * 22} -2`),
        shade: false,
      });
    }
    case "shoes": {
      const up: Pt[] = [
        [ao[0] - 3, ao[1] + 6, 1],
        [ao[0] - 7, footY - 8],
        [ao[0] - 7, footY + 1, 1],
        [ai[0] + 6, footY + 1, 1],
        [ai[0] + 5, footY - 8],
        [ai[0] + 2, ai[1] + 6, 1],
      ];
      return G({
        shapes: [
          ...both(up).map((d) => ({ d, fill: "main" as Fill })),
          ...both(sole(3)).map((d) => ({ d, fill: "dark" as Fill })),
        ],
        seams: pair(
          (s) =>
            `M${sx(s, ao[0] - 4)} ${ao[1] + 10} Q${sx(s, mid)} ${ao[1] + 16} ${sx(s, ai[0] + 3)} ${ai[1] + 10}`,
        ),
        shade: false,
      });
    }
    case "heels": {
      const up: Pt[] = [
        [ao[0] - 2, ao[1] + 18],
        [ao[0] - 6, footY - 6],
        [mid, footY + 5, 1],
        [ai[0] + 5, footY - 6],
        [ai[0] + 2, ai[1] + 16],
      ];
      return G({
        shapes: both(up).map((d) => ({ d, fill: "main" as Fill })),
        seams: pair((s) => `M${sx(s, ao[0] - 1)} ${ao[1] + 2} L${sx(s, ai[0] + 1)} ${ai[1] + 2}`),
        shade: false,
      });
    }
    case "boots": {
      const topY = b.co[1] + 4;
      const outer = legOuter(b)
        .filter((p) => p[1] > topY && p[1] < ao[1])
        .map((p): Pt => [p[0] - 4, p[1]]);
      const inner = legInner(b)
        .filter((p) => p[1] > topY && p[1] < ai[1])
        .map((p): Pt => [p[0] + 4, p[1]]);
      const up: Pt[] = [
        [xAt(legOuter(b), topY) - 4, topY, 1],
        ...outer,
        [ao[0] - 4, ao[1] + 14],
        [ao[0] - 9, footY - 6],
        [ao[0] - 8, footY + 1, 1],
        [ai[0] + 7, footY + 1, 1],
        [ai[0] + 6, footY - 8],
        [ai[0] + 4, ai[1] + 12],
        ...inner.reverse(),
        [xAt(legInner(b), topY) + 4, topY, 1],
      ];
      return G({
        shapes: [
          ...both(up).map((d) => ({ d, fill: "main" as Fill })),
          ...both(sole(5)).map((d) => ({ d, fill: "dark" as Fill })),
        ],
        seams: pair(
          (s) =>
            `M${sx(s, xAt(legOuter(b), topY + 10) - 4)} ${topY + 10} L${sx(s, xAt(legInner(b), topY + 10) + 4)} ${topY + 10}`,
        ),
        folds: pair((s) => `M${sx(s, ao[0] - 2)} ${ao[1] - 4} q${s * 8} 5 ${s * 16} 0`),
      });
    }
    default:
      return G({ shapes: [] });
  }
}

function accessory(b: Body, kind: Kind, g: Gender): Garment {
  const { cx, cy, rx, ry } = b.head;
  const { half, base } = b.neck;
  switch (kind) {
    case "beanie":
      return G({
        shapes: [
          {
            d: sym([
              [C, cy - ry - 9],
              [cx - rx * 0.66, cy - ry - 3],
              [cx - rx - 4, cy - ry * 0.42],
              [cx - rx - 4, cy - 11, 1],
              [C, cy - 13],
            ]),
            fill: "main",
          },
          {
            d: sym([
              [C, cy - 27],
              [cx - rx - 4, cy - 25, 1],
              [cx - rx - 4, cy - 11, 1],
              [C, cy - 13],
            ]),
            fill: "dark",
          },
        ],
        seams: [-3, -2, -1, 0, 1, 2, 3].map((i) => `M${C + i * 8} ${cy - 25} l0 11`),
      });
    case "cap":
      return G({
        shapes: [
          {
            d: sym([
              [C, cy - ry - 6],
              [cx - rx * 0.68, cy - ry - 1],
              [cx - rx - 2, cy - ry * 0.42],
              [cx - rx - 1, cy - 16, 1],
              [C, cy - 18],
            ]),
            fill: "main",
          },
          {
            d: sym([
              [C, cy - 20],
              [cx - rx - 7, cy - 17],
              [cx - rx - 4, cy - 11],
              [C, cy - 5],
            ]),
            fill: "dark",
          },
        ],
        seams: [
          `M${C} ${cy - ry - 6} L${C} ${cy - 18}`,
          `M${C - 14} ${cy - ry - 2} Q${C - 18} ${cy - 30} ${C - 20} ${cy - 18}`,
          `M${C + 14} ${cy - ry - 2} Q${C + 18} ${cy - 30} ${C + 20} ${cy - 18}`,
        ],
        dots: [{ x: C, y: cy - ry - 6, r: 2.4, fill: "dark" }],
      });
    case "hat":
      return G({
        shapes: [
          {
            d: sym([
              [C, cy - 36],
              [cx - 56, cy - 31],
              [cx - 66, cy - 22],
              [cx - 56, cy - 14],
              [C, cy - 11],
            ]),
            fill: "main",
          },
          {
            d: sym([
              [C, cy - ry - 20],
              [cx - rx + 3, cy - ry - 17],
              [cx - rx, cy - 25, 1],
              [C, cy - 22],
            ]),
            fill: "main",
          },
          {
            d: sym([
              [C, cy - 34],
              [cx - rx, cy - 33, 1],
              [cx - rx, cy - 25, 1],
              [C, cy - 22],
            ]),
            fill: "dark",
          },
        ],
        folds: [`M${cx - 50} ${cy - 22} Q${C} ${cy - 10} ${cx + 50} ${cy - 22}`],
        shade: false,
      });
    case "glasses": {
      const lens = (s: 1 | -1) => {
        const x = C - s * 11.5;
        return `M${x - 9} ${cy - 3} Q${x - 9} ${cy + 9} ${x} ${cy + 9} Q${x + 9} ${cy + 9} ${x + 9} ${cy - 3} Q${x} ${cy - 5} ${x - 9} ${cy - 3} Z`;
      };
      return G({
        shapes: pair(lens).map((d) => ({ d, fill: "lens" as Fill })),
        seams: [
          ...pair(lens),
          `M${C - 2.5} ${cy - 2} Q${C} ${cy - 4} ${C + 2.5} ${cy - 2}`,
          `M${C - 20.5} ${cy - 2} L${C - rx + 1} ${cy - 3}`,
          `M${C + 20.5} ${cy - 2} L${C + rx - 1} ${cy - 3}`,
        ],
        shade: false,
      });
    }
    case "scarf": {
      const end: Pt[] = [
        [C - half - 4, base + 2],
        [C - half - 14, base + 8],
        [C - half - 16, b.ch[1] + 62, 1],
        [C - half + 6, b.ch[1] + 66, 1],
        [C - half + 6, base + 12],
      ];
      return G({
        shapes: [
          {
            d: sym([
              [C, base + 16],
              [C - half - 8, base + 2],
              [C - half - 11, base - 14],
              [C - half - 2, base - 19],
              [C, base - 8],
            ]),
            fill: "main",
          },
          { d: curve(end), fill: "main" },
        ],
        seams: [0, 1, 2, 3].map((i) => `M${C - half - 14 + i * 6} ${b.ch[1] + 63 + i * 1} l0 10`),
        folds: [`M${C - half - 8} ${base + 20} q4 30 0 70`, `M${C - 16} ${base - 6} q14 10 28 0`],
      });
    }
    case "necklace":
      return G({
        shapes: [],
        seams: [
          `M${C - half - 2} ${base - 7} Q${C - half + 2} ${base + 30} ${C} ${base + 34} Q${C + half - 2} ${base + 30} ${C + half + 2} ${base - 7}`,
        ],
        dots: [{ x: C, y: base + 39, r: 4.5, fill: "main" }],
        shade: false,
      });
    case "bag": {
      const bx = W - b.hi[0] + (g === "mujer" ? 16 : 12);
      const by = b.hi[1] + 6;
      const body = `M${bx - 26} ${by - 18} Q${bx - 28} ${by + 24} ${bx - 22} ${by + 26} L${bx + 22} ${by + 26} Q${bx + 28} ${by + 24} ${bx + 26} ${by - 18} Z`;
      return G({
        shapes: [
          { d: body, fill: "main" },
          {
            d: `M${bx - 26} ${by - 18} L${bx + 26} ${by - 18} L${bx + 24} ${by + 2} Q${bx} ${by + 8} ${bx - 24} ${by + 2} Z`,
            fill: "dark",
          },
        ],
        seams: [
          `M${b.sh[0] + 4} ${b.sh[1] - 1} L${bx - 22} ${by - 18}`,
          `M${b.sh[0] + 9} ${b.sh[1] - 1} L${bx - 17} ${by - 18}`,
        ],
        folds: [`M${bx - 18} ${by + 12} q18 4 36 0`],
        dots: [{ x: bx, y: by + 4, r: 2.6, fill: "metal" }],
        shade: false,
      });
    }
    case "watch": {
      const y = wristY(b) - 4;
      const xo = xAt(b.armOuter, y) - 1;
      const xi = xAt(b.armInner, y) + 1;
      return G({
        shapes: [
          { d: `M${xo} ${y - 4} L${xi} ${y - 3} L${xi} ${y + 5} L${xo} ${y + 4} Z`, fill: "main" },
        ],
        dots: [
          { x: (xo + xi) / 2, y: y + 0.5, r: 5.5, fill: "metal" },
          { x: (xo + xi) / 2, y: y + 0.5, r: 4, fill: "lens" },
        ],
        shade: false,
      });
    }
    default:
      return G({ shapes: [] });
  }
}

/** Molde de la prenda ajustado al cuerpo del modelo. */
export function garmentFor(kind: Kind, g: Gender): Garment {
  const b = BODIES[g];
  return (
    [top(b, kind, g), bottom(b, kind), shoes(b, kind), accessory(b, kind, g)].find(
      (x) => x.shapes.length || x.seams.length,
    ) ?? G({ shapes: [] })
  );
}

/** Ropa base neutra del modelo (top y short ceñidos). */
export function baseLayer(g: Gender): Garment {
  const b = BODIES[g];
  const f = g === "mujer";
  const { half, base } = b.neck;
  const topHem = f ? b.ch[1] + 26 : b.hi[1] - 18;
  const tank = sym([
    [C, base + (f ? 16 : 12)],
    [C - half - 5, base + 1],
    [b.sh[0] - 3, b.sh[1] + 2],
    [b.sh[0] - (f ? 7 : 9), b.sh[1] + 3, 1],
    [b.ap[0] + 9, (b.sh[1] + b.ap[1]) / 2 + 4],
    [b.ap[0] + 3, b.ap[1] + 6],
    [b.ch[0] - 1, b.ch[1] + 2],
    ...(f ? [] : ([[b.wa[0] - 1, b.wa[1]]] as Pt[])),
    [xAt(torsoSide(b), topHem) - 1, topHem, 1],
    [C, topHem + 1],
  ]);
  const shortTop = b.hi[1] - (f ? 30 : 22);
  const hemY = b.crotch + (f ? 14 : 30);
  const shorts = sym([
    [C, shortTop],
    [xAt(torsoSide(b), shortTop) - 1, shortTop, 1],
    [b.hi[0] - 1, b.hi[1]],
    [xAt(legOuter(b), hemY) - 1, hemY, 1],
    [xAt(legInner(b), hemY) + 1, hemY + 2, 1],
    [C, b.crotch + 2],
  ]);
  return G({
    shapes: [
      { d: tank, fill: "main" },
      { d: shorts, fill: "main", part: "legs" },
    ],
    seams: [
      `M${xAt(torsoSide(b), shortTop + 6)} ${shortTop + 6} L${W - xAt(torsoSide(b), shortTop + 6)} ${shortTop + 6}`,
    ],
  });
}

/* ---------- Color ---------- */

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mix(hex: string, to: string, t: number): string {
  const a = rgb(hex),
    b = rgb(to);
  return `#${a
    .map((v, i) =>
      Math.round(v + (b[i]! - v) * t)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

export const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

/** Colores derivados de la tela: sombra, luz, costuras y suela. */
export function palette(main: string) {
  const light = luminance(main);
  return {
    main,
    dark: mix(main, "#000000", 0.28),
    light: mix(main, "#ffffff", 0.28),
    seam: light < 0.28 ? mix(main, "#ffffff", 0.35) : mix(main, "#000000", 0.38),
    sole: light > 0.82 ? "#d6d1c8" : "#f3f1ec",
    lens: "#1b1e24",
    metal: "#c9a54a",
  };
}

/** Orden de dibujo de abajo hacia arriba. */
export const LAYER: Record<Kind, number> = {
  sneakers: 1,
  shoes: 1,
  heels: 1,
  leggings: 2,
  jeans: 2,
  pants: 2,
  joggers: 2,
  shorts: 2,
  skirt: 2,
  boots: 3,
  tshirt: 4,
  blouse: 4,
  shirt: 4,
  sweater: 4,
  hoodie: 4,
  dress: 4,
  necklace: 5,
  jacket: 6,
  coat: 6,
  ruana: 6,
  scarf: 7,
  bag: 8,
  watch: 8,
  glasses: 9,
  beanie: 10,
  cap: 10,
  hat: 10,
};
