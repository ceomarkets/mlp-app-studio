// Recibe los eventos de Wompi y confirma o rechaza pedidos.
// Configura en Wompi (Desarrolladores → URL de eventos):
//   https://<proyecto>.supabase.co/functions/v1/wompi-webhook
// Secreto requerido: WOMPI_EVENTS_SECRET
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyEvent, type WompiEvent } from "../_shared/wompi.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Método no permitido", { status: 405 });
  const secret = Deno.env.get("WOMPI_EVENTS_SECRET");
  if (!secret) return new Response("Sin configurar", { status: 500 });

  let evt: WompiEvent;
  try {
    evt = await req.json();
  } catch {
    return new Response("JSON inválido", { status: 400 });
  }

  if (!(await verifyEvent(evt, secret, req.headers.get("X-Event-Checksum")))) {
    console.warn("Evento de Wompi con firma inválida");
    return new Response("Firma inválida", { status: 401 });
  }

  const tx = evt.data.transaction;
  if (evt.event !== "transaction.updated" || !tx) return new Response("ignorado", { status: 200 });
  if (tx.currency !== "COP") return new Response("moneda no soportada", { status: 200 });

  // Service role: única forma de ejecutar mark_order_paid / mark_order_failed.
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let result: unknown = "ignorado";
  if (tx.status === "APPROVED") {
    const { data, error } = await admin.rpc("mark_order_paid", {
      p_reference: tx.reference,
      p_transaction_id: tx.id,
      p_amount_in_cents: tx.amount_in_cents,
    });
    if (error) {
      console.error(error);
      return new Response("error", { status: 500 }); // Wompi reintenta
    }
    result = data;
    if (data === "amount_mismatch")
      console.error("Monto no coincide", tx.reference, tx.amount_in_cents);
  } else if (["DECLINED", "VOIDED", "ERROR"].includes(tx.status)) {
    const { data, error } = await admin.rpc("mark_order_failed", {
      p_reference: tx.reference,
      p_transaction_id: tx.id,
    });
    if (error) return new Response("error", { status: 500 });
    result = data;
  }

  return new Response(JSON.stringify({ ok: true, result }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
