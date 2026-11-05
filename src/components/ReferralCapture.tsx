import { useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { backend } from "@/lib/backend";
import { cleanSource, referral } from "@/lib/client-state";

const SEEN = "plazax-ref-seen";

/**
 * Enlaces de afiliado en cualquier página: `?ref=usuario` (o `aff=`) y, si se quiere medir
 * el canal, `src=` o `utm_source=`. Guarda la atribución 30 días (último clic gana) y
 * registra el clic una sola vez por enlace abierto.
 */
export function ReferralCapture() {
  const { pathname, searchStr } = useLocation();
  useEffect(() => referral.hydrate(), []);
  useEffect(() => {
    const q = new URLSearchParams(searchStr);
    const user = (q.get("ref") ?? q.get("aff") ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!/^[a-z0-9-]{3,30}$/.test(user)) return;
    const source = cleanSource(q.get("src") ?? q.get("utm_source"));
    referral.set(user, source);
    const key = `${pathname}?${searchStr}`;
    try {
      if (sessionStorage.getItem(SEEN) === key) return;
      sessionStorage.setItem(SEEN, key);
    } catch {
      /* sin almacenamiento: se registra igual */
    }
    const product = pathname.match(/^\/producto\/([^/]+)/)?.[1] ?? null;
    backend.trackClick(user, product, source).catch(() => undefined);
  }, [pathname, searchStr]);
  return null;
}
