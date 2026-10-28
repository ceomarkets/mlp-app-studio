import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ProductCard, Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { cop, products, stores } from "@/lib/plaza";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Plaza X — Marketplace multitienda con red de afiliados" },
      { name: "description", content: "Compra a tiendas locales de Nariño, vende con tu marca o gana comisiones compartiendo productos." },
      { property: "og:title", content: "Plaza X — Tu tienda, tu red, tus ganancias" },
      { property: "og:description", content: "Marketplace multitienda con red de afiliados desde Pasto, Nariño." },
    ],
  }),
  component: Plaza,
});

const cats = ["Todo", "Ropa", "Alimentos", "Artesanías", "Campo"];

function Plaza() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Todo");
  const [cart, setCart] = useState<string[]>([]);
  const list = useMemo(
    () => products.filter((p) => (cat === "Todo" || p.category === cat) && p.name.toLowerCase().includes(q.toLowerCase())),
    [q, cat],
  );
  const total = cart.reduce((t, id) => t + products.find((p) => p.id === id)!.price, 0);

  return (
    <Shell>
      <section className="grid gap-8 rounded-3xl bg-ink p-8 text-ink-foreground md:grid-cols-[1.4fr_1fr] md:p-12">
        <div>
          <p className="mb-4 inline-block rounded-full bg-sun px-3 py-1 text-xs font-bold text-accent-foreground">Lanzamiento · 0% comisión para tiendas fundadoras</p>
          <h1 className="text-4xl font-extrabold leading-[1.05] md:text-6xl">Tu tienda, tu red,<br /><span className="text-sun">tus ganancias.</span></h1>
          <p className="mt-4 max-w-md opacity-80">Productos de tiendas de Nariño en un solo lugar. Vende con tu marca o gana compartiendo, sin inventario.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to="/afiliados">Ganar como afiliado</Link></Button>
            <Button asChild size="lg" variant="secondary"><Link to="/vendedores">Abrir mi tienda</Link></Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 self-center">
          {stores.map((s) => (
            <Link key={s.slug} to="/tienda/$slug" params={{ slug: s.slug }} className="rounded-2xl bg-ink-foreground/10 p-4 transition hover:bg-ink-foreground/20">
              <div className="text-3xl">{s.emoji}</div>
              <div className="mt-2 text-sm font-bold leading-tight">{s.name}</div>
              <div className="text-xs opacity-70">{s.city}</div>
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en toda la plaza…"
          className="h-11 flex-1 rounded-full border bg-card px-5 outline-none focus:ring-2 focus:ring-ring" />
        {cats.map((c) => (
          <button key={c} onClick={() => setCat(c)}
            className={`h-11 rounded-full border px-4 text-sm font-semibold transition ${c === cat ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary"}`}>{c}</button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-4">
        {list.map((p) => (
          <ProductCard key={p.id} p={p} action={
            <Button className="w-full" variant="outline" onClick={() => { setCart([...cart, p.id]); toast.success(`${p.name} agregado`); }}>Agregar</Button>
          } />
        ))}
        {list.length === 0 && <p className="col-span-full py-12 text-center text-muted-foreground">No encontramos productos.</p>}
      </div>

      {cart.length > 0 && (
        <div className="fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-4 rounded-full bg-ink py-2 pl-6 pr-2 text-ink-foreground shadow-card">
          <span className="text-sm">{cart.length} productos · <b>{cop(total)}</b></span>
          <Button onClick={() => { setCart([]); toast.success("¡Pedido simulado! Pagos con Nequi, Daviplata y más llegarán pronto."); }}>Pagar</Button>
        </div>
      )}
    </Shell>
  );
}
