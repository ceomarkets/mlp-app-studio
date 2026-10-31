import { Check, Copy, Share2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ShareData = { title: string; text: string; url: string };

/** Abre la hoja nativa del celular; si no existe, muestra la nuestra. */
export async function shareOrFallback(data: ShareData, fallback: () => void) {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share(data);
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  fallback();
}

const enc = encodeURIComponent;
const isMobile = () =>
  typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/** Redes del diseño Plaza X: WhatsApp, Facebook, Messenger y X. */
const NETWORKS: {
  id: string;
  label: string;
  bg: string;
  icon: string;
  href: (d: ShareData) => string;
}[] = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    bg: "bg-emerald-500 hover:bg-emerald-600",
    icon: "fa-whatsapp text-xl",
    href: (d) => `https://api.whatsapp.com/send?text=${enc(`${d.text} ${d.url}`)}`,
  },
  {
    id: "facebook",
    label: "Facebook",
    bg: "bg-blue-600 hover:bg-blue-700",
    icon: "fa-facebook-f text-xl",
    href: (d) => `https://www.facebook.com/sharer/sharer.php?u=${enc(d.url)}`,
  },
  {
    id: "messenger",
    label: "Messenger",
    bg: "bg-gradient-to-tr from-blue-500 via-indigo-500 to-purple-500 hover:opacity-90",
    icon: "fa-facebook-messenger text-xl",
    href: (d) =>
      isMobile()
        ? `fb-messenger://share/?link=${enc(d.url)}`
        : `https://www.facebook.com/dialog/send?link=${enc(d.url)}&app_id=291494419107518&redirect_uri=${enc(d.url)}`,
  },
  {
    id: "x",
    label: "X (Twitter)",
    bg: "bg-slate-900 hover:bg-black",
    icon: "fa-x-twitter text-lg",
    href: (d) => `https://twitter.com/intent/tweet?url=${enc(d.url)}&text=${enc(d.text)}`,
  },
];

export function ShareDialog({
  data,
  open,
  onOpenChange,
}: {
  data: ShareData;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(data.url);
      setCopied(true);
      toast.success("¡Enlace directo copiado al portapapeles!");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("No se pudo copiar");
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-800 shadow-2xl">
        <span className="mx-auto mb-1 grid size-12 place-items-center rounded-2xl border border-indigo-200 bg-indigo-50 text-xl text-indigo-600">
          <i className="fa-solid fa-share-nodes" />
        </span>
        <DialogHeader className="items-center text-center sm:text-center">
          <DialogTitle className="text-base font-bold text-slate-900">
            Compartir {data.title}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Invita a tus amigos o promociona tu tienda en redes sociales
          </DialogDescription>
        </DialogHeader>
        <div className="my-2 grid grid-cols-4 gap-3">
          {NETWORKS.map((n) => (
            <a
              key={n.id}
              href={n.href(data)}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center gap-1.5"
              onClick={() => onOpenChange(false)}
            >
              <span
                className={cn(
                  "grid size-12 place-items-center rounded-2xl text-white shadow-md transition-transform group-hover:scale-105",
                  n.bg,
                )}
              >
                <i className={cn("fa-brands", n.icon)} aria-hidden />
              </span>
              <span className="text-[10px] font-bold text-slate-700">{n.label}</span>
            </a>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
          <input
            readOnly
            value={data.url}
            aria-label="Enlace directo"
            onFocus={(e) => e.currentTarget.select()}
            className="w-full truncate border-none bg-transparent text-xs font-medium text-slate-600 focus:outline-none"
          />
          <button
            onClick={copy}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-slate-800"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />} Copiar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Botón de compartir: abre la ventana de redes (WhatsApp, Facebook, Messenger, X) y copiar enlace. */
export function ShareButton({
  data,
  className,
  children,
}: {
  data: () => ShareData;
  className?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<ShareData | null>(null);
  return (
    <>
      <button
        type="button"
        aria-label={children ? undefined : "Compartir"}
        className={className}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setCurrent(data());
          setOpen(true);
        }}
      >
        {children ?? <Share2 className="size-4" />}
      </button>
      {current && <ShareDialog data={current} open={open} onOpenChange={setOpen} />}
    </>
  );
}
