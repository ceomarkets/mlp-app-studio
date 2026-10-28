import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { discountPct } from "@/lib/feed";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  backend,
  type Product,
  type ProductInput,
  type Store,
  type StoreInput,
} from "@/lib/backend";
import {
  AFFILIATE_MAX,
  AFFILIATE_MIN,
  CATEGORIES,
  cop,
  slugify,
  splitSale,
  type Category,
} from "@/lib/plaza";
import { keys } from "@/lib/session";
import { cn } from "@/lib/utils";

const EMOJIS = [
  "🛍️",
  "🧶",
  "☕",
  "🎨",
  "🥔",
  "🍯",
  "🌽",
  "🧀",
  "🌸",
  "🧴",
  "👜",
  "👟",
  "📱",
  "🪴",
  "🍫",
  "🐟",
];

/** Barra y desglose de cuánto recibe cada parte. */
export function SplitPreview({ price, rate }: { price: number; rate: number }) {
  const s = splitSale(price, rate);
  const parts = [
    { k: "Tú recibes", v: s.seller, c: "bg-ink text-ink-foreground" },
    {
      k: `Afiliado (${Math.round(rate * 100)}%)`,
      v: s.affiliate,
      c: "bg-sun text-accent-foreground",
    },
    { k: "Plaza X (9%)", v: s.platform, c: "bg-primary text-primary-foreground" },
  ];
  return (
    <div className="space-y-2">
      <div className="flex h-3 overflow-hidden rounded-full bg-muted">
        {parts.map((p) => (
          <div
            key={p.k}
            className={cn(p.c, "transition-all")}
            style={{ width: `${price ? (p.v / price) * 100 : 0}%` }}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        {parts.map((p) => (
          <div key={p.k} className={cn("rounded-lg px-2 py-1.5", p.c)}>
            <div className="opacity-80">{p.k}</div>
            <div className="font-display text-sm font-bold">{cop(p.v)}</div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Si la venta no viene de un afiliado, la parte del afiliado también es tuya.
      </p>
    </div>
  );
}

export function StoreForm({
  store,
  onSaved,
}: {
  store?: Store | null;
  onSaved?: (s: Store) => void;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState<StoreInput>({
    name: store?.name ?? "",
    slug: store?.slug ?? "",
    tagline: store?.tagline ?? "",
    city: store?.city ?? "",
    emoji: store?.emoji ?? "🛍️",
    whatsapp: store?.whatsapp ?? "",
  });
  const [slugTouched, setSlugTouched] = useState(!!store);
  const save = useMutation({
    mutationFn: () =>
      backend.saveStore({
        ...f,
        name: f.name.trim(),
        tagline: f.tagline.trim(),
        city: f.city.trim(),
        whatsapp: f.whatsapp?.trim() || null,
      }),
    onSuccess: (s) => {
      qc.setQueryData(keys.myStore, s);
      qc.invalidateQueries({ queryKey: ["catalog"] });
      toast.success(store ? "Tienda actualizada" : "¡Tu tienda está abierta!");
      onSaved?.(s);
    },
    onError: (e) => toast.error(e.message),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="sn">Nombre de la tienda</Label>
        <Input
          id="sn"
          required
          minLength={2}
          maxLength={60}
          value={f.name}
          onChange={(e) =>
            setF({
              ...f,
              name: e.target.value,
              slug: slugTouched ? f.slug : slugify(e.target.value),
            })
          }
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ss">Dirección web</Label>
        <div className="flex items-center rounded-md border bg-background pl-3 text-sm focus-within:ring-1 focus-within:ring-ring">
          <span className="text-muted-foreground">plazax.co/tienda/</span>
          <input
            id="ss"
            required
            pattern="[a-z0-9-]{3,40}"
            className="h-9 flex-1 bg-transparent pr-3 outline-none"
            value={f.slug}
            onChange={(e) => {
              setSlugTouched(true);
              setF({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") });
            }}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="st">Frase corta</Label>
        <Input
          id="st"
          maxLength={120}
          placeholder="Ej.: Café especial del sur de Colombia"
          value={f.tagline}
          onChange={(e) => setF({ ...f, tagline: e.target.value })}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sc">Ciudad</Label>
          <Input
            id="sc"
            maxLength={40}
            value={f.city}
            onChange={(e) => setF({ ...f, city: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sw">WhatsApp (opcional)</Label>
          <Input
            id="sw"
            inputMode="tel"
            value={f.whatsapp ?? ""}
            onChange={(e) => setF({ ...f, whatsapp: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Ícono</Label>
        <div className="flex flex-wrap gap-1.5">
          {EMOJIS.map((em) => (
            <button
              key={em}
              type="button"
              onClick={() => setF({ ...f, emoji: em })}
              className={cn(
                "grid size-10 place-items-center rounded-xl border text-xl",
                f.emoji === em && "border-primary bg-primary/10",
              )}
            >
              {em}
            </button>
          ))}
        </div>
      </div>
      <Button type="submit" size="lg" disabled={save.isPending}>
        {save.isPending && <Loader2 className="animate-spin" />}{" "}
        {store ? "Guardar cambios" : "Abrir mi tienda"}
      </Button>
    </form>
  );
}

const empty: ProductInput = {
  name: "",
  description: "",
  price: 50000,
  category: "Artesanías",
  commission: 0.1,
  stock: 10,
  images: [],
  emoji: "📦",
  active: true,
  compareAtPrice: null,
};

export function ProductDialog({
  product,
  open,
  onOpenChange,
}: {
  product: Product | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState<ProductInput>(empty);
  const [uploading, setUploading] = useState(false);
  const discount = discountPct({ price: f.price, compareAtPrice: f.compareAtPrice });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setF(
      product
        ? {
            id: product.id,
            name: product.name,
            description: product.description,
            price: product.price,
            compareAtPrice: product.compareAtPrice,
            category: product.category,
            commission: product.commission,
            stock: product.stock,
            images: product.images,
            emoji: product.emoji,
            active: product.active,
          }
        : empty,
    );
  }, [open, product]);

  const save = useMutation({
    mutationFn: () =>
      backend.saveProduct({ ...f, name: f.name.trim(), description: f.description.trim() }),
    onSuccess: () => {
      toast.success(product ? "Producto actualizado" : "Producto publicado");
      qc.invalidateQueries({ queryKey: keys.myProducts });
      qc.invalidateQueries({ queryKey: ["catalog"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, 5 - f.images.length)) {
        if (!file.type.startsWith("image/")) continue;
        urls.push(await backend.uploadImage(file));
      }
      setF((prev) => ({ ...prev, images: [...prev.images, ...urls].slice(0, 5) }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Editar producto" : "Nuevo producto"}</DialogTitle>
          <DialogDescription>
            Los afiliados verán tu comisión y podrán promocionarlo de inmediato.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div>
            <Label>Fotos ({f.images.length}/5)</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {f.images.map((src, i) => (
                <div
                  key={src.slice(-40) + i}
                  className="group relative size-20 overflow-hidden rounded-xl border"
                >
                  <img src={src} alt="" className="size-full object-cover" />
                  {i === 0 && (
                    <span className="absolute bottom-0 left-0 right-0 bg-ink/80 text-center text-[10px] text-ink-foreground">
                      Portada
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label="Quitar foto"
                    className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-background/90"
                    onClick={() => setF({ ...f, images: f.images.filter((_, k) => k !== i) })}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              {f.images.length < 5 && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="grid size-20 place-items-center rounded-xl border border-dashed text-muted-foreground hover:border-primary hover:text-primary"
                >
                  {uploading ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <ImagePlus className="size-5" />
                  )}
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hidden
                onChange={(e) => upload(e.target.files)}
              />
            </div>
            {!f.images.length && (
              <p className="mt-1 text-xs text-muted-foreground">
                Sin fotos se muestra el ícono {f.emoji}. Las fotos venden hasta 3 veces más.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_96px]">
            <div className="space-y-1.5">
              <Label htmlFor="pn">Nombre</Label>
              <Input
                id="pn"
                required
                minLength={2}
                maxLength={80}
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pe">Ícono</Label>
              <Input
                id="pe"
                maxLength={4}
                value={f.emoji}
                onChange={(e) => setF({ ...f, emoji: e.target.value || "📦" })}
                className="text-center text-xl"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pd">Descripción</Label>
            <Textarea
              id="pd"
              rows={3}
              maxLength={2000}
              value={f.description}
              onChange={(e) => setF({ ...f, description: e.target.value })}
              placeholder="Materiales, tamaño, cómo se hace, qué lo hace especial…"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pp">Precio (COP)</Label>
              <Input
                id="pp"
                type="number"
                required
                min={1000}
                max={50000000}
                step={500}
                value={f.price}
                onChange={(e) => setF({ ...f, price: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pa" className="flex items-center justify-between">
                <span>Precio antes (opcional)</span>
                {discount > 0 && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                    −{discount}%
                  </span>
                )}
              </Label>
              <Input
                id="pa"
                type="number"
                min={0}
                step={500}
                placeholder="Para mostrar una oferta"
                value={f.compareAtPrice ?? ""}
                onChange={(e) =>
                  setF({ ...f, compareAtPrice: e.target.value ? Number(e.target.value) : null })
                }
              />
              {f.compareAtPrice !== null && discount <= 0 && (
                <p className="text-xs text-destructive">Debe ser mayor que el precio actual.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps">Unidades en stock</Label>
              <Input
                id="ps"
                type="number"
                required
                min={0}
                value={f.stock}
                onChange={(e) => setF({ ...f, stock: Math.max(0, Number(e.target.value)) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pc">Categoría</Label>
              <select
                id="pc"
                value={f.category}
                onChange={(e) => setF({ ...f, category: e.target.value as Category })}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl bg-muted p-4">
            <Label htmlFor="pk" className="flex justify-between">
              <span>Comisión para afiliados</span>
              <b>{Math.round(f.commission * 100)}%</b>
            </Label>
            <input
              id="pk"
              type="range"
              min={AFFILIATE_MIN * 100}
              max={AFFILIATE_MAX * 100}
              value={Math.round(f.commission * 100)}
              onChange={(e) => setF({ ...f, commission: Number(e.target.value) / 100 })}
              className="w-full accent-primary"
            />
            <SplitPreview price={f.price || 0} rate={f.commission} />
          </div>

          <label className="flex items-center justify-between rounded-xl border p-3">
            <span className="text-sm">
              <b>Visible en la plaza</b>
              <br />
              <span className="text-muted-foreground">
                Desactívalo para pausar la venta sin borrarlo.
              </span>
            </span>
            <Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} />
          </label>

          <Button type="submit" size="lg" className="w-full" disabled={save.isPending || uploading}>
            {save.isPending && <Loader2 className="animate-spin" />}{" "}
            {product ? "Guardar cambios" : "Publicar producto"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
