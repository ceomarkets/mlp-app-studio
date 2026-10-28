// Utilidades puras de Wompi (Web Crypto: funcionan en Deno, navegadores y Node 20+).
// Documentación: https://docs.wompi.co/docs/colombia/widget-checkout-web/
//                https://docs.wompi.co/docs/colombia/eventos/

export const WOMPI_CHECKOUT_URL = "https://checkout.wompi.co/p/";

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Firma de integridad: SHA256(<referencia><monto en centavos><moneda><secreto de integridad>). */
export function integritySignature(
  reference: string,
  amountInCents: number,
  currency: string,
  secret: string,
) {
  return sha256Hex(`${reference}${amountInCents}${currency}${secret}`);
}

export type CheckoutParams = {
  publicKey: string;
  reference: string;
  amountInCents: number;
  signature: string;
  redirectUrl?: string;
  customer?: { email?: string; fullName?: string; phone?: string };
  shipping?: { address: string; city: string; region?: string; phone: string };
};

export function checkoutUrl(p: CheckoutParams): string {
  const q = new URLSearchParams({
    "public-key": p.publicKey,
    currency: "COP",
    "amount-in-cents": String(p.amountInCents),
    reference: p.reference,
    "signature:integrity": p.signature,
  });
  if (p.redirectUrl) q.set("redirect-url", p.redirectUrl);
  if (p.customer?.email) q.set("customer-data:email", p.customer.email);
  if (p.customer?.fullName) q.set("customer-data:full-name", p.customer.fullName);
  if (p.customer?.phone) {
    q.set("customer-data:phone-number", p.customer.phone.replace(/\D/g, "").slice(-10));
    q.set("customer-data:phone-number-prefix", "+57");
  }
  if (p.shipping) {
    q.set("shipping-address:address-line-1", p.shipping.address);
    q.set("shipping-address:country", "CO");
    q.set("shipping-address:city", p.shipping.city);
    q.set("shipping-address:region", p.shipping.region ?? p.shipping.city);
    q.set("shipping-address:phone-number", p.shipping.phone.replace(/\D/g, "").slice(-10));
  }
  return `${WOMPI_CHECKOUT_URL}?${q.toString()}`;
}

export type WompiEvent = {
  event: string;
  data: {
    transaction?: {
      id: string;
      status: string;
      reference: string;
      amount_in_cents: number;
      currency: string;
    };
  } & Record<string, unknown>;
  signature: { properties: string[]; checksum: string };
  timestamp: number;
  environment?: string;
};

function pick(obj: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined),
      obj,
    );
}

/**
 * Verifica el checksum de un evento:
 * SHA256(<valores de signature.properties en orden><timestamp><secreto de eventos>).
 * Las propiedades se leen del evento (pueden cambiar), no se fijan en el código.
 */
export async function verifyEvent(
  evt: WompiEvent,
  eventsSecret: string,
  headerChecksum?: string | null,
): Promise<boolean> {
  if (!evt?.signature?.properties?.length || !evt.timestamp) return false;
  const values = evt.signature.properties.map((p) => String(pick(evt.data, p) ?? ""));
  const expected = await sha256Hex(`${values.join("")}${evt.timestamp}${eventsSecret}`);
  const given = (headerChecksum || evt.signature.checksum || "").toLowerCase();
  if (expected.length !== given.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}
