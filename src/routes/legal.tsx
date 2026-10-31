import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/Shell";
import { LEGAL_NOTICE, LEGAL_SECTIONS, SUPPORT_EMAIL, type LegalBlock } from "@/lib/legal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/legal")({
  head: () => ({
    meta: [
      { title: "Términos, condiciones y centro legal · Plaza X" },
      {
        name: "description",
        content:
          "Reglas de publicación, protección al comprador, retracto, reversión del pago y datos personales en Plaza X Colombia.",
      },
    ],
  }),
  component: Legal,
});

function Legal() {
  return (
    <Shell>
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <nav className="sticky top-32 space-y-1 text-xs">
            {LEGAL_SECTIONS.map((s, i) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block rounded-lg px-3 py-1.5 text-slate-600 transition hover:bg-white hover:text-slate-900"
              >
                {i + 1}. {s.title}
              </a>
            ))}
          </nav>
        </aside>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <header className="mb-6 flex items-center gap-3 border-b border-slate-200 pb-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-amber-200 bg-amber-50 text-lg text-amber-600">
              <i className="fa-solid fa-scale-balanced" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Términos, condiciones y centro legal
              </h1>
              <p className="text-xs text-slate-500">
                Ley 1480 de 2011 (Estatuto del Consumidor), Decreto 587 de 2016, Ley 1581 de 2012 y
                normas de comercio electrónico en Colombia
              </p>
            </div>
          </header>

          <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] font-medium text-amber-800">
            <i className="fa-solid fa-circle-info me-1 text-amber-600" /> {LEGAL_NOTICE}
          </p>

          <div className="space-y-6 text-sm leading-relaxed text-slate-600">
            {LEGAL_SECTIONS.map((s, i) => (
              <section
                key={s.id}
                id={s.id}
                className="scroll-mt-32 space-y-2 border-t border-slate-100 pt-5 first:border-0 first:pt-0"
              >
                <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                  <span className="inline-grid size-6 shrink-0 place-items-center rounded-full bg-indigo-100 text-[11px] text-indigo-700">
                    {i + 1}
                  </span>
                  {s.title}
                </h2>
                {s.blocks.map((b, j) => (
                  <Block key={j} block={b} />
                ))}
              </section>
            ))}
          </div>

          <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-xs text-slate-500">
            <span>
              Dudas o reclamos:{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-indigo-600">
                {SUPPORT_EMAIL}
              </a>
            </span>
            <Link
              to="/cuenta"
              className="rounded-xl bg-slate-900 px-5 py-2 font-bold text-white shadow transition hover:bg-slate-800"
            >
              Ir a mis pedidos
            </Link>
          </footer>
        </article>
      </div>
    </Shell>
  );
}

function Items({ items }: { items: { title?: string; text: string }[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-[13px]">
      {items.map((it, i) => (
        <li key={i}>
          {it.title && <b className="text-slate-800">{it.title}: </b>}
          {it.text}
        </li>
      ))}
    </ul>
  );
}

function Block({ block }: { block: LegalBlock }) {
  if (block.kind === "p") return <p>{block.text}</p>;
  if (block.kind === "list") return <Items items={block.items} />;
  return (
    <div
      className={cn(
        "space-y-1.5 rounded-xl border p-3",
        block.tone === "indigo" ? "border-indigo-200 bg-indigo-50" : "border-amber-200 bg-amber-50",
      )}
    >
      <span
        className={cn(
          "block font-bold",
          block.tone === "indigo" ? "text-indigo-900" : "text-amber-900",
        )}
      >
        <i
          className={cn(
            "fa-solid me-1",
            block.icon,
            block.tone === "indigo" ? "text-indigo-600" : "text-amber-600",
          )}
        />{" "}
        {block.title}
      </span>
      {block.intro && <p className="text-[13px] text-slate-700">{block.intro}</p>}
      <div className="text-slate-700">
        <Items items={block.items} />
      </div>
    </div>
  );
}
