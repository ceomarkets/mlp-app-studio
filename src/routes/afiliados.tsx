import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ProductCard, Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { cop, MIN_WITHDRAWAL, products, splitSale } from "@/lib/plaza";

export const Route = createFileRoute("/afiliados")({
  head: () => ({
    meta: [
      { title: "Mi Red — Gana como afiliado en Plaza X" },
      { name: "description", content: "Comparte productos en redes y gana comisión por cada venta, sin comprar ni enviar nada." },
      { property: "og:title", content: "Mi Red — Afiliados Plaza X" },
      { property: "og:description", content: "Gana desde tu celular sin invertir." },
    ],
  }),
  component: Affiliates,
});

const balance = 63500;

function Affiliates() {
  const [user, setUser] = useState("tunombre");
  const [sort, setSort] = useState<"commission" | "sold">("commission");
  const list = [...products].sort((a, b) => (sort === "commission" ? b.commission - a.commission : b.sold - a.sold));
  const stats = [
    { k: "Clics (30 días)", v: "1.284" },
    { k: "Ventas generadas", v: "17" },
    { k: "Comisión acumulada", v: cop(balance) },
  ];

  return (
    <Shell>
      <h1 className="text-4xl font-extrabold md:text-5xl">Mi Red</h1>
      <p className="mt-2 text-muted-foreground">Comparte, rastreamos 30 días y cobras automáticamente.</p>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.k} className="rounded-2xl border bg-card p-5 shadow-card">
            <div className="text-sm text-muted-foreground">{s.k}</div>
            <div className="font-display text-2xl font-bold">{s.v}</div>
          </div>
        ))}
        <div className="flex flex-col justify-between rounded-2xl bg-primary p-5 text-primary-foreground">
          <div className="text-sm opacity-80">Retiro mínimo {cop(MIN_WITHDRAWAL)}</div>
          <Button variant="secondary" disabled={balance < MIN_WITHDRAWAL} onClick={() => toast.success("Retiro solicitado a Nequi")}>Retirar</Button>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Vitrina</h2>
        <div className="flex items-center gap-2 text-sm">
          <label className="text-muted-foreground">Tu usuario</label>
          <input value={user} onChange={(e) => setUser(e.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase())}
            className="h-9 w-36 rounded-full border bg-card px-3" />
          <select value={sort} onChange={(e) => setSort(e.target.value as "commission" | "sold")} className="h-9 rounded-full border bg-card px-3">
            <option value="commission">Mayor comisión</option>
            <option value="sold">Más vendidos</option>
          </select>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-4">
        {list.map((p) => {
          const earn = splitSale(p.price, p.commission).affiliate;
          const link = `plazax.com/ref/${user || "tunombre"}/${p.id}`;
          return (
            <ProductCard key={p.id} p={p} action={
              <div className="space-y-2">
                <div className="rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
                  Ganas <b>{cop(earn)}</b> · {Math.round(p.commission * 100)}%
                </div>
                <Button className="w-full" onClick={() => { navigator.clipboard?.writeText(link); toast.success("Enlace copiado", { description: link }); }}>Copiar enlace</Button>
              </div>
            } />
          );
        })}
      </div>
    </Shell>
  );
}
