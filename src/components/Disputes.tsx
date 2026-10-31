import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Loader2, Paperclip, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { openAuth } from "@/components/AuthDialog";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { backend, type Dispute, type OrderItem } from "@/lib/backend";
import {
  AUTO_CONFIRM_DAYS,
  canDispute,
  DETAILS_MAX,
  DETAILS_MIN,
  EVIDENCE_MAX,
  KIND_LABEL,
  REASONS,
  reasonLabel,
  STATUS_LABEL,
  trackingUrl,
  validateDispute,
  type DisputeKind,
  type DisputeReason,
} from "@/lib/disputes";
import { keys, useUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const disputeKeys = {
  mine: ["user", "disputes"] as const,
  store: ["user", "store-disputes"] as const,
  all: ["user", "all-disputes"] as const,
};

const field =
  "w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-xs text-slate-800 focus:border-indigo-600 focus:outline-none";

/**
 * Centro de soporte: disputa por un artículo pagado en el carrito (pago congelado y posible
 * reembolso) o denuncia de un trato externo (sin reembolso: bloqueo y registros).
 */
export function DisputeDialog({
  open,
  onOpenChange,
  item,
  storeSlug,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Artículo del pedido (disputa protegida). Sin él, el formulario arranca en trato externo. */
  item?: OrderItem | null;
  storeSlug?: string;
}) {
  const qc = useQueryClient();
  const { user } = useUser();
  const [kind, setKind] = useState<DisputeKind>(item ? "plazax_pay" : "external_deal");
  const [reason, setReason] = useState<DisputeReason>("different");
  const [details, setDetails] = useState("");
  const [links, setLinks] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [slug, setSlug] = useState(storeSlug ?? "");
  const [contact, setContact] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setKind(item ? "plazax_pay" : "external_deal");
    setReason(item?.fulfillment === "shipped" ? "not_received" : "different");
    setDetails("");
    setLinks("");
    setFiles([]);
    setSlug(storeSlug ?? "");
    setContact("");
  }, [open, item, storeSlug]);

  const evidence = [
    ...files,
    ...links
      .split(/\s+/)
      .map((l) => l.trim())
      .filter(Boolean),
  ];

  const send = useMutation({
    mutationFn: () => {
      const input = { reason, details: details.trim(), evidence };
      const problem = validateDispute(input);
      if (problem) throw new Error(problem);
      if (kind === "plazax_pay") {
        if (!item) throw new Error("Elige el artículo desde tu pedido");
        return backend.openDispute(item.id, input);
      }
      return backend.reportExternal({ ...input, storeSlug: slug.trim(), contact });
    },
    onSuccess: () => {
      toast.success(
        kind === "plazax_pay"
          ? "Disputa abierta: el pago al vendedor quedó congelado"
          : "Reporte enviado al equipo de seguridad",
      );
      qc.invalidateQueries({ queryKey: disputeKeys.mine });
      qc.invalidateQueries({ queryKey: keys.myOrders });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(list).slice(0, EVIDENCE_MAX - evidence.length)) {
        const ref = await backend.uploadEvidence(f);
        setFiles((x) => [...x, ref]);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    send.mutate();
  }

  const protectedAllowed = !!item && canDispute(item);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 text-slate-800">
        <div className="mb-2 flex items-center gap-3 border-b border-slate-200 pb-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-rose-200 bg-rose-50 text-lg text-rose-600">
            <i className="fa-solid fa-shield-halved" />
          </span>
          <div>
            <DialogTitle className="text-base font-bold text-slate-900">
              Centro de soporte, disputas y fraudes
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {item
                ? `${item.qty} × ${item.productName}`
                : "Reclamos de productos y denuncias preventivas"}
            </DialogDescription>
          </div>
        </div>

        {!user ? (
          <div className="space-y-3 py-4 text-center text-sm">
            <p>Inicia sesión para enviar un reporte.</p>
            <button
              onClick={() => {
                onOpenChange(false);
                openAuth();
              }}
              className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white"
            >
              Iniciar sesión
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 text-xs">
            <div>
              <label className="mb-1 block font-bold text-slate-700" htmlFor="d-kind">
                ¿Cómo realizaste el pago?
              </label>
              <select
                id="d-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as DisputeKind)}
                className={field}
              >
                <option value="plazax_pay" disabled={!protectedAllowed}>
                  1. Carrito de Plaza X (pago protegido)
                  {!item
                    ? " — ábrelo desde tu pedido"
                    : !protectedAllowed
                      ? " — fuera de plazo"
                      : ""}
                </option>
                <option value="external_deal">
                  2. Trato directo / pago externo (WhatsApp, Nequi directo, efectivo)
                </option>
              </select>
            </div>

            {kind === "plazax_pay" ? (
              <p className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-[11px] text-indigo-900">
                <i className="fa-solid fa-circle-check me-1 text-indigo-600" />
                <b>Protección activa:</b> tu dinero está en custodia. Congelamos el pago al vendedor
                (y al afiliado) mientras revisamos tus evidencias. Si se confirma, te reembolsamos
                el total.
              </p>
            ) : (
              <>
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
                  <i className="fa-solid fa-triangle-exclamation me-1 text-amber-600" />
                  <b>Sin custodia:</b> Plaza X no puede devolver pagos hechos por fuera.
                  Bloquearemos la cuenta denunciada y conservaremos los registros para entregarlos a
                  la Fiscalía si hay una denuncia penal formal.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block font-bold text-slate-700" htmlFor="d-slug">
                      Tienda (dirección web)
                    </label>
                    <input
                      id="d-slug"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase())}
                      placeholder="tejidos-galeras"
                      className={field}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-bold text-slate-700" htmlFor="d-contact">
                      Contacto usado
                    </label>
                    <input
                      id="d-contact"
                      value={contact}
                      maxLength={120}
                      onChange={(e) => setContact(e.target.value)}
                      placeholder="WhatsApp, Nequi o correo"
                      className={field}
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="mb-1 block font-bold text-slate-700" htmlFor="d-reason">
                Motivo del reporte
              </label>
              <select
                id="d-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value as DisputeReason)}
                className={field}
              >
                {REASONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block font-bold text-slate-700" htmlFor="d-details">
                Detalle del caso
              </label>
              <textarea
                id="d-details"
                required
                rows={4}
                minLength={DETAILS_MIN}
                maxLength={DETAILS_MAX}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Cuéntanos qué pasó: qué pediste, qué recibiste y cuándo."
                className={field}
              />
              <span className="text-[10px] text-slate-400">
                {details.trim().length}/{DETAILS_MIN} mínimo
              </span>
            </div>

            <div className="space-y-2">
              <span className="block font-bold text-slate-700">Evidencias</span>
              <div className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <span
                    key={f}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1"
                  >
                    <Paperclip className="size-3" /> Archivo {i + 1}
                    <button
                      type="button"
                      aria-label="Quitar"
                      onClick={() => setFiles((x) => x.filter((y) => y !== f))}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  disabled={uploading || evidence.length >= EVIDENCE_MAX}
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-1 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <i className="fa-solid fa-camera" />
                  )}{" "}
                  Subir fotos o video
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  hidden
                  accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf"
                  onChange={(e) => upload(e.target.files)}
                />
              </div>
              <input
                value={links}
                onChange={(e) => setLinks(e.target.value)}
                placeholder="O pega enlaces https (video del desempaque, chat...)"
                className={field}
              />
            </div>

            <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[10px] text-slate-500">
              <i className="fa-solid fa-lock me-1 text-slate-400" />
              Al enviar, Plaza X guarda la IP y los registros necesarios para la investigación y,
              solo ante solicitud de una autoridad competente en Colombia, para cooperar con ella.{" "}
              <Link to="/legal" hash="proteccion-comprador" className="underline">
                Ver política
              </Link>
            </p>

            <button
              type="submit"
              disabled={send.isPending || uploading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 py-3 font-bold text-white shadow transition hover:bg-rose-700 disabled:opacity-60"
            >
              {send.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <i className="fa-solid fa-paper-plane" />
              )}{" "}
              {kind === "plazax_pay" ? "Abrir disputa y congelar el pago" : "Enviar reporte"}
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Transportadora, guía y enlace de rastreo. */
export function TrackingInfo({ item }: { item: Pick<OrderItem, "carrier" | "tracking"> }) {
  if (!item.carrier && !item.tracking) return null;
  const url = trackingUrl(item.carrier, item.tracking);
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
      <i className="fa-solid fa-truck-fast text-indigo-600" />
      {item.carrier && <b className="text-slate-700">{item.carrier}</b>}
      {item.tracking && <span className="font-mono">Guía {item.tracking}</span>}
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-indigo-600 hover:underline"
        >
          Rastrear envío ↗
        </a>
      )}
    </div>
  );
}

