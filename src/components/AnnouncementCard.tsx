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

/** Insignia translúcida por tipo de anuncio (estilo de la cinta oscura). */
export const TONE_BADGE: Record<AnnouncementTone, string> = {
  promo: "border-rose-400/30 bg-rose-500/20 text-rose-300",
  news: "border-indigo-400/30 bg-indigo-500/20 text-indigo-300",
  event: "border-fuchsia-400/30 bg-fuchsia-500/20 text-fuchsia-300",
  info: "border-slate-300/30 bg-slate-400/20 text-slate-200",
};

const TONE_TILE: Record<AnnouncementTone, string> = {
  promo: "from-primary to-rose-500",
  news: "from-indigo-500 to-sky-500",
  event: "from-fuchsia-500 to-amber-400",
  info: "from-slate-500 to-slate-700",
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

/** Tarjeta del anuncio con el mismo tamaño y estilo que las del leaderboard. */
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
  const inner: ReactNode = (
    <span className="flex items-center gap-3">
      <span
        className={cn(
          "relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br text-3xl",
          TONE_TILE[a.tone],
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
      </span>
      <span className="min-w-0 flex-1">
        <span className="mb-1 flex items-center gap-1">
          <span
            className={cn(
              "inline-flex items-center gap-1 truncate rounded-full border px-1.5 py-0.5 text-[9px] font-semibold",
              TONE_BADGE[a.tone],
            )}
          >
            <Megaphone className="size-2.5" /> {toneBadge(a.tone)}
          </span>
        </span>
        <span className="block truncate text-xs font-bold text-ink-foreground transition-colors group-hover:text-sun">
          {a.title || "Título del anuncio"}
        </span>
        {a.body && (
          <span className="mb-1 line-clamp-2 text-[10px] leading-snug text-ink-foreground/70">
            {a.body}
          </span>
        )}
        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-sun">
          {a.cta || "Ver más"}
          {a.link && isExternal(a.link) ? (
            <ExternalLink className="size-3" />
          ) : (
            <ArrowRight className="size-3" />
          )}
        </span>
      </span>
    </span>
  );
  const cls =
    "group block w-72 shrink-0 rounded-xl border border-ink-foreground/10 bg-ink-foreground/5 p-3 text-left transition-all duration-300 hover:border-primary/60 focus-visible:border-primary focus-visible:outline-none";
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
