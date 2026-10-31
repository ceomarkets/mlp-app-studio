import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, Eye, Loader2, Lock, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AnnouncementCard } from "@/components/AnnouncementCard";
import { Empty, Shell } from "@/components/Shell";
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
  announcementState,
  normalizeAnnouncement,
  TONES,
  validateAnnouncement,
  type AnnouncementState,
} from "@/lib/announcements";
import { backend, type Announcement, type AnnouncementInput } from "@/lib/backend";
import { keys, useRequireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/anuncios")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Anuncios · Plaza X" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminAnnouncements,
});

const EMOJIS = ["📣", "🎉", "🔥", "🎁", "🛍️", "💸", "🎪", "✨", "🚚", "☕", "🧶", "🛠️"];

const STATE: Record<AnnouncementState, { label: string; cls: string }> = {
  live: { label: "En vivo", cls: "bg-primary text-primary-foreground" },
  scheduled: { label: "Programado", cls: "bg-sun text-accent-foreground" },
  expired: { label: "Vencido", cls: "bg-muted text-muted-foreground" },
  paused: { label: "Pausado", cls: "bg-muted text-muted-foreground" },
};

/** "2026-10-30T20:00:00Z" → "2026-10-30T15:00" en la hora local del navegador. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);
const fmt = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });

function AdminAnnouncements() {
  const { user } = useRequireUser("/admin/anuncios");
  const admin = useQuery({
    queryKey: keys.isAdmin,
    queryFn: () => backend.isAdmin(),
    enabled: !!user,
  });

  if (!user || admin.isPending)
    return <Shell>{<div className="h-64 animate-pulse rounded-3xl bg-muted" />}</Shell>;

  if (!admin.data)
    return (
      <Shell>
        <Empty icon={<Lock />} title="Solo para administradores">
          Pide a quien administra Plaza X que te dé acceso.{" "}
          <Link to="/" className="font-semibold text-primary">
            Volver a la plaza
          </Link>
        </Empty>
      </Shell>
    );

  return <Manager />;
}

function Manager() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: keys.allAnnouncements,
    queryFn: () => backend.allAnnouncements(),
  });
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: keys.allAnnouncements });
    qc.invalidateQueries({ queryKey: keys.announcements });
  };
  const toggle = useMutation({
    mutationFn: (a: Announcement) => backend.saveAnnouncement({ ...a, active: !a.active }),
    onSuccess: (a) => {
      toast.success(a.active ? "Anuncio activado" : "Anuncio pausado");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => backend.deleteAnnouncement(id),
    onSuccess: () => {
      toast.success("Anuncio eliminado");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const counts = useMemo(() => {
    const c: Record<AnnouncementState, number> = { live: 0, scheduled: 0, expired: 0, paused: 0 };
    list.data?.forEach((a) => c[announcementState(a)]++);
    return c;
  }, [list.data]);

  const edit = (a: Announcement | null) => {
    setEditing(a);
    setOpen(true);
  };

  return (
    <Shell>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-card">
            <Megaphone className="size-5" />
          </span>
          <div>
            <h1 className="text-3xl font-extrabold">Anuncios</h1>
            <p className="text-sm text-muted-foreground">
              Aparecen integrados en el leaderboard en vivo de la portada.
            </p>
          </div>
        </div>
        <Button onClick={() => edit(null)}>
          <Plus /> Nuevo anuncio
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        {(Object.keys(STATE) as AnnouncementState[]).map((k) => (
          <span key={k} className={cn("rounded-full px-3 py-1 font-semibold", STATE[k].cls)}>
            {STATE[k].label}: {counts[k]}
          </span>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {list.isPending ? (
          <div className="h-40 animate-pulse rounded-2xl bg-muted" />
        ) : list.data?.length ? (
          list.data.map((a) => {
            const st = announcementState(a);
            return (
              <div
                key={a.id}
                className={cn(
                  "flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4 shadow-card",
                  st !== "live" && "opacity-75",
                )}
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-secondary text-2xl">
                  {a.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-bold">{a.title}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-bold",
                        STATE[st].cls,
                      )}
                    >
                      {STATE[st].label}
                    </span>
                    <span className="text-xs text-muted-foreground">Prioridad {a.priority}</span>
                  </div>
                  {a.body && <p className="truncate text-sm text-muted-foreground">{a.body}</p>}
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarClock className="size-3.5" /> {fmt(a.startsAt)}
                    {a.endsAt ? ` → ${fmt(a.endsAt)}` : " · sin fecha de fin"}
                    {a.link && <span className="ml-2 truncate font-mono">{a.link}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={a.active}
                    onCheckedChange={() => toggle.mutate(a)}
                    aria-label={a.active ? "Pausar anuncio" : "Activar anuncio"}
                  />
                  <Button size="icon" variant="ghost" onClick={() => edit(a)} aria-label="Editar">
                    <Pencil />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Eliminar"
                    onClick={() =>
                      confirm(`¿Eliminar "${a.title}"? Esta acción no se puede deshacer.`) &&
                      del.mutate(a.id)
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            );
          })
        ) : (
          <Empty icon={<Megaphone />} title="Aún no hay anuncios">
            Crea el primero: aparecerá al instante en la portada.
          </Empty>
        )}
      </div>

      <Editor announcement={editing} open={open} onOpenChange={setOpen} onSaved={refresh} />
    </Shell>
  );
}

const blank = (): AnnouncementInput => ({
  title: "",
  body: "",
  emoji: "📣",
  image: null,
  link: null,
  cta: "Ver más",
  tone: "promo",
  priority: 50,
  active: true,
  startsAt: new Date().toISOString(),
  endsAt: null,
});

function Editor({
  announcement,
  open,
  onOpenChange,
  onSaved,
}: {
  announcement: Announcement | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState<AnnouncementInput>(blank);
  useEffect(() => {
    if (!open) return;
    if (announcement) {
      const { createdAt: _c, ...rest } = announcement;
      setF(rest);
    } else setF(blank());
  }, [open, announcement]);

  // Sugerencias de enlaces internos: secciones y tiendas.
  const stores = useQuery({ queryKey: keys.stores, queryFn: () => backend.listStores() });
  const problem = validateAnnouncement(normalizeAnnouncement(f));

  const save = useMutation({
    mutationFn: () => backend.saveAnnouncement(f),
    onSuccess: () => {
      toast.success(announcement ? "Anuncio actualizado" : "¡Anuncio publicado!");
      onSaved();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (problem) return void toast.error(problem);
    save.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{announcement ? "Editar anuncio" : "Nuevo anuncio"}</DialogTitle>
          <DialogDescription>Corto y claro: se lee mientras pasa por la cinta.</DialogDescription>
        </DialogHeader>

        {/* Vista previa en la cinta oscura */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-600">
            <Eye className="size-3.5" /> Así se verá
          </p>
          <AnnouncementCard as="div" a={f} />
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="at" className="flex justify-between">
              <span>Título</span>
              <span className="text-xs text-muted-foreground">{f.title.length}/80</span>
            </Label>
            <Input
              id="at"
              required
              maxLength={80}
              placeholder="Ej.: Feria artesanal este sábado"
              value={f.title}
              onChange={(e) => setF({ ...f, title: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ab" className="flex justify-between">
              <span>Texto (opcional)</span>
              <span className="text-xs text-muted-foreground">{f.body.length}/160</span>
            </Label>
            <Textarea
              id="ab"
              rows={2}
              maxLength={160}
              value={f.body}
              onChange={(e) => setF({ ...f, body: e.target.value })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {TONES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setF({ ...f, tone: t.id })}
                    className={cn(
                      "rounded-lg border px-2 py-1.5 text-xs font-semibold",
                      f.tone === t.id && "border-primary bg-primary/10 text-primary",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Ícono</Label>
              <div className="flex flex-wrap gap-1">
                {EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setF({ ...f, emoji: em })}
                    aria-label={`Ícono ${em}`}
                    className={cn(
                      "grid size-8 place-items-center rounded-lg border text-lg",
                      f.emoji === em && "border-primary bg-primary/10",
                    )}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
            <div className="space-y-1.5">
              <Label htmlFor="al">Enlace (opcional)</Label>
              <Input
                id="al"
                list="announcement-links"
                placeholder="/tienda/cafe-narino o https://…"
                value={f.link ?? ""}
                onChange={(e) => setF({ ...f, link: e.target.value })}
              />
              <datalist id="announcement-links">
                <option value="/">Portada</option>
                <option value="/vendedores">Vender en Plaza X</option>
                <option value="/afiliados">Ganar recomendando</option>
                {stores.data?.map((s) => (
                  <option key={s.id} value={`/tienda/${s.slug}`}>
                    {s.name}
                  </option>
                ))}
              </datalist>
              <p className="text-xs text-muted-foreground">
                Sin enlace, al tocarlo se muestra el mensaje completo.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ac">Texto del botón</Label>
              <Input
                id="ac"
                maxLength={24}
                value={f.cta}
                onChange={(e) => setF({ ...f, cta: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ai">Imagen (opcional)</Label>
            <Input
              id="ai"
              type="url"
              placeholder="https://… (si no hay, se usa el ícono)"
              value={f.image ?? ""}
              onChange={(e) => setF({ ...f, image: e.target.value })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="as">Desde</Label>
              <Input
                id="as"
                type="datetime-local"
                required
                value={toLocalInput(f.startsAt)}
                onChange={(e) =>
                  setF({ ...f, startsAt: fromLocalInput(e.target.value) ?? f.startsAt })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ae">Hasta (opcional)</Label>
              <Input
                id="ae"
                type="datetime-local"
                value={toLocalInput(f.endsAt)}
                onChange={(e) => setF({ ...f, endsAt: fromLocalInput(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-2 rounded-2xl bg-muted p-4">
            <Label htmlFor="ap" className="flex justify-between">
              <span>Prioridad</span>
              <b>{f.priority}</b>
            </Label>
            <input
              id="ap"
              type="range"
              min={0}
              max={100}
              step={5}
              value={f.priority}
              onChange={(e) => setF({ ...f, priority: Number(e.target.value) })}
              className="w-full accent-primary"
            />
            <p className="text-xs text-muted-foreground">Los de mayor prioridad pasan primero.</p>
          </div>

          <label className="flex items-center justify-between rounded-xl border p-3 text-sm">
            <span>
              <b>Publicado</b>
              <br />
              <span className="text-muted-foreground">Apágalo para pausarlo sin borrarlo.</span>
            </span>
            <Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} />
          </label>

          {problem && f.title.length > 0 && <p className="text-sm text-destructive">{problem}</p>}

          <Button type="submit" size="lg" className="w-full" disabled={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />}
            {announcement ? "Guardar cambios" : "Publicar anuncio"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
