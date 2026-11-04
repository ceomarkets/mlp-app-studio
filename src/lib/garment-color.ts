import { useEffect, useState } from "react";
import type { Product } from "@/lib/backend";
import { colorFromName, DEFAULT_COLOR, dominantColor, kindOf } from "@/lib/vestidor";

const cache = new Map<string, string | null>();
const SIZE = 40;

/** Lee el color dominante de la foto (si el servidor de la imagen lo permite). */
function readImage(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = c.height = SIZE;
        const ctx = c.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        resolve(dominantColor(ctx.getImageData(0, 0, SIZE, SIZE).data, SIZE));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Color con que se dibuja cada prenda: el nombrado en el producto, el de la foto o uno típico. */
export function useGarmentColors(products: Product[]): Record<string, string> {
  const [, bump] = useState(0);
  useEffect(() => {
    let alive = true;
    for (const p of products) {
      const url = p.images[0];
      if (!url || cache.has(url) || colorFromName(p)) continue;
      cache.set(url, null);
      void readImage(url).then((c) => {
        cache.set(url, c);
        if (alive && c) bump((n) => n + 1);
      });
    }
    return () => {
      alive = false;
    };
  }, [products]);

  const out: Record<string, string> = {};
  for (const p of products) {
    const kind = kindOf(p);
    out[p.id] =
      colorFromName(p) ??
      (p.images[0] ? cache.get(p.images[0]) : null) ??
      (kind && DEFAULT_COLOR[kind]) ??
      "#5b6476";
  }
  return out;
}
