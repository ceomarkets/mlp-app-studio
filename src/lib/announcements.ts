/**
 * Reglas de los anuncios de la plataforma. Son las mismas que valida la base
 * de datos (drizzle/migrations/0002_announcements.sql); aquí se usan para
 * avisar antes de guardar y en el modo demo.
 */
import type { Announcement, AnnouncementInput, AnnouncementTone } from "@/lib/backend/types";

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
