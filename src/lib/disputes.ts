import { AUTO_CONFIRM_DAYS, HOLD_DAYS } from "@/lib/plaza";

export { AUTO_CONFIRM_DAYS };

export type DisputeKind = "plazax_pay" | "external_deal";
export type DisputeReason = "different" | "damaged" | "not_received" | "fraud" | "other";
export type DisputeStatus = "open" | "refunded" | "rejected" | "closed";
export type DisputeOutcome = "refund" | "reject" | "close";

/** Días tras la entrega para abrir una disputa. */
export const DISPUTE_WINDOW_DAYS = HOLD_DAYS;
export const DETAILS_MIN = 20;
export const DETAILS_MAX = 2000;
export const EVIDENCE_MAX = 8;

export const REASONS: { id: DisputeReason; label: string }[] = [
  { id: "different", label: "Recibí un producto diferente a la foto" },
  { id: "damaged", label: "Llegó defectuoso o averiado" },
  { id: "not_received", label: "Nunca llegó (extraviado o no enviado)" },
  { id: "fraud", label: "Intento de fraude / vendedor sospechoso" },
  { id: "other", label: "Otro problema" },
];
export const reasonLabel = (r: DisputeReason) => REASONS.find((x) => x.id === r)?.label ?? r;

export const STATUS_LABEL: Record<DisputeStatus, { text: string; tone: string }> = {
  open: {
    text: "En revisión · pago congelado",
    tone: "border-amber-200 bg-amber-50 text-amber-700",
  },
  refunded: { text: "Reembolsada", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  rejected: { text: "Rechazada", tone: "border-slate-200 bg-slate-100 text-slate-600" },
  closed: { text: "Cerrada", tone: "border-slate-200 bg-slate-100 text-slate-600" },
};

export const KIND_LABEL: Record<DisputeKind, string> = {
  plazax_pay: "Carrito Plaza X (protegido)",
  external_deal: "Trato externo (sin reembolso)",
};

export type DisputeInput = {
  reason: DisputeReason;
  details: string;
  evidence: string[];
};

/** Valida lo mismo que la base de datos para avisar antes de enviar. */
export function validateDispute(d: DisputeInput): string | null {
  const details = d.details.trim();
  if (!REASONS.some((r) => r.id === d.reason)) return "Elige un motivo";
  if (details.length < DETAILS_MIN) return `Cuéntanos qué pasó (mínimo ${DETAILS_MIN} caracteres)`;
  if (details.length > DETAILS_MAX) return `Máximo ${DETAILS_MAX} caracteres`;
  const ev = d.evidence.map((e) => e.trim()).filter(Boolean);
  if (ev.length > EVIDENCE_MAX) return `Máximo ${EVIDENCE_MAX} evidencias`;
  if (ev.some((e) => !/^(https:\/\/|evidence:)/.test(e) || e.length > 500))
    return "Las evidencias deben ser enlaces https o archivos subidos";
  return null;
}

/** ¿Puede el comprador abrir disputa sobre este artículo ahora? */
export function canDispute(
  it: { paidAt: string | null; fulfillment: string; deliveredAt: string | null },
  now = Date.now(),
) {
  if (!it.paidAt || it.fulfillment === "cancelled") return false;
  if (it.fulfillment !== "delivered") return true;
  return !!it.deliveredAt && now - Date.parse(it.deliveredAt) <= DISPUTE_WINDOW_DAYS * 86_400_000;
}

/** Fecha en que la entrega cuenta como confirmada (por el comprador o automática). */
export function effectiveDelivery(it: {
  fulfillment: string;
  deliveredAt: string | null;
  shippedAt: string | null;
}): number | null {
  if (it.fulfillment === "delivered" && it.deliveredAt) return Date.parse(it.deliveredAt);
  if (it.fulfillment === "shipped" && it.shippedAt)
    return Date.parse(it.shippedAt) + AUTO_CONFIRM_DAYS * 86_400_000;
  return null;
}

// ---------------------------------------------------------------------
// Transportadoras
// ---------------------------------------------------------------------
export const CARRIERS = [
  {
    id: "Interrapidísimo",
    url: (g: string) => `https://www.interrapidisimo.com/sigue-tu-envio/?guia=${g}`,
  },
  {
    id: "Servientrega",
    url: (g: string) => `https://www.servientrega.com/wps/portal/rastreo-envios?guia=${g}`,
  },
  {
    id: "Coordinadora",
    url: (g: string) => `https://www.coordinadora.com/rastreo/rastreo-de-guia/?guia=${g}`,
  },
  { id: "Envía", url: (g: string) => `https://envia.co/rastreo?guia=${g}` },
  { id: "TCC", url: (g: string) => `https://tcc.com.co/rastreo/?guia=${g}` },
  { id: "Entrega local", url: null },
] as const;

export type Carrier = (typeof CARRIERS)[number]["id"];

export function trackingUrl(carrier: string | null, guide: string | null): string | null {
  if (!carrier || !guide?.trim()) return null;
  const c = CARRIERS.find((x) => x.id === carrier);
  return c?.url ? c.url(encodeURIComponent(guide.trim())) : null;
}
