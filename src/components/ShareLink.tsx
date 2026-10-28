import { Copy, QrCode, Share2 } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Product } from "@/lib/backend";
import { cop } from "@/lib/plaza";
import { cn } from "@/lib/utils";

export function useOrigin() {
  const [origin, setOrigin] = useState("https://plazax.co");
  useEffect(() => setOrigin(window.location.origin), []);
  return origin;
}

export const affiliateLink = (origin: string, username: string, productId: string) =>
  `${origin}/r/${username}/${productId}`;

/** Enlace de afiliado con copiar, WhatsApp, compartir nativo y código QR. */
export function ShareLink({
  username,
  product,
  className,
  compact = false,
}: {
  username: string;
  product: Product;
  className?: string;
  compact?: boolean;
}) {
  const origin = useOrigin();
  const link = affiliateLink(origin, username, product.id);
  const [qr, setQr] = useState<string | null>(null);
  const message = `${product.name} de ${product.store.name} a ${cop(product.price)} 👉 ${link}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Enlace copiado", { description: link });
    } catch {
      toast.error("No se pudo copiar, mantén presionado el enlace");
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: product.name, text: message, url: link });
      } catch {
        /* cancelado */
      }
    } else copy();
  }

  async function showQr() {
    setQr(
      await QRCode.toDataURL(link, {
        width: 480,
        margin: 1,
        color: { dark: "#1f3a2c", light: "#ffffff" },
      }),
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {!compact && (
        <div className="truncate rounded-lg bg-background/70 px-3 py-2 font-mono text-xs">
          {link}
        </div>
      )}
      <div className="flex gap-2">
        <Button size="sm" className="flex-1" onClick={copy}>
          <Copy /> Copiar
        </Button>
        <Button size="sm" variant="outline" asChild aria-label="Compartir por WhatsApp">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noreferrer"
          >
            <WhatsApp />
          </a>
        </Button>
        <Button size="sm" variant="outline" onClick={share} aria-label="Compartir">
          <Share2 />
        </Button>
        <Button size="sm" variant="outline" onClick={showQr} aria-label="Código QR">
          <QrCode />
        </Button>
      </div>
      <Dialog open={!!qr} onOpenChange={(o) => !o && setQr(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{product.name}</DialogTitle>
            <DialogDescription>
              Imprímelo o compártelo: cada escaneo cuenta como clic tuyo.
            </DialogDescription>
          </DialogHeader>
          {qr && (
            <img
              src={qr}
              alt={`Código QR para ${product.name}`}
              className="w-full rounded-xl border"
            />
          )}
          <Button asChild>
            <a href={qr ?? "#"} download={`qr-${product.id}.png`}>
              Descargar QR
            </a>
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WhatsApp() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.3c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.3 8.3 0 1 1 12 20.3z" />
    </svg>
  );
}
