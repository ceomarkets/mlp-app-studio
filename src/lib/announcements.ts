/**
 * Reglas de los anuncios de la plataforma. Son las mismas que valida la base
 * de datos (drizzle/migrations/0002_announcements.sql); aquí se usan para
 * avisar antes de guardar y en el modo demo.
 */
import type { Announcement, AnnouncementInput, AnnouncementTone } from "@/lib/backend/types";
import { AFFILIATE_MAX, BUNDLE_MIN, BUNDLE_RATE } from "@/lib/plaza";

export const TONES: { id: AnnouncementTone; label: string; badge: string }[] = [
  { id: "promo", label: "Promoción", badge: "PROMO" },
  { id: "news", label: "Novedad", badge: "NOVEDAD" },
  { id: "event", label: "Evento", badge: "EVENTO" },
  { id: "info", label: "Aviso", badge: "AVISO" },
];

export const toneBadge = (t: AnnouncementTone) => TONES.find((x) => x.id === t)?.badge ?? "AVISO";

/** Solo rutas internas ("/algo") o https://. Nunca javascript: ni otros esquemas. */
export const isSafeLink = (link: string) => /^(\/[^/]|\/$|https:\/\/)/.test(link);

export const isExternal = (link: string) => link.startsWith("https://");

export type AnnouncementState = "live" | "scheduled" | "expired" | "paused";

export function announcementState(
  a: Pick<Announcement, "active" | "startsAt" | "endsAt">,
  now = Date.now(),
): AnnouncementState {
  if (!a.active) return "paused";
  if (Date.parse(a.startsAt) > now) return "scheduled";
  if (a.endsAt && Date.parse(a.endsAt) <= now) return "expired";
  return "live";
}

export const isLive = (a: Pick<Announcement, "active" | "startsAt" | "endsAt">, now = Date.now()) =>
  announcementState(a, now) === "live";

/** Más prioridad primero; a igual prioridad, el más reciente. */
export const byPriority = (a: Announcement, b: Announcement) =>
  b.priority - a.priority || b.createdAt.localeCompare(a.createdAt);

/** Devuelve el primer problema encontrado, o null si el anuncio es válido. */
export function validateAnnouncement(a: AnnouncementInput): string | null {
  const title = a.title.trim();
  if (title.length < 3 || title.length > 80) return "El título debe tener entre 3 y 80 caracteres";
  if (a.body.trim().length > 160) return "El texto no puede pasar de 160 caracteres";
  if (!a.emoji.trim() || [...a.emoji.trim()].length > 4) return "Elige un ícono";
  const cta = a.cta.trim();
  if (cta.length < 2 || cta.length > 24) return "El botón debe tener entre 2 y 24 caracteres";
  if (a.link && !isSafeLink(a.link.trim()))
    return "El enlace debe empezar por / (página de Plaza X) o https://";
  if (a.image && !a.image.trim().startsWith("https://"))
    return "La imagen debe ser un enlace https://";
  if (a.priority < 0 || a.priority > 100) return "La prioridad va de 0 a 100";
  if (Number.isNaN(Date.parse(a.startsAt))) return "Fecha de inicio inválida";
  if (
    a.endsAt &&
    (Number.isNaN(Date.parse(a.endsAt)) || Date.parse(a.endsAt) <= Date.parse(a.startsAt))
  )
    return "La fecha de fin debe ser posterior al inicio";
  return null;
}

/** Limpia espacios y convierte vacíos en null antes de guardar. */
export function normalizeAnnouncement(a: AnnouncementInput): AnnouncementInput {
  return {
    ...a,
    title: a.title.trim(),
    body: a.body.trim(),
    emoji: a.emoji.trim(),
    cta: a.cta.trim(),
    link: a.link?.trim() || null,
    image: a.image?.trim() || null,
    endsAt: a.endsAt || null,
  };
}

/**
 * Anuncios propios de Plaza X. Se muestran en el leaderboard solo mientras la
 * administración no haya publicado anuncios, para que la cinta nunca quede
 * vacía (por ejemplo, con la base de datos recién creada). Todo lo que dicen
 * es real: el descuento por volumen, la comisión máxima y los medios de pago.
 */
export function platformAnnouncements(): Announcement[] {
  const base = {
    image: null,
    active: true,
    startsAt: "2026-01-01T00:00:00.000Z",
    endsAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  const list: Announcement[] = [];
  if (BUNDLE_RATE > 0)
    list.push({
      ...base,
      id: "plaza-bundle",
      title: `Desafío ${BUNDLE_MIN} = ${Math.round(BUNDLE_RATE * 100)}% OFF`,
      body: `Lleva ${BUNDLE_MIN} productos y paga ${Math.round(BUNDLE_RATE * 100)}% menos en tu compra.`,
      emoji: "🎁",
      link: null,
      cta: "Ver cómo",
      tone: "promo",
      priority: 100,
    });
  list.push(
    {
      ...base,
      id: "plaza-store",
      title: "Abre tu tienda en Plaza X",
      body: "Publica tus productos sin pagos por adelantado y vende con afiliados.",
      emoji: "🏪",
      link: "/vendedores",
      cta: "Abrir tienda",
      tone: "news",
      priority: 90,
    },
    {
      ...base,
      id: "plaza-affiliate",
      title: `Gana hasta ${Math.round(AFFILIATE_MAX * 100)}% recomendando`,
      body: "Comparte un enlace por WhatsApp y cobra en Nequi por cada venta.",
      emoji: "💸",
      link: "/afiliados",
      cta: "Activar enlace",
      tone: "event",
      priority: 80,
    },
    {
      ...base,
      id: "plaza-pay",
      title: "Pago seguro con Wompi",
      body: "Tarjeta, PSE, Nequi o botón Bancolombia.",
      emoji: "🛡️",
      link: null,
      cta: "Saber más",
      tone: "info",
      priority: 70,
    },
  );
  return list;
}
