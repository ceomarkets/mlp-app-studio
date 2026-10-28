import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/Shell";
import { AFFILIATE_MAX, AFFILIATE_MIN, cop, products, splitSale } from "@/lib/plaza";

export const Route = createFileRoute("/vendedores")({
  head: () => ({
    meta: [
      { title: "Mi Tienda — Vende con tu marca en Plaza X" },
      { name: "description", content: "Crea tu tienda, fija precios y comisiones para afiliados y mira cuánto recibes por cada venta." },
      { property: "og:title", content: "Mi Tienda — Vendedores Plaza X" },
      { property: "og:description", content: "Tu tienda en minutos, sin pagos por adelantado." },
    ],
  }),
  component: Sellers,
});

function Sellers() {
  const [price, setPrice] = useState(100000);
  const [rate, setRate] = useState(10);
  const split = splitSale(price, rate / 100);
  const parts = [
    { k: "Tú recibes", v: split.seller, c: "bg-ink text-ink-foreground" },
    { k: "Afiliado", v: split.affiliate, c: "bg-sun text-accent-foreground" },
    { k: "Plaza X (9%)", v: split.platform, c: "bg-primary text-primary-foreground" },
  ];
  const mine = products.filter((p) => p.store === "tejidos-galeras");

  return (
    <Shell>
      <h1 className="text-4xl font-extrabold md:text-5xl">Mi Tienda</h1>
      <p className="mt-2 text-muted-foreground">Tejidos Galeras · plazax.com/tejidos-galeras</p>

      <section className="mt-8 grid gap-8 rounded-3xl border bg-card p-8 shadow-card md:grid-cols-2">
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Calculadora de reparto</h2>
          <label className="block text-sm font-semibold">Precio del producto
            <input type="number" min={0} step={1000} value={price} onChange={(e) => setPrice(Math.max(0, Number(e.target.value)))}
              className="mt-2 h-11 w-full rounded-xl border bg-background px-4 text-base" />
          </label>
          <label className="block text-sm font-semibold">Comisión para afiliados: {rate}%
            <input type="range" min={AFFILIATE_MIN * 100} max={AFFILIATE_MAX * 100} value={rate} onChange={(e) => setRate(Number(e.target.value))}
              className="mt-3 w-full accent-primary" />
            <span className="flex justify-between text-xs font-normal text-muted-foreground"><span>3%</span><span>20%</span></span>
          </label>
        </div>
        <div className="space-y-3 self-center">
          <div className="flex h-4 overflow-hidden rounded-full">
            {parts.map((p) => <div key={p.k} className={p.c} style={{ width: `${price ? (p.v / price) * 100 : 0}%` }} />)}
          </div>
          {parts.map((p) => (
            <div key={p.k} className={`flex items-center justify-between rounded-xl px-5 py-3 ${p.c}`}>
              <span className="font-semibold">{p.k}</span>
              <span className="font-display text-xl font-bold">{cop(p.v)}</span>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Fondos liberados 7 días después de la entrega confirmada.</p>
        </div>
      </section>

      <h2 className="mt-10 text-2xl font-bold">Mis productos</h2>
      <div className="mt-4 overflow-hidden rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr><th className="p-4">Producto</th><th>Precio</th><th>Comisión afiliado</th><th>Vendidos</th></tr>
          </thead>
          <tbody>
            {mine.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-4 font-semibold">{p.emoji} {p.name}</td>
                <td>{cop(p.price)}</td>
                <td>{Math.round(p.commission * 100)}%</td>
                <td>{p.sold}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
