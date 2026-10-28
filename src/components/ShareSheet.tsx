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
const NETWORKS: {
  id: string;
  label: string;
  color: string;
  href: (d: ShareData) => string;
  icon: ReactNode;
}[] = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    color: "bg-[#25D366]",
    href: (d) => `https://wa.me/?text=${enc(`${d.text} ${d.url}`)}`,
    icon: (
      <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z" />
    ),
  },
  {
    id: "facebook",
    label: "Facebook",
    color: "bg-[#1877F2]",
    href: (d) => `https://www.facebook.com/sharer/sharer.php?u=${enc(d.url)}`,
    icon: <path d="M14 8h3V4h-3c-2.8 0-4 1.8-4 4.3V10H7v4h3v8h4v-8h3l1-4h-4V8.6c0-.4.3-.6.6-.6z" />,
  },
  {
    id: "x",
    label: "X",
    color: "bg-black",
    href: (d) => `https://x.com/intent/post?text=${enc(d.text)}&url=${enc(d.url)}`,
    icon: (
      <path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.3L5.3 21H2.2l7.2-8.3L2 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z" />
    ),
  },
  {
    id: "telegram",
    label: "Telegram",
    color: "bg-[#229ED9]",
    href: (d) => `https://t.me/share/url?url=${enc(d.url)}&text=${enc(d.text)}`,
    icon: (
      <path d="M21.4 4.2 2.9 11.3c-1.3.5-1.2 1.2-.2 1.5l4.7 1.5 1.8 5.6c.2.6.4.8.9.8.4 0 .6-.2.9-.5l2.3-2.2 4.7 3.5c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.3-.5-1.8-1.4-1.5zM8.5 14l9.4-5.9c.4-.3.8-.1.5.2L10.6 15l-.3 3.3L8.5 14z" />
    ),
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
      await navigator.clipboard.writeText(`${data.text} ${data.url}`);
      setCopied(true);
      toast.success("¡Enlace copiado!");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("No se pudo copiar");
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Compártelo 💛</DialogTitle>
          <DialogDescription className="line-clamp-2">{data.text}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-4 gap-3">
          {NETWORKS.map((n) => (
            <a
              key={n.id}
              href={n.href(data)}
              target="_blank"
              rel="noreferrer"
              className="flex flex-col items-center gap-1.5 text-xs font-semibold"
              onClick={() => onOpenChange(false)}
            >
              <span
                className={cn(
                  "grid size-12 place-items-center rounded-2xl text-white shadow-card transition hover:scale-105",
                  n.color,
                )}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="size-6" aria-hidden>
                  {n.icon}
                </svg>
              </span>
              {n.label}
            </a>
          ))}
        </div>
        <button
          onClick={copy}
          className="flex items-center gap-2 rounded-xl border bg-muted px-3 py-2.5 text-left text-sm"
        >
          <span className="min-w-0 flex-1 truncate font-mono text-xs">{data.url}</span>
          {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
        </button>
      </DialogContent>
    </Dialog>
  );
}

/** Botón de compartir: hoja nativa en el celular, redes sociales en escritorio. */
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
          const d = data();
          setCurrent(d);
          void shareOrFallback(d, () => setOpen(true));
        }}
      >
        {children ?? <Share2 className="size-4" />}
      </button>
      {current && <ShareDialog data={current} open={open} onOpenChange={setOpen} />}
    </>
  );
}
