import { describe, expect, it } from "vitest";
import {
  checkoutUrl,
  integritySignature,
  sha256Hex,
  verifyEvent,
  type WompiEvent,
} from "../../supabase/functions/_shared/wompi";

describe("Wompi", () => {
  it("firma de integridad = SHA256(referencia + centavos + moneda + secreto)", async () => {
    const sig = await integritySignature(
      "PX261028-ABC123",
      18000000,
      "COP",
      "test_integrity_secret",
    );
    expect(sig).toBe(await sha256Hex("PX261028-ABC12318000000COPtest_integrity_secret"));
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it("arma la URL del checkout con los parámetros oficiales", () => {
    const url = new URL(
      checkoutUrl({
        publicKey: "pub_test_x",
        reference: "R1",
        amountInCents: 500000,
        signature: "abc",
        redirectUrl: "https://plazax.co/pedido/1",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://checkout.wompi.co/p/");
    expect(url.searchParams.get("amount-in-cents")).toBe("500000");
    expect(url.searchParams.get("signature:integrity")).toBe("abc");
    expect(url.searchParams.get("currency")).toBe("COP");
  });

  const secret = "test_events_secret";
  async function signed(status = "APPROVED"): Promise<WompiEvent> {
    const evt: WompiEvent = {
      event: "transaction.updated",
      data: {
        transaction: {
          id: "1234-1610641025-49201",
          status,
          reference: "R1",
          amount_in_cents: 4490000,
          currency: "COP",
        },
      },
      signature: {
        properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"],
        checksum: "",
      },
      timestamp: 1530291411,
    };
    // Ejemplo de la documentación: id + status + amount + timestamp + secreto
    evt.signature.checksum = await sha256Hex(
      `1234-1610641025-49201${status}44900001530291411${secret}`,
    );
    return evt;
  }

  it("acepta un evento con checksum válido", async () => {
    expect(await verifyEvent(await signed(), secret)).toBe(true);
  });

  it("rechaza un evento alterado", async () => {
    const evt = await signed();
    evt.data.transaction!.amount_in_cents = 100;
    expect(await verifyEvent(evt, secret)).toBe(false);
  });

  it("rechaza con secreto incorrecto o checksum de cabecera distinto", async () => {
    const evt = await signed();
    expect(await verifyEvent(evt, "otro")).toBe(false);
    expect(await verifyEvent(evt, secret, "0".repeat(64))).toBe(false);
  });
});
