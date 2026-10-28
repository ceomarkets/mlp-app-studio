// Genera el enlace de pago de Wompi para un pedido del usuario autenticado.
// Secretos requeridos: WOMPI_PUBLIC_KEY, WOMPI_INTEGRITY_SECRET
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkoutUrl, integritySignature } from "../_shared/wompi.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const publicKey = Deno.env.get("WOMPI_PUBLIC_KEY");
  const secret = Deno.env.get("WOMPI_INTEGRITY_SECRET");
  if (!publicKey || !secret) return json({ error: "Wompi no está configurado" }, 500);

  // Cliente con el token del usuario: las políticas RLS garantizan que solo vea sus pedidos.
  const auth = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: userData } = await sb.auth.getUser();
  if (!userData.user) return json({ error: "Inicia sesión" }, 401);

  let body: { orderId?: string; redirectUrl?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Solicitud inválida" }, 400);
  }

  const { data: order } = await sb
    .from("orders")
    .select("reference, total, status, buyer_id, shipping")
    .eq("id", body.orderId ?? "")
    .maybeSingle();
  if (!order || order.buyer_id !== userData.user.id)
    return json({ error: "Pedido no encontrado" }, 404);
  if (order.status !== "pending")
    return json({ error: "Este pedido ya no está pendiente de pago" }, 409);

  const amountInCents = order.total * 100;
  const redirect =
    body.redirectUrl && /^https?:\/\//.test(body.redirectUrl) ? body.redirectUrl : undefined;
  const url = checkoutUrl({
    publicKey,
    reference: order.reference,
    amountInCents,
    signature: await integritySignature(order.reference, amountInCents, "COP", secret),
    redirectUrl: redirect,
    customer: {
      email: userData.user.email,
      fullName: order.shipping?.name,
      phone: order.shipping?.phone,
    },
    shipping: order.shipping
      ? { address: order.shipping.address, city: order.shipping.city, phone: order.shipping.phone }
      : undefined,
  });
  return json({ url, reference: order.reference });
});