/** Acciones del comprador sobre un artículo pagado. */
export function BuyerItemActions({
  item,
  dispute,
}: {
  item: OrderItem;
  dispute?: Dispute | undefined;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const confirm = useMutation({
    mutationFn: () => backend.confirmReceipt(item.id),
    onSuccess: () => {
      toast.success("¡Gracias! Confirmaste la entrega");
      qc.invalidateQueries({ queryKey: keys.myOrders });
      qc.invalidateQueries({ queryKey: ["user", "order"] });
    },
    onError: (e) => toast.error(e.message),
  });
  if (!item.paidAt) return null;
  const autoAt =
    item.fulfillment === "shipped" && item.shippedAt
      ? new Date(Date.parse(item.shippedAt) + AUTO_CONFIRM_DAYS * 86_400_000)
      : null;

  return (
    <div className="mt-2 space-y-2">
      {item.refundedAt && (
        <p className="text-xs font-semibold text-emerald-700">
          <i className="fa-solid fa-rotate-left" /> Reembolsado
        </p>
      )}
      {dispute && <DisputeBadge d={dispute} />}
      <div className="flex flex-wrap gap-2">
        {(item.fulfillment === "shipped" || item.fulfillment === "preparing") &&
          dispute?.status !== "open" && (
            <button
              onClick={() => confirm.mutate()}
              disabled={confirm.isPending}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              <i className="fa-solid fa-box-open" /> Confirmar recepción
            </button>
          )}
        {canDispute(item) && !dispute && (
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
          >
            <i className="fa-solid fa-shield-halved" /> Abrir disputa / Reportar problema
          </button>
        )}
      </div>
      {autoAt && !dispute && (
        <p className="text-[11px] text-slate-500">
          Si no confirmas ni reportas nada, la entrega se da por recibida el{" "}
          {autoAt.toLocaleDateString("es-CO", { day: "numeric", month: "long" })}.
        </p>
      )}
      <DisputeDialog open={open} onOpenChange={setOpen} item={item} />
    </div>
  );
}

export function DisputeBadge({ d }: { d: Pick<Dispute, "status"> }) {
  const s = STATUS_LABEL[d.status];
  return (
    <span
      className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold", s.tone)}
    >
      Disputa: {s.text}
    </span>
  );
}

export function EvidenceLinks({ refs }: { refs: string[] }) {
  const urls = useQuery({
    queryKey: ["evidence", refs],
    queryFn: () => Promise.all(refs.map((r) => backend.evidenceUrl(r))),
    enabled: refs.length > 0,
    staleTime: 5 * 60_000,
  });
  if (!refs.length) return <p className="text-xs text-slate-400">Sin evidencias adjuntas</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {refs.map((r, i) => {
        const url = urls.data?.[i];
        const img = url && (url.startsWith("data:image") || /\.(jpe?g|png|webp)(\?|$)/i.test(url));
        return url ? (
          <a
            key={r}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="block overflow-hidden rounded-lg border border-slate-200 text-xs text-indigo-600 hover:underline"
          >
            {img ? (
              <img src={url} alt={`Evidencia ${i + 1}`} className="size-16 object-cover" />
            ) : (
              <span className="block px-2 py-1">
                <Paperclip className="inline size-3" /> Evidencia {i + 1}
              </span>
            )}
          </a>
        ) : (
          <span key={r} className="rounded-lg border px-2 py-1 text-xs text-slate-400">
            Evidencia {i + 1}
          </span>
        );
      })}
    </div>
  );
}

