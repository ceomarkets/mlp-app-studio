import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, ExternalLink, Megaphone } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isExternal, isSafeLink, toneBadge } from "@/lib/announcements";
import type { Announcement, AnnouncementTone } from "@/lib/backend";
import { cn } from "@/lib/utils";

/** Insignia translúcida por tipo de anuncio (paleta de la cinta del leaderboard). */
export const TONE_BADGE: Record<AnnouncementTone, string> = {
  promo: "border-rose-500/30 bg-rose-500/20 text-rose-400",
  news: "border-indigo-500/30 bg-indigo-500/20 text-indigo-400",
  event: "border-fuchsia-500/30 bg-fuchsia-500/20 text-fuchsia-400",
  info: "border-sky-500/30 bg-sky-500/20 text-sky-400",
};

const TONE_TILE: Record<AnnouncementTone, string> = {
  promo: "from-rose-500 to-amber-500",
  news: "from-indigo-500 to-sky-500",
  event: "from-fuchsia-500 to-amber-400",
  info: "from-sky-600 to-slate-700",
};

type Previewable = Pick<
  Announcement,
  "title" | "body" | "emoji" | "image" | "link" | "cta" | "tone"
>;

/** Abre el destino del anuncio. Devuelve false si no tiene enlace. */
export function useOpenAnnouncement() {
  const navigate = useNavigate();
  return (a: Pick<Announcement, "link">) => {
    const link = a.link?.trim();
    if (!link || !isSafeLink(link)) return false;
    if (isExternal(link)) window.open(link, "_blank", "noopener,noreferrer");
    else navigate({ href: link });
    return true;
  };
}

/**
 * Tarjeta del anuncio: misma estructura, tamaño y colores que las tarjetas de
 * producto del leaderboard, para que el anuncio se lea como parte de la cinta.
 */
export function AnnouncementCard({
  a,
  onSelect,
  tabbable = true,
  as = "button",
}: {
  a: Previewable;
  onSelect?: () => void;
  tabbable?: boolean;
  as?: "button" | "div";
}) {
  const external = !!a.link && isExternal(a.link);
  const inner: ReactNode = (
    <span className="flex items-center gap-3">
      {/* Imagen o ícono */}
      <span
        className={cn(
          "relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-950 bg-gradient-to-br text-4xl",
          !a.image && TONE_TILE[a.tone],
        )}
      >
        {a.image ? (
          <img
            src={a.image}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <span aria-hidden>{a.emoji || "📣"}</span>
        )}
        <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded bg-amber-500 px-1 text-[9px] font-black text-slate-950">
          <Megaphone className="size-2.5" />
        </span>
      </span>

      {/* Información */}
      <span className="min-w-0 flex-1">
        <span className="mb-1 flex items-center justify-between gap-1">
          <span
            className={cn(
              "truncate rounded-full border px-1.5 py-0.5 text-[9px] font-semibold",
              TONE_BADGE[a.tone],
            )}
          >
            {toneBadge(a.tone)}
          </span>
          <span className="shrink-0 text-[10px] text-slate-400">Anuncio</span>
        </span>
        <span className="block truncate text-xs font-bold text-white transition-colors group-hover:text-indigo-400">
          {a.title || "Título del anuncio"}
        </span>
        <span className="mb-1 flex items-center gap-1 truncate text-[10px] text-slate-400">
          <Megaphone className="size-3 shrink-0 text-slate-500" /> Plaza X
        </span>

        {/* Recuadro inferior: mensaje y llamado a la acción */}
        <span className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-slate-800/80 bg-slate-950/80 p-1.5">
          <span className="line-clamp-2 min-w-0 text-[10px] leading-snug text-slate-300">
            {a.body || "Toca para ver más"}
          </span>
          <span className="flex shrink-0 items-center gap-0.5 text-[10px] font-extrabold uppercase text-indigo-400">
            {a.cta || "Ver más"}
            {external ? <ExternalLink className="size-3" /> : <ArrowRight className="size-3" />}
          </span>
        </span>
      </span>
    </span>
  );
  const cls =
    "group block w-80 shrink-0 rounded-xl border border-slate-800 bg-slate-900 p-3 text-left transition-all duration-300 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 focus-visible:border-indigo-500 focus-visible:outline-none";
  if (as === "div") return <div className={cls}>{inner}</div>;
  return (
    <button
      type="button"
      onClick={onSelect}
      tabIndex={tabbable ? 0 : -1}
      className={cn(cls, "cursor-pointer")}
    >
      {inner}
    </button>
  );
}

/** Para anuncios sin enlace: muestra el mensaje completo. */
export function AnnouncementDialog({
  a,
  onClose,
}: {
  a: Announcement | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!a} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm text-center">
        {a && (
          <>
            <DialogHeader className="items-center">
              <span
                className={cn(
                  "mb-2 grid size-16 place-items-center rounded-2xl bg-gradient-to-br text-4xl shadow-card",
                  TONE_TILE[a.tone],
                )}
              >
                {a.emoji}
              </span>
              <DialogTitle className="text-xl">{a.title}</DialogTitle>
              <DialogDescription>{a.body}</DialogDescription>
            </DialogHeader>
            <Button onClick={onClose}>¡Entendido!</Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