/** Tarjeta de una disputa (comprador, vendedora o administración). */
export function DisputeCard({ d, children }: { d: Dispute; children?: React.ReactNode }) {
  return (
    <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            {KIND_LABEL[d.kind]} ·{" "}
            {new Date(d.createdAt).toLocaleDateString("es-CO", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
          <h3 className="text-sm font-bold text-slate-900">{reasonLabel(d.reason)}</h3>
          <p className="text-xs text-slate-500">
            {[d.productName, d.storeName, d.reportedContact].filter(Boolean).join(" · ")}
          </p>
        </div>
        <DisputeBadge d={d} />
      </header>
      <p className="text-sm whitespace-pre-line text-slate-700">{d.details}</p>
      <EvidenceLinks refs={d.evidence} />
      {d.sellerResponse && (
        <blockquote className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          <b>Respuesta de la tienda:</b> {d.sellerResponse}
        </blockquote>
      )}
      {d.resolutionNote && (
        <p className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900">
          <b>Resolución de Plaza X:</b> {d.resolutionNote}
        </p>
      )}
      {children}
    </article>
  );
}

/** Panel de la tienda: disputas sobre sus ventas, con respuesta. */
export function SellerDisputes() {
  const list = useQuery({ queryKey: disputeKeys.store, queryFn: () => backend.storeDisputes() });
  if (list.isPending) return <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />;
  if (!list.data?.length)
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
        Sin disputas. Despacha con guía y fotos del empaque: es tu mejor defensa.
      </p>
    );
  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        Mientras una disputa está abierta, el pago de ese artículo queda congelado. Responde con tu
        versión y evidencias (guía, fotos del empaque); la administración decide.
      </p>
      {list.data.map((d) => (
        <DisputeCard key={d.id} d={d}>
          {d.status === "open" && !d.sellerResponse && <RespondForm id={d.id} />}
        </DisputeCard>
      ))}
    </div>
  );
}

function RespondForm({ id }: { id: string }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const m = useMutation({
    mutationFn: () => backend.respondDispute(id, text),
    onSuccess: () => {
      toast.success("Respuesta enviada");
      qc.invalidateQueries({ queryKey: disputeKeys.store });
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim().length < 10) toast.error("Escribe tu versión (mínimo 10 caracteres)");
        else m.mutate();
      }}
      className="space-y-2"
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="Tu versión: qué enviaste, guía, fotos del empaque (enlaces)…"
        className={field}
      />
      <button
        disabled={m.isPending}
        className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
      >
        Enviar respuesta
      </button>
    </form>
  );
}
